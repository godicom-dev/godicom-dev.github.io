# SCU — sending

An SCU initiates the association. `ae.Dial` negotiates it and hands back an
`*ae.Association`; every DIMSE service is a method on that.

```go
import "github.com/godicom-dev/gonetdicom/ae"

assoc, err := ae.Dial(ctx, cfg, "pacs.example:11112", "ANY-SCP")
```

The last argument is the *called* AE title — who you are talking to. Your own is
`cfg.AETitle`.

## Verification (C-ECHO)

The whole of it, and the first thing to try against a new peer:

```go
package main

import (
	"context"
	"log"
	"time"

	"github.com/godicom-dev/gonetdicom/ae"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	assoc, err := ae.Dial(ctx, ae.Config{AETitle: "MYSCU"}, "pacs.example:11112", "ANY-SCP")
	if err != nil {
		log.Fatal(err)
	}
	defer assoc.Abort()

	if err := assoc.CEcho(ctx); err != nil {
		log.Fatal(err)
	}
	if err := assoc.Release(ctx); err != nil {
		log.Fatal(err)
	}
}
```

`Release` is the orderly close; `Abort` is the abrupt one. Deferring `Abort` and
calling `Release` on the happy path means a panic or an early return still tears
the association down.

## Storage (C-STORE)

You must propose a presentation context that covers what you are sending — the
SOP Class as abstract syntax, and at least one transfer syntax:

```go
cfg := ae.Config{
	AETitle: "STORESCU",
	PresentationContexts: []ae.PresentationContext{{
		ID:               1,
		AbstractSyntax:   "1.2.840.10008.5.1.4.1.1.7", // Secondary Capture
		TransferSyntaxes: []string{"1.2.840.10008.1.2"},
	}},
}
assoc, err := ae.Dial(ctx, cfg, "pacs.example:11112", "ANY-SCP")
if err != nil {
	log.Fatal(err)
}
defer assoc.Abort()

res, err := assoc.CStore(ctx, ae.StoreRequest{
	AffectedSOPClassUID:    "1.2.840.10008.5.1.4.1.1.7",
	AffectedSOPInstanceUID: "1.2.3.4.5",
	Data:                   ds, // a godicom Dataset, or pre-encoded bytes
})
```

`AffectedSOPInstanceUID` is optional — it can come from the dataset's
`SOPInstanceUID`, or from `ae.NewInstanceUID()` when you are generating one.

## Query and retrieve

### C-FIND

```go
matches, err := assoc.CFind(ctx, ae.FindRequest{
	QueryModel:     ae.PatientRootQueryRetrieveInformationModelFind,
	IdentifierData: query, // a Dataset holding the matching and return keys
})
```

### C-MOVE

The peer sends the instances to a *third* AE, named by title. That AE has to be
one the peer already knows how to reach:

```go
matches, err := assoc.CMove(ctx, ae.MoveRequest{
	QueryModel:      ae.PatientRootQueryRetrieveInformationModelMove,
	MoveDestination: "STORESCP",
	IdentifierData:  query,
})
```

### C-GET

The peer sends the instances back over the *same* association, which means your
SCU has to act as a C-STORE SCP for the duration:

```go
matches, err := assoc.CGet(ctx, ae.GetRequest{
	QueryModel:     ae.PatientRootQueryRetrieveInformationModelGet,
	IdentifierData: query,
	OnCStore: func(_ context.Context, req ae.StoreRequest) uint16 {
		_ = req.Data // a decoded Dataset
		return status.Success
	},
})
```

::: warning Role selection is not optional in practice
Against a real PACS, C-GET also needs SCP/SCU Role Selection proposed, so the
peer is willing to send C-STORE to the requestor:

```go
cfg := ae.Config{
	AETitle:              "GETSCU",
	PresentationContexts: []ae.PresentationContext{ /* Get model + storage SOP Class */ },
	RoleSelections: []pdu.RoleSelection{
		ae.BuildRole(string(uid.CTImageStorage), false, true), // requestor as SCP
	},
}
```

Without it, many implementations will negotiate the association and then simply
never send anything.
:::

### Cancelling

```go
err := assoc.CCancel(ctx, msgID, 0, ae.PatientRootQueryRetrieveInformationModelFind)
```

Works against an outstanding C-FIND, C-MOVE or C-GET, and is safe to call from
another goroutine while that call is still blocked. The third argument is the
presentation context ID; pass `0` and the fourth argument — the query model's
abstract syntax — resolves it for you.

## DIMSE-N and Storage Commitment

```go
res, err := assoc.NAction(ctx, ae.ActionRequest{
	RequestedSOPClassUID:    ae.StorageCommitmentPushModelSOPClass,
	RequestedSOPInstanceUID: ae.StorageCommitmentPushModelSOPInstance,
	ActionTypeID:            dimse.StorageCommitmentActionTypeRequest,
	ActionInformationData:   info,
	OnNEventReport: func(_ context.Context, req ae.EventReportRequest) uint16 {
		return status.Success
	},
})
```

The commitment result may come back on the same association — handled by
`OnNEventReport` above — or later, on a new one. For that case, see
`EventReportRequest.AsyncDestination`.

`NGet`, `NSet`, `NCreate`, `NDelete` and `NEventReport` are available on the same
association.

## TLS and timeouts

```go
assoc, err := ae.Dial(ctx, ae.Config{
	AETitle:     "MYSCU",
	IdleTimeout: 30 * time.Second,
	TLS:         &tls.Config{ServerName: "pacs.example", MinVersion: tls.VersionTLS12},
	Logger:      logger,
}, "pacs.example:2762", "ANY-SCP")
```

Port 2762 is the registered DICOM-TLS port, as 11112 is the registered plain one.

## User identity negotiation

```go
assoc, err := ae.Dial(ctx, ae.Config{
	AETitle:      "IDSCU",
	UserIdentity: ae.UsernamePasscodeIdentity("alice", "secret", false),
}, addr, "IDSCP")
```

The final argument asks for a positive response from the peer. See
[SCP — serving](/gonetdicom/scp#user-identity) for the other end.

## Status codes

DIMSE statuses are `uint16` values with meanings that vary by service. Use the
named constants in
[`status`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/status) rather
than literals — `status.Success`, `status.ProcessingFailure`, and the rest.
