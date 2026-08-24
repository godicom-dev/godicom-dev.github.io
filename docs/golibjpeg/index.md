# golibjpeg

[![Release](https://img.shields.io/github/v/release/godicom-dev/golibjpeg?label=release&color=007d9c)](https://github.com/godicom-dev/golibjpeg/releases)
[![GoDoc](https://pkg.go.dev/badge/github.com/godicom-dev/golibjpeg)](https://pkg.go.dev/github.com/godicom-dev/golibjpeg)

JPEG for Go — baseline and lossless JPEG, JPEG-LS, and JPEG XT decode; JPEG and
JPEG-LS encode. **No CGO** for callers.

```bash
go get github.com/godicom-dev/golibjpeg
```

| Format | Standard | Decode | Encode |
|--------|----------|--------|--------|
| JPEG | ISO 10918-1 (baseline / lossless) | ✅ | ✅ |
| JPEG-LS | ISO 14495 (lossless / near-lossless) | ✅ | ✅ |
| JPEG XT | ISO 18477 (HDR) | ✅ | — |

Aligned with
[pylibjpeg-libjpeg](https://github.com/pydicom/pylibjpeg-libjpeg)'s
`libjpeg.utils`.

::: info You may not need this directly
[godicom](/godicom/) already uses golibjpeg for JPEG and JPEG-LS Pixel Data.
Reach for golibjpeg itself when you have a JPEG that is not inside a DICOM
dataset, or want encoder parameters godicom does not expose.
:::

## Decode

`stream` may be a `[]byte`, a file path (`string`), or an `io.Reader`.

```go
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/godicom-dev/golibjpeg"
)

func main() {
	data, err := os.ReadFile("image.jpg")
	if err != nil {
		log.Fatal(err)
	}

	img, err := golibjpeg.Decode(data) // format auto-detected
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%dx%d, %d components, precision %d\n",
		img.Width, img.Height, img.Components, img.Precision)

	_ = img.Pixels // RGB, or grayscale if the source is
}
```

Forcing a format, when the bytes are ambiguous or you already know:

```go
img, err := golibjpeg.DecodeWithFormat(data, golibjpeg.FormatJPEGLS)
```

Or with a colour transform, matching the Python default of `0`:

```go
img, err := golibjpeg.DecodeImage(data, golibjpeg.ColourTransformNone)
```

`ColourTransform` values: `ColourTransformNone` (0), `ColourTransformYCbCr` (1),
`ColourTransformRCT` (2), `ColourTransformFreeform` (3).

## Parameters without pixels

```go
params, err := golibjpeg.GetParameters(data)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%dx%d, %d components, precision %d\n",
	params.Width, params.Height, params.Components, params.Precision)
```

## Encode

Baseline JPEG, lossy — `Quality` is the usual 1–100 knob:

```go
out, err := golibjpeg.Encode(pixels, golibjpeg.EncodeOptions{
	Columns: 512, Rows: 512, SamplesPerPixel: 3, BitsPerSample: 8,
	FrameType:       golibjpeg.FrameBaseline,
	ColourTransform: golibjpeg.ColourTransformYCbCr,
	Quality:         90,
})
```

JPEG-LS, lossless — no quality, and 16-bit samples are fine:

```go
out, err := golibjpeg.Encode(frame, golibjpeg.EncodeOptions{
	Columns: 512, Rows: 512, SamplesPerPixel: 1, BitsPerSample: 16,
	FrameType:      golibjpeg.FrameJPEGLS,
	LSInterleaving: golibjpeg.LSInterleaveSample,
})
```

Input is interleaved little-endian pixels.

## API

```go
// Decode JPEG / JPEG-LS / JPEG XT
func DecodeImage(stream any, colourTransform ColourTransform) (*Image, error)

// Encode interleaved little-endian pixels to JPEG / JPEG-LS
func Encode(src []byte, opts EncodeOptions) ([]byte, error)

// DICOM encapsulated pixel data
func DecodePixelData(src []byte, opts PixelDataOptions) ([]byte, error)
func EncodePixelData(src []byte, desc PixelDataDescriptor, opts EncodePixelDataOptions) ([]byte, error)

// Parameters without decoding
func GetImageParameters(stream any) (*Params, error)

// Shorthands
func Decode(data []byte) (*Image, error)
func GetParameters(data []byte) (*Params, error)
```

## How it works, and what that costs

Go wraps a C++ shared library through
[`purego`](https://github.com/ebitengine/purego) rather than CGO. The library is
embedded per platform with `//go:embed` and extracted to a temp directory on first
use. The C++ decode logic follows pylibjpeg-libjpeg (`lib/interface/` plus
[thorfdbg/libjpeg](https://github.com/thorfdbg/libjpeg)).

Decoding is stripe-based — eight lines at a time — which keeps memory pressure
down on large images. Output is native precision, 8- or 16-bit,
planar-interleaved.

The cost is the same as for [goopenjpeg](/goopenjpeg/): it runs only where a
library has been built.

| OS | amd64 | arm64 |
|----|-------|-------|
| Linux | ✅ | ✅ |
| macOS | — | ✅ |
| Windows | ✅ | — |

## Repository layout

```
golibjpeg.go          # public API
native/               # purego loader + embedded prebuilt libs
lib/
  libjpeg/            # submodule → thorfdbg/libjpeg
  interface/          # decode + streamhook, from pylibjpeg-libjpeg
  capi/               # C ABI for purego
ref/pylibjpeg-libjpeg # read-only reference submodule
testdata/             # optional conformance JPEGs
```

```bash
git clone --recurse-submodules https://github.com/godicom-dev/golibjpeg.git
cd golibjpeg
go test ./...
```

The libraries in `native/libs/` are **not** built locally by default. CI builds
them when `lib/**` changes on `main` and commits the result, which is what lets
`go get` work with no CMake:

```bash
gh workflow run build-libs.yml   # rebuild on CI without touching lib/
make build-native                # or build locally, requires CMake
```

The reference tests in `reference_compliance_test.go` mirror
pylibjpeg-libjpeg's `test_parameters.py` and `test_decode.py` over its 23-image
`REF_JPG` table. The images are fetched, not vendored:

```bash
bash scripts/fetch-testdata.sh
go test ./...
```

## See also

- [goopenjpeg](/goopenjpeg/) — JPEG 2000 and HTJ2K
- [gorle](/gorle/) — DICOM RLE Lossless, pure Go
- [pylibjpeg-libjpeg](https://github.com/pydicom/pylibjpeg-libjpeg) — decode behaviour and tests
- [pylibjpeg](https://github.com/pydicom/pylibjpeg) — the plugin-style integration model pydicom uses
