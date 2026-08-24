# goopenjpeg

[![Release](https://img.shields.io/github/v/release/godicom-dev/goopenjpeg?label=release&color=007d9c)](https://github.com/godicom-dev/goopenjpeg/releases)
[![GoDoc](https://pkg.go.dev/badge/github.com/godicom-dev/goopenjpeg)](https://pkg.go.dev/github.com/godicom-dev/goopenjpeg)

JPEG 2000 and HTJ2K for Go — decode and encode, **no CGO** for callers.

```bash
go get github.com/godicom-dev/goopenjpeg
```

Aligned with
[pylibjpeg-openjpeg](https://github.com/pydicom/pylibjpeg-openjpeg) for the DICOM
transfer syntaxes:

| UID | Description |
|-----|-------------|
| `1.2.840.10008.1.2.4.90` | JPEG 2000 Lossless Only |
| `1.2.840.10008.1.2.4.91` | JPEG 2000 |
| `1.2.840.10008.1.2.4.201`–`.203` | HTJ2K |

::: info You may not need this directly
[godicom](/godicom/) already uses goopenjpeg for JPEG 2000 Pixel Data —
`PixelArray` and `CompressPixelData` go through it. Reach for goopenjpeg itself
when you have a codestream that is not inside a DICOM dataset, or when you want
encoder parameters godicom does not expose.
:::

## Decode

`stream` may be a `[]byte`, a file path (`string`), or an `io.Reader`.

```go
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/godicom-dev/goopenjpeg"
)

func main() {
	data, err := os.ReadFile("image.j2k")
	if err != nil {
		log.Fatal(err)
	}

	img, err := goopenjpeg.Decode(data) // shorthand for CodecJ2K
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%dx%d, %d components, precision %d signed=%v\n",
		img.Width, img.Height, img.Components, img.Precision, img.IsSigned)

	_ = img.Pixels // planar-interleaved, native precision
}
```

A JP2 file, or any other container, needs the codec named:

```go
img, err := goopenjpeg.DecodeImage("image.jp2", goopenjpeg.CodecJP2)
```

`Codec` values: `CodecJ2K` (0), `CodecJPT` (1), `CodecJP2` (2), and
`CodecHTJ2K` for encoding.

## Parameters without pixels

When you only need the geometry — sizing a buffer, validating a header — skip the
decode:

```go
params, err := goopenjpeg.GetParameters(data)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%dx%d, %d components, precision %d\n",
	params.Width, params.Height, params.Components, params.Precision)
```

## Reading samples

```go
b := img.ByteAt(y, x, c)   // 8-bit sample at (y, x), component c
u := img.Uint16At(y, x, c) // 16-bit little-endian
```

## A DICOM encapsulated frame

One item from `(7FE0,0010)`:

```go
var j2kFrame []byte

// Version 2: raw decoded bytes, no extra colour handling
raw, err := goopenjpeg.DecodePixelData(j2kFrame, goopenjpeg.PixelDataOptions{
	Version: goopenjpeg.PixelDataV2,
	Codec:   goopenjpeg.CodecJ2K,
})

// Version 1: same decode path; PhotometricInterpretation required for API parity
_, err = goopenjpeg.DecodePixelData(j2kFrame, goopenjpeg.PixelDataOptions{
	Version:                   goopenjpeg.PixelDataV1,
	Codec:                     goopenjpeg.CodecJ2K,
	PhotometricInterpretation: "MONOCHROME2",
})
```

The two versions mirror pylibjpeg's `Version.v1` / `Version.v2`. The decode path
is the same; v1 requires `PhotometricInterpretation` for parity with the Python
signature.

## Encode

Lossless J2K:

```go
enc, err := goopenjpeg.Encode(pixels, goopenjpeg.EncodeOptions{
	Columns: 512, Rows: 512, SamplesPerPixel: 1, BitsStored: 16,
	ColourSpace: goopenjpeg.ColourGray,
	Codec:       goopenjpeg.CodecJ2K,
})
```

### HTJ2K

OpenJPEG *decodes* HTJ2K but does not encode it, so encoding goes through
[OpenJPH](https://github.com/aous72/OpenJPH), embedded alongside it. The DICOM
transfer syntax you are targeting decides the parameters:

```go
// .201 HTJ2K Lossless (LRCP)
enc, err := goopenjpeg.Encode(pixels, goopenjpeg.EncodeOptions{
	Columns: 512, Rows: 512, SamplesPerPixel: 1, BitsStored: 8,
	ColourSpace:      goopenjpeg.ColourGray,
	Codec:            goopenjpeg.CodecHTJ2K,
	ProgressionOrder: goopenjpeg.ProgressionLRCP,
})

// .202 HTJ2K Lossless RPCL
enc, err = goopenjpeg.Encode(pixels, goopenjpeg.EncodeOptions{
	// …
	ProgressionOrder: goopenjpeg.ProgressionRPCL,
})

// .203 HTJ2K, lossy
enc, err = goopenjpeg.Encode(pixels, goopenjpeg.EncodeOptions{
	// …
	CompressionRatios: []float64{10},
})
```

Lossy J2K works the same way: supply `CompressionRatios`.

## API

```go
func DecodeImage(stream any, codec Codec) (*Image, error)
func GetImageParameters(stream any, codec Codec) (*Params, error)
func DecodePixelData(src []byte, opts PixelDataOptions) ([]byte, error)
func Encode(src []byte, opts EncodeOptions) ([]byte, error)
func EncodePixelData(src []byte, opts PixelDataOptions, frame EncodeOptions) ([]byte, error)
func OpenJPEGVersion() (string, error)

func Decode(data []byte) (*Image, error)        // CodecJ2K shorthand
func GetParameters(data []byte) (*Params, error)
```

```go
ver, err := goopenjpeg.OpenJPEGVersion() // e.g. "2.5.4"
```

## How it works, and what that costs

The native libraries are prebuilt per platform, embedded with `//go:embed` in
`native/libs/`, and called through
[`purego`](https://github.com/ebitengine/purego). So `go get` needs no CMake and
`CGO_ENABLED=0` builds work. Every desktop platform is covered:

| OS | amd64 | arm64 |
|----|-------|-------|
| Linux | ✅ | ✅ |
| macOS | ✅ | ✅ |
| Windows | ✅ | ✅ |

Anywhere else the module still **builds** — it just cannot decode or encode.
Every function returns an error wrapping `ErrUnsupportedPlatform`, so a program
that imports `goopenjpeg` (or `godicom`, which does) keeps compiling and running
where no prebuilt library exists, and only JPEG 2000 fails:

```go
img, err := goopenjpeg.Decode(data)
if errors.Is(err, goopenjpeg.ErrUnsupportedPlatform) {
	// no library for this GOOS/GOARCH; err names which one
}
```

Loading is lazy and never panics, so a read-only or `noexec` `TMPDIR` surfaces
the same way — as an error from the first call, not a crash at start-up. CI
cross-builds for a spread of platforms outside the table, `js/wasm` among them,
to keep that true.

## Repository layout

```
goopenjpeg/           # public Go API
native/               # purego + go:embed prebuilt libs
lib/
  openjpeg/           # submodule → uclouvain/openjpeg  (decode + J2K encode)
  openjph/            # submodule → aous72/OpenJPH      (HTJ2K encode)
  interface/          # decode glue, from pylibjpeg-openjpeg
  capi/               # C ABI for purego
ref/pylibjpeg-openjpeg/
```

```bash
git clone --recurse-submodules https://github.com/godicom-dev/goopenjpeg.git
cd goopenjpeg
go test ./...        # uses the prebuilt libs in native/libs/
make build-native    # optional: rebuild OpenJPEG (requires CMake)
```

CI builds the native libraries, commits them to `native/libs/` on `main`, tests
against them, and attaches per-platform libraries to tagged releases. That commit
step is what makes `go get` work without a toolchain.

## See also

- [golibjpeg](/golibjpeg/) — the same architecture for ISO 10918 / JPEG-LS
- [gorle](/gorle/) — DICOM RLE Lossless, pure Go
- [pylibjpeg-openjpeg](https://github.com/pydicom/pylibjpeg-openjpeg) — behaviour and test reference
