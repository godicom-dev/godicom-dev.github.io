# gorle

[![Release](https://img.shields.io/github/v/release/godicom-dev/gorle?label=release&color=007d9c)](https://github.com/godicom-dev/gorle/releases)
[![GoDoc](https://pkg.go.dev/badge/github.com/godicom-dev/gorle)](https://pkg.go.dev/github.com/godicom-dev/gorle)

DICOM **RLE Lossless** for Go — **pure Go**, no CGO and no native library.

```bash
go get github.com/godicom-dev/gorle
```

Aligned with [pylibjpeg-rle](https://github.com/pydicom/pylibjpeg-rle) for
transfer syntax `1.2.840.10008.1.2.5`.

Of the three codec modules this is the only one with no embedded binary, so it
runs anywhere Go runs — no platform matrix, no extraction on first use.

::: info You may not need this directly
[godicom](/godicom/) already uses gorle for RLE Pixel Data, in both directions.
Reach for gorle itself when you are working on frames outside a dataset, or need
the segment-level API.
:::

## Planar configuration, first

RLE is where planar configuration bites, so it is worth being explicit before any
code:

| Direction | Pixel layout |
|-----------|--------------|
| `EncodeFrame` / `EncodePixelData` **input** | planar configuration **0** — `R1,G1,B1,R2,G2,B2,…` |
| `DecodeFrame` / `DecodePixelData` **output** | planar configuration **1** — all R, then all G, then all B |

Getting this wrong produces an image that decodes without error and looks like
noise. If that is what you are seeing, this table is the first thing to check.

Supported: `SamplesPerPixel` 1 or 3; `BitsAllocated` 1, 8, 16, 32, 64.

## Decode one encapsulated frame

Pass `rows * columns` as `nrPixels` — the pixel count, **not** the byte length.
`UnpackedFrameLength` gives you the byte length if that is what you need:

```go
package main

import (
	"fmt"
	"log"

	"github.com/godicom-dev/gorle"
)

func main() {
	var frame []byte // one item from encapsulated Pixel Data (OB/OW)

	rows, cols := 512, 512
	pixels, err := gorle.DecodeFrame(frame, rows*cols, 16, gorle.LittleEndian)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("decoded %d bytes (planar config 1), expected %d\n",
		len(pixels), gorle.UnpackedFrameLength(rows, cols, 1, 16))
}
```

## Encode one frame

```go
rows, cols, spp := 64, 64, 3
src := make([]byte, rows*cols*spp*2) // planar config 0, interleaved samples

encoded, err := gorle.EncodeFrame(src, rows, cols, spp, 16, gorle.LittleEndian)
if err != nil {
	log.Fatal(err)
}
```

## Pixel data helpers

`DecodePixelData` and `EncodePixelData` mirror pylibjpeg-rle's
`decode_pixel_data` / `encode_pixel_data`. `PixelDataOptions` embeds
`FrameOptions`, so the geometry goes in as a nested literal:

```go
out, err := gorle.DecodePixelData(frame, gorle.PixelDataOptions{
	Version: gorle.PixelDataV2, // raw bytes, like pylibjpeg Version.v2
	FrameOptions: gorle.FrameOptions{
		Rows:          512,
		Columns:       512,
		BitsAllocated: 16,
		ByteOrder:     gorle.LittleEndian,
	},
})

enc, err := gorle.EncodePixelData(pc0Pixels, gorle.PixelDataOptions{
	FrameOptions: gorle.FrameOptions{
		Rows:            512,
		Columns:         512,
		SamplesPerPixel: 1,
		BitsAllocated:   16,
		ByteOrder:       gorle.LittleEndian,
	},
})
```

## 1-bit images

For `BitsAllocated: 1`, `DecodePixelData` with `PackBits: true` (v2 only) returns
packed bits. `EncodePixelData` accepts either packed or unpacked 1-bit input, so
you do not have to normalise before calling it.

```go
gorle.PackBits(src, gorle.LittleEndian)
gorle.UnpackBits(src, count, gorle.LittleEndian)
gorle.Packed1BitLength(rows, cols) // bytes a packed frame occupies
```

## The segment API

RLE Lossless is a header of up to 15 segment offsets followed by PackBits-encoded
segments. When you need to work at that level:

```go
offsets, err := gorle.ParseHeader(frame[:64])
seg, err := gorle.DecodeSegment(frame[offsets[0]:offsets[1]])
row, err := gorle.EncodeRow([]byte{1, 2, 3, 3, 3, 4})
```

## API

```go
// Frames
func DecodeFrame(src []byte, nrPixels, bitsAllocated int, byteOrder ByteOrder) ([]byte, error)
func EncodeFrame(src []byte, rows, cols, spp, bitsAllocated int, byteOrder ByteOrder) ([]byte, error)

// DICOM encapsulated pixel data
func DecodePixelData(src []byte, opts PixelDataOptions) ([]byte, error)
func EncodePixelData(src []byte, opts PixelDataOptions) ([]byte, error)

// Segments and rows
func ParseHeader(src []byte) ([]uint32, error)
func DecodeSegment(src []byte) ([]byte, error)
func EncodeSegment(src []byte, cols int) ([]byte, error)
func EncodeRow(src []byte) ([]byte, error)

// Bit packing and sizes
func PackBits(src []byte, byteOrder ByteOrder) ([]byte, error)
func UnpackBits(src []byte, count int, byteOrder ByteOrder) ([]byte, error)
func Packed1BitLength(rows, cols int) int
func UnpackedFrameLength(rows, cols, spp, bitsAllocated int) int
```

## Development

```bash
git clone https://github.com/godicom-dev/gorle.git
cd gorle
go test ./...
```

There is an optional cross-check against the Python implementation, skipped when
it is not installed — which is how "aligned with pylibjpeg-rle" stays a fact
rather than an intention:

```bash
pip install pylibjpeg-rle
go test -v ./...
```

## See also

- [golibjpeg](/golibjpeg/) — JPEG and JPEG-LS
- [goopenjpeg](/goopenjpeg/) — JPEG 2000 and HTJ2K
- [pylibjpeg-rle](https://github.com/pydicom/pylibjpeg-rle) — behaviour reference
