# DICOM JSON

The [DICOM JSON Model](https://dicom.nema.org/medical/dicom/current/output/chtml/part18/chapter_F.html)
(PS3.18 Annex F) is what DICOMweb speaks. The
[`dicomjson`](https://pkg.go.dev/github.com/godicom-dev/godicom/dicomjson)
package converts datasets to and from it.

```go
import "github.com/godicom-dev/godicom/dicomjson"
```

## Both directions

```go
jsonData, err := dicomjson.MarshalDataset(ds.Dataset)
parsed, err := dicomjson.ParseDataset(jsonData)

arr, err := dicomjson.MarshalDatasets([]*godicom.Dataset{ds1, ds2})
dss, err := dicomjson.ParseDatasets(arr)
```

| Function | For |
|----------|-----|
| `MarshalDataset(ds, opts…)` | one dataset → JSON bytes, tag-sorted |
| `MarshalDatasetString(ds, opts…)` | the same, as a `string` |
| `MarshalDatasets(dss, opts…)` | a JSON array of datasets — a QIDO-RS result |
| `ParseDataset(data, opts…)` | JSON bytes → `*godicom.Dataset` |
| `ParseDatasets(data, opts…)` | a JSON array → `[]*godicom.Dataset` |
| `DecodeDataset(r, opts…)` | straight from an `io.Reader` |
| `DatasetToMap(ds, opts…)` | `map[string]Element`, if you want to post-process before encoding |

Output is sorted by tag, so two runs over the same dataset produce byte-identical
JSON — which matters more than it sounds when you are diffing fixtures or
signing payloads.

## The element shape

```go
type Element struct {
	VR           string            `json:"vr"`
	Value        []json.RawMessage `json:"Value,omitempty"`
	InlineBinary string            `json:"InlineBinary,omitempty"`
	BulkDataURI  string            `json:"BulkDataURI,omitempty"`
}
```

`Value` stays as `json.RawMessage`, so a number that arrived as `1.0` does not
become `1` on the way through.

## Bulk data

A 20 MB *Pixel Data* element base64-encoded inline is technically valid JSON and
practically a mistake. Past a threshold, emit a reference instead:

```go
jsonData, err := dicomjson.MarshalDataset(ds.Dataset,
	dicomjson.WithBulkDataThreshold(1024),
	dicomjson.WithBulkDataURIBuilder(func(t godicom.Tag, vr godicom.VR, value []byte) (string, error) {
		return store(t, value) // return the URI you stored it at
	}),
)
```

and on the way back in, resolve them:

```go
parsed, err := dicomjson.ParseDataset(jsonData,
	dicomjson.WithBulkDataURIReader(func(t godicom.Tag, vr godicom.VR, uri string) ([]byte, error) {
		return fetch(uri)
	}),
)
```

Below the threshold, values are carried in `InlineBinary` as base64. With no
builder set, nothing is externalised.

## Elements that will not marshal

`WithSuppressInvalidTags()` drops elements that fail marshaling instead of
failing the whole document. Use it when you are exporting from files you do not
control and a single bad element should not cost you the other four hundred:

```go
jsonData, err := dicomjson.MarshalDataset(ds.Dataset, dicomjson.WithSuppressInvalidTags())
```

Without it, a marshal error is returned — which is the right default, because
silently losing an element is exactly the kind of thing you find out about six
months later.

## With DICOMweb

[gonetdicom's DICOMweb client](/gonetdicom/dicomweb) already returns parsed
metadata for the WADO-RS and QIDO-RS transactions, so you normally reach for
`dicomjson` directly only when you are building the payloads yourself or
implementing a server.
