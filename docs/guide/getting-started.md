# Getting started

## Requirements

Go 1.26 or newer. No C toolchain and no CMake — the compressed-Pixel-Data
codecs load their native libraries through `purego`, so `CGO_ENABLED=0` builds
work. See [the ecosystem page](/ecosystem#platform-support-of-the-native-codecs)
for the platforms those libraries are built for.

## Install

```bash
go get github.com/godicom-dev/godicom@latest
```

That is the only module you need for reading and writing files, including
compressed Pixel Data — the codec modules come with it. Add
[gonetdicom](/gonetdicom/) separately if you also need DIMSE or DICOMweb.

```bash
go get github.com/godicom-dev/gonetdicom@latest
```

## Read a file

```go
package main

import (
	"fmt"
	"log"

	"github.com/godicom-dev/godicom"
	"github.com/godicom-dev/godicom/tag"
)

func main() {
	ds, err := godicom.ReadFile("ct.dcm", nil)
	if err != nil {
		log.Fatal(err)
	}

	name, ok := ds.GetString(tag.PatientName)
	if !ok {
		log.Fatal("no PatientName")
	}
	fmt.Println(name)
}
```

`ReadFile` returns a `*godicom.FileDataset`: the dataset itself, plus the
preamble and File Meta Information that a Part 10 file carries around it.
Elements are read with typed getters and the constants in the
[`tag`](https://pkg.go.dev/github.com/godicom-dev/godicom/tag) package.

## Change something and write it back

```go
if err := ds.SetString(tag.PatientID, "12345678"); err != nil {
	log.Fatal(err)
}
if err := ds.SaveAs("ct_updated.dcm", nil); err != nil {
	log.Fatal(err)
}
```

The setters take the VR from the data dictionary, so `SetString` on a numeric
tag or `SetFloat` on an integer-valued one fails at the call site rather than
producing a file a receiver will reject. [Datasets](/godicom/datasets) covers
the getters and setters in full.

## A round trip with no files involved

Useful as a smoke test, and it is the shape most of the examples on this site
take — every byte is built in memory, so you can run it without a fixture:

```go
package main

import (
	"fmt"
	"log"

	"github.com/godicom-dev/godicom"
	"github.com/godicom-dev/godicom/tag"
	"github.com/godicom-dev/godicom/uid"
)

func main() {
	ds := godicom.NewDataset()
	if err := ds.SetString(tag.PatientID, "12345678"); err != nil {
		log.Fatal(err)
	}
	if err := ds.SetString(tag.PatientName, "Doe^Jane"); err != nil {
		log.Fatal(err)
	}

	// PS3.10 requires File Meta to name the SOP Class and Instance;
	// EnforceFileFormat fills the File Meta in from the dataset.
	if err := ds.SetString(tag.SOPClassUID, string(uid.CTImageStorage)); err != nil {
		log.Fatal(err)
	}
	if err := ds.SetString(tag.SOPInstanceUID, "1.2.826.0.1.3680043.10.1337.1"); err != nil {
		log.Fatal(err)
	}

	fd := &godicom.FileDataset{Dataset: ds, FileMeta: godicom.NewFileMetaDataset()}
	data, err := godicom.EncodeFile(fd, &godicom.WriteOptions{EnforceFileFormat: true})
	if err != nil {
		log.Fatal(err)
	}

	reread, err := godicom.ReadBytes(data, nil)
	if err != nil {
		log.Fatal(err)
	}
	id, _ := reread.GetString(tag.PatientID)
	name, _ := reread.GetString(tag.PatientName)
	fmt.Println(id, name) // 12345678 Doe^Jane
}
```

::: tip
This is
[`Example`](https://pkg.go.dev/github.com/godicom-dev/godicom#example-package)
in godicom's `example_test.go`, so `go test ./...` compiles it and checks its
output on every commit. A snippet that stops working fails CI instead of
quietly misleading a reader.
:::

## Find out what a file is hiding

By default a read keeps whatever it managed to parse before the file stopped
making sense. That is what most DICOM tooling does, and it is why a corrupt file
so often looks fine. Set `ReadOptions.OnDiagnostic` and you get told:

```go
ds, err := godicom.ReadFile("suspect.dcm", &godicom.ReadOptions{
	OnDiagnostic: func(d godicom.Diagnostic) error {
		log.Printf("%s", d) // return nil: keep parsing
		return nil
	},
})
```

`Diagnostic` is itself an `error`, so returning it rejects the file instead.
[Diagnostics](/godicom/diagnostics) explains what gets reported and why the same
hook exists on the write side.

## Get at the pixels

```go
import "github.com/godicom-dev/godicom/pixels"

ds, err := godicom.ReadFile("mr_j2k.dcm", nil)
if err != nil {
	log.Fatal(err)
}

arr, err := ds.PixelArray(pixels.WithRaw(true)) // decoded samples + shape
frame, err := ds.DisplayFrame(0)                // 8-bit, display-ready
```

Compressed transfer syntaxes decode through the codec modules with no extra
setup. [Pixel Data](/godicom/pixel-data) covers frames, raw versus normalised
output, LUTs, and compression.

## Where to go next

- [godicom overview](/godicom/) — the whole surface of the dataset library
- [Diagnostics](/godicom/diagnostics) — the read and write hooks in detail
- [Pixel Data](/godicom/pixel-data) — decode, display, compress
- [gonetdicom](/gonetdicom/) — move images between machines
- [pkg.go.dev](https://pkg.go.dev/github.com/godicom-dev/godicom) — generated API reference
