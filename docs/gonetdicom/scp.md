# SCP — serving

An SCP accepts associations. You configure which abstract syntaxes you are
willing to accept and which handlers serve them, then hand a listener to
`ae.Serve`.

```go
err := ae.Serve(ctx, ln, ae.ServerConfig{ /* … */ })
```

`ae.ListenAndServeTLS` is the TLS equivalent.

## Storage SCP (C-STORE)

```go
package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"

	"github.com/godicom-dev/godicom"
	"github.com/godicom-dev/gonetdicom/ae"
	"github.com/godicom-dev/gonetdicom/status"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	ln, err := net.Listen("tcp", ":11112")
	if err != nil {
		log.Fatal(err)
	}

	err = ae.Serve(ctx, ln, ae.ServerConfig{
		AETitle:                  "STORESCP",
		AcceptedAbstractSyntaxes: ae.AllStorageSOPClasses,
		OnCStore: func(_ context.Context, req ae.StoreRequest) uint16 {
			if req.Data == nil || req.FileMeta == nil {
				return status.ProcessingFailure
			}
			fd := &godicom.FileDataset{Dataset: req.Data, FileMeta: req.FileMeta}
			err := fd.SaveAs(req.AffectedSOPInstanceUID+".dcm",
				&godicom.WriteOptions{EnforceFileFormat: true})
			if err != nil {
				return status.ProcessingFailure
			}
			return status.Success
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
```

Two things worth noticing:

::: danger Serve blocks until ctx is cancelled
Do not reuse a `context.WithTimeout` from an SCU snippet. A ten-second timeout
shuts the server down after ten seconds. `signal.NotifyContext` is usually what
you want.
:::

The handler receives a decoded `*godicom.Dataset` in `req.Data` and the File Meta
in `req.FileMeta`, so writing a conformant Part 10 file is a `SaveAs` with
`EnforceFileFormat: true` — the transfer syntax the instance arrived under is
already in the File Meta.

## Accepted abstract syntaxes

```go
AcceptedAbstractSyntaxes: ae.AllStorageSOPClasses  // every storage SOP Class
AcceptedAbstractSyntaxes: []string{"*"}            // anything the peer proposes
AcceptedAbstractSyntaxes: []string{string(uid.CTImageStorage)}
```

`"*"` is convenient for a test receiver and a poor idea for a production one — an
SCP that claims to support everything will be sent everything.

## Handlers

| Handler | Service |
|---------|---------|
| `OnCStore` | C-STORE |
| `OnCFind` | C-FIND |
| `OnCMove` | C-MOVE |
| `OnCGet` | C-GET |
| `OnNEventReport` | N-EVENT-REPORT |
| `OnNGet` | N-GET |
| `OnNSet` | N-SET |
| `OnNAction` | N-ACTION |
| `OnNCreate` | N-CREATE |
| `OnNDelete` | N-DELETE |
| `OnUserIdentity` | identity negotiation |

Each returns a DIMSE status — use the constants in
[`status`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/status).

C-ECHO needs no handler; it is answered for you.

## Move destination SCP (C-MOVE)

C-MOVE means *you* open a second association to a third AE and send the
instances there. The destinations are named by AE title, and you declare which
titles you know how to reach:

```go
err := ae.Serve(ctx, moveLn, ae.ServerConfig{
	AETitle: "MOVESCP",
	AcceptedAbstractSyntaxes: []string{
		ae.PatientRootQueryRetrieveInformationModelMove,
	},
	MoveDestinations: map[string]ae.MoveDestination{
		"STORESCP": {Addr: "127.0.0.1:11112", MaxAssociations: 4},
	},
	OnCMove: func(_ context.Context, req ae.MoveRequest) ae.MovePlan {
		return ae.MovePlan{Stores: []ae.StoreRequest{{ /* … */ }}}
	},
})
```

`OnCMove` returns a plan rather than performing the sends: you say what should be
stored where, and gonetdicom opens the associations and runs the sub-operations.
`MaxAssociations` caps how many a destination gets in parallel.

## User identity

```go
err := ae.Serve(ctx, ln, ae.ServerConfig{
	AETitle: "IDSCP",
	OnUserIdentity: func(req pdu.UserIdentityRQ) (bool, []byte) {
		return string(req.PrimaryField) == "alice", nil
	},
})
```

Return `false` and the association is rejected. The `[]byte` is the server
response field, for identity types that carry one.

A nil `OnUserIdentity` accepts the association and omits any AC response item —
so leaving it unset does not accidentally reject peers that propose an identity.

## Roles

An SCP that also needs to send — a C-GET provider — negotiates SCP/SCU role
selection. `ae.BuildRole` constructs the items; see
[role selection on the SCU side](/gonetdicom/scu#c-get) for the mirror image.
