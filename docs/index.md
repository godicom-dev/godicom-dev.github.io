---
layout: home

hero:
  name: godicom-dev
  text: DICOM for Go
  tagline: Read, modify and write DICOM datasets, decode and encode Pixel Data, talk DIMSE and DICOMweb — from idiomatic Go, with no CGO for callers.
  actions:
    - theme: brand
      text: Getting started
      link: /guide/getting-started
    - theme: alt
      text: Browse the modules
      link: /ecosystem
    - theme: alt
      text: GitHub
      link: https://github.com/godicom-dev

features:
  - title: godicom
    details: The dataset library — Part 10 files, transfer syntaxes, the data dictionary, Pixel Data, DICOM JSON, and a CLI. Everything else in the organisation builds on it.
    link: /godicom/
    linkText: Datasets, diagnostics, Pixel Data
  - title: gonetdicom
    details: DICOM networking — association negotiation, DIMSE-C and DIMSE-N as SCU or SCP, TLS, and a DICOMweb client with an origin-server MVP.
    link: /gonetdicom/
    linkText: DIMSE and DICOMweb
  - title: goopenjpeg
    details: JPEG 2000 and HTJ2K, decode and encode. purego plus embedded prebuilt OpenJPEG and OpenJPH — no CMake, no CGO for callers.
    link: /goopenjpeg/
    linkText: JPEG 2000 / HTJ2K
  - title: golibjpeg
    details: Baseline and lossless JPEG, JPEG-LS, JPEG XT decode; JPEG and JPEG-LS encode. Same purego architecture, native 8- and 16-bit precision.
    link: /golibjpeg/
    linkText: JPEG / JPEG-LS
  - title: gorle
    details: DICOM RLE Lossless, pure Go. Frame and pixel-data APIs, PackBits helpers for 1-bit images, and a low-level segment API.
    link: /gorle/
    linkText: RLE Lossless
  - title: Checked against pydicom
    details: Each module is aligned with a Python counterpart — pydicom, pynetdicom, pylibjpeg-openjpeg, pylibjpeg-libjpeg, pylibjpeg-rle — and tested against its behaviour, not just against itself.
    link: /ecosystem
    linkText: How the pieces fit
---

## Read a file, change it, write it back

```go
package main

import (
	"log"

	"github.com/godicom-dev/godicom"
	"github.com/godicom-dev/godicom/tag"
)

func main() {
	ds, err := godicom.ReadFile("ct.dcm", nil)
	if err != nil {
		log.Fatal(err)
	}
	if err := ds.SetString(tag.PatientID, "12345678"); err != nil {
		log.Fatal(err)
	}
	if err := ds.SaveAs("ct_updated.dcm", nil); err != nil {
		log.Fatal(err)
	}
}
```

```bash
go get github.com/godicom-dev/godicom@latest
```

## Where to go next

- **[Getting started](/guide/getting-started)** — install, read your first file, and find out what a malformed one is hiding.
- **[The ecosystem](/ecosystem)** — which module owns what, and which one pulls in which.
- **[godicom](/godicom/)** — the dataset library in detail.
- **[gonetdicom](/gonetdicom/)** — if you need to move images between machines rather than parse them.

::: info About this site
These pages are written against the released versions of each module and link to
[pkg.go.dev](https://pkg.go.dev/github.com/godicom-dev/godicom) for the full API
reference, which is generated from the source and therefore never out of date.
Where the two disagree, pkg.go.dev is right.
:::
