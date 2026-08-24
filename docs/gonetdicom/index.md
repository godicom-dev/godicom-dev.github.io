# gonetdicom

[![Release](https://img.shields.io/github/v/release/godicom-dev/gonetdicom?label=release&color=007d9c)](https://github.com/godicom-dev/gonetdicom/releases)
[![CI](https://github.com/godicom-dev/gonetdicom/actions/workflows/ci.yml/badge.svg)](https://github.com/godicom-dev/gonetdicom/actions/workflows/ci.yml)
[![GoDoc](https://pkg.go.dev/badge/github.com/godicom-dev/gonetdicom)](https://pkg.go.dev/github.com/godicom-dev/gonetdicom)

*gonetdicom* implements the DICOM networking protocol and the DICOMweb (PS3.18)
transactions. Where [godicom](/godicom/) is about the bytes of a dataset,
gonetdicom is about moving them between machines.

```bash
go get github.com/godicom-dev/gonetdicom@latest
```

```
gonetdicom
 └── github.com/godicom-dev/godicom
```

Datasets and pixel I/O come from godicom; gonetdicom owns Upper Layer PDUs,
DIMSE command sets, association negotiation, and HTTP DICOMweb. DIMSE behaviour
is aligned with [pynetdicom](https://github.com/pydicom/pynetdicom), using its
fixtures as a git submodule; DICOMweb follows PS3.18.

## Packages

| Package | Role |
|---------|------|
| [`ae`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/ae) | Application Entity — association as SCU or SCP, TLS, role selection, user identity |
| [`dimse`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/dimse) | DIMSE command sets, C- and N- services |
| [`pdu`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/pdu) | Upper Layer PDUs and PDV fragmentation |
| [`dicomweb`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/dicomweb) | WADO-RS / STOW-RS / QIDO-RS client, plus an origin-server MVP |
| [`status`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/status) | Named DIMSE status constants |

Almost everything you write day to day lives in `ae`.

## The two shapes

**As an SCU** — you initiate. `ae.Dial` negotiates an association and returns an
`*ae.Association` you send DIMSE messages on:

```go
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
```

**As an SCP** — you accept. `ae.Serve` blocks on a listener, dispatching to the
handlers you configured:

```go
err := ae.Serve(ctx, ln, ae.ServerConfig{
	AETitle:                  "STORESCP",
	AcceptedAbstractSyntaxes: ae.AllStorageSOPClasses,
	OnCStore:                 handleStore,
})
```

## Services

| Service | SCU method | SCP handler |
|---------|-----------|-------------|
| C-ECHO | `CEcho` | built in |
| C-STORE | `CStore` | `OnCStore` |
| C-FIND | `CFind` | `OnCFind` |
| C-MOVE | `CMove` | `OnCMove` |
| C-GET | `CGet` | `OnCGet` |
| C-CANCEL | `CCancel` | — |
| N-EVENT-REPORT | `NEventReport` | `OnNEventReport` |
| N-GET | `NGet` | `OnNGet` |
| N-SET | `NSet` | `OnNSet` |
| N-ACTION | `NAction` | `OnNAction` |
| N-CREATE | `NCreate` | `OnNCreate` |
| N-DELETE | `NDelete` | `OnNDelete` |

## On this site

- **[SCU — sending](/gonetdicom/scu)** — verification, storage, query/retrieve,
  DIMSE-N, TLS, user identity
- **[SCP — serving](/gonetdicom/scp)** — storage, query, move destinations,
  identity negotiation
- **[DICOMweb](/gonetdicom/dicomweb)** — the client, and the origin-server MVP

## Logging

Silent by default, like leaving pynetdicom's `debug_logger` unset. A
`Config`/`Client` logger wins over a context logger:

```go
assoc, err := ae.Dial(ctx, ae.Config{AETitle: "MYSCU", Logger: logger}, addr, "ANY-SCP")

ctx = gonetdicom.WithLogger(ctx, logger) // shared with godicom.ReadFileContext etc.
```

At `LevelDebug` the AE logs PDU send/recv and DIMSE command summaries, with fixed
attribute keys: `component`, `calling_ae`, `called_ae`, `pdu_type_name`,
`command_name`, `pc_id`, `message_id`, `status`.

## Testing against a real PACS

An optional soak test, skipped unless the environment names a PACS:

```bash
GONETDICOM_PACS_ADDR=host:11112 GONETDICOM_PACS_AE=ANY-SCP \
  go test -tags=integration ./ae -run TestIntegrationCEchoPACS -v
```

## Repository documents

- [pkg.go.dev](https://pkg.go.dev/github.com/godicom-dev/gonetdicom) — full API reference
- [CHANGELOG.md](https://github.com/godicom-dev/gonetdicom/blob/main/CHANGELOG.md)
- [TODO.md](https://github.com/godicom-dev/gonetdicom/blob/main/TODO.md) — deferred items and known gaps
