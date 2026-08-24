# DICOMweb

The [`dicomweb`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/dicomweb)
package implements the PS3.18 HTTP transactions — WADO-RS to retrieve, STOW-RS
to store, QIDO-RS to search — plus a small origin server for tests and demos.

```go
import "github.com/godicom-dev/gonetdicom/dicomweb"
```

## The client

```go
client := &dicomweb.Client{BaseURL: "https://pacs.example/dicom-web"}
```

or, with options:

```go
client, err := dicomweb.NewClient("https://pacs.example/dicom-web",
	dicomweb.WithTimeout(30*time.Second),
	dicomweb.WithTLSConfig(&tls.Config{MinVersion: tls.VersionTLS12}),
	dicomweb.WithLogger(logger),
)
```

## STOW-RS — store

```go
_, err := client.StoreFiles(ctx, "", []*godicom.FileDataset{fd})
```

The second argument is the study UID to store into; empty means the server
decides from the instances.

## WADO-RS — retrieve

```go
raw, err := client.RetrieveInstance(ctx, studyUID, seriesUID, sopUID)
parts, err := client.RetrieveSeries(ctx, studyUID, seriesUID)
meta, err := client.RetrieveInstanceMetadata(ctx, studyUID, seriesUID, sopUID)
bulk, err := client.RetrieveBulkData(ctx, studyUID, seriesUID, sopUID)
```

Rendered retrieval, when you want an image rather than a dataset — the server
does the windowing and the encoding:

```go
mt, img, err := client.RetrieveRenderedInstance(ctx, studyUID, seriesUID, sopUID,
	dicomweb.RenderOptions{
		MediaType: dicomweb.MediaTypeJPEG,
		Quality:   90,
	})
```

It returns the media type alongside the bytes, because a server is allowed to
give you something other than what you asked for.

::: tip Rendered or decoded?
`RetrieveRenderedInstance` makes the server do the work and hands you JPEG or
PNG. Retrieving the instance and calling
[`DisplayFrame`](/godicom/pixel-data#display-ready-bytes) makes godicom do it,
locally, with the LUTs of your choosing. The second is reproducible; the first is
one round trip.
:::

## QIDO-RS — search

```go
matches, err := client.SearchStudies(ctx, url.Values{"PatientID": {"P001"}})
```

Query parameters are plain `url.Values`, so the whole QIDO-RS vocabulary —
matching keys, `includefield`, `limit`, `offset`, `fuzzymatching` — is available
without a builder API in the way.

## The origin server

A DICOMweb origin-server MVP, intended for tests and demos rather than as a PACS:

```go
store := dicomweb.NewMemoryStore()
http.ListenAndServe(":8080", dicomweb.Handler(store, "/dicom-web"))
```

`Handler` returns an ordinary `http.Handler`, so it mounts inside whatever router
you already have, and `NewMemoryStore` keeps everything in memory — which makes
it a genuinely useful test double for code that talks to a DICOMweb endpoint.

## Which one to use

DIMSE and DICOMweb reach the same data by different means, and the choice is
usually made for you by whatever you have to talk to. Roughly:

| | DIMSE | DICOMweb |
|--|-------|----------|
| Transport | TCP, port 104 / 11112 / 2762 | HTTP(S) |
| Through a firewall or proxy | painful | ordinary |
| Retrieve one instance | C-GET or C-MOVE | one `GET` |
| Push | C-STORE | STOW-RS |
| Search | C-FIND | QIDO-RS |
| Server-side rendering | no | yes |

See [SCU](/gonetdicom/scu) and [SCP](/gonetdicom/scp) for the DIMSE side.
