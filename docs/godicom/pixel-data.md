# Pixel Data

Everything on this page hangs off a `*FileDataset` and the
[`pixels`](https://pkg.go.dev/github.com/godicom-dev/godicom/pixels) package.
Compressed transfer syntaxes decode through the codec modules with no
registration step and no build tags — see
[the ecosystem page](/ecosystem#the-codecs-are-not-optional) for what that costs
you.

```go
import "github.com/godicom-dev/godicom/pixels"
```

## Four ways to ask for pixels

| Method | Returns | Use when |
|--------|---------|----------|
| `PixelBytes` | all frames concatenated, `[]byte` | you want the bytes, in native precision |
| `PixelFrames` | `[][]byte`, one entry per frame | you process frame by frame |
| `PixelSamples` | `[]float64`, one per sample | you are going to do arithmetic on them |
| `PixelArray` | `*pixels.Array` — samples plus geometry | you want pydicom's `pixel_array` |

```go
ds, err := godicom.ReadFile("mr_j2k.dcm", nil)
if err != nil {
	log.Fatal(err)
}

raw, err := ds.PixelBytes(pixels.WithRaw(true))
frames, err := ds.PixelFrames(pixels.WithRaw(true))
one, err := ds.PixelFrames(pixels.WithRaw(true), pixels.WithFrameIndex(0))
arr, err := ds.PixelArray()
```

`pixels.Array` carries the shape with the data, so you never have to re-derive it
from the dataset:

```go
type Array struct {
	Samples         []float64
	Frames          int
	Rows            int
	Columns         int
	SamplesPerPixel int
}
```

The geometry matches pydicom's `pixel_array` shapes.

## Raw versus normalised

This is the one option that changes what the bytes *mean*.

- **`WithRaw(true)`** — exactly what the decoder produced. No colour transform,
  no planar rearrangement.
- **`WithRaw(false)`** (the default) — photometric transforms applied: YBR→RGB,
  planar configuration 1 → interleaved.

Neither applies Modality or VOI LUTs. Those are **not** automatic — see below.

```go
raw, err := ds.PixelBytes(pixels.WithRaw(true))  // decoder output
disp, err := ds.PixelBytes()                     // YBR→RGB, interleaved
```

Decode options: `pixels.WithRaw`, `pixels.WithFrameIndex`, `pixels.WithLogger`.

## Display-ready bytes

`DisplayFrame` is the whole display pipeline in one call. It returns one frame as
8-bit colour-by-pixel bytes, suitable for handing straight to a JPEG or PNG
encoder, after applying Modality LUT / rescale, VOI LUT / windowing, and
Presentation LUT Shape where present:

```go
frame, err := ds.DisplayFrame(0)

frame, err = ds.DisplayFrame(0,
	pixels.WithDisplayWindowIndex(1), // which Window Center/Width pair
	pixels.WithPreferVOILUT(true),    // VOI LUT over windowing when both exist
)
```

## Applying LUTs yourself

When you want the intermediate values rather than 8-bit output, the stages are
separate:

```go
samples, err := ds.PixelSamples(pixels.WithRaw(true))
if err != nil {
	log.Fatal(err)
}

samples, err = ds.ApplyModalityLUT(samples)         // rescale slope/intercept or LUT
samples, err = ds.ApplyVOILUT(samples, 0, false)    // window index, prefer LUT
samples, err = ds.ApplyPresentationLUTShape(samples)
```

The `pixels` package has the same operations as free functions, for when you have
samples that did not come from a dataset. They take their parameters explicitly
rather than reading them off a dataset, so `ApplyModalityLUT` wants a
`ModalityParams`, `ApplyVOILUT` a `VOIParams`, `ApplyWindowing` a `WindowConfig`,
and `ApplyVOI` a `LUT`: `ApplyRescale`, `ApplyWindowing`, `ApplyVOI`,
`ApplyVOILUT`, `ApplyModalityLUT`, `ApplyPresentationLUTShape`, `InvertValues`,
`PackDisplayU8`.

## Layout and colour helpers

```go
pixels.ConvertColorSpace(src, "YBR_FULL_422", "RGB", 8)
pixels.PlanarToColorByPixel(src, rows, columns, samples, bytesPerSample)
pixels.ColorByPixelToPlanar(src, rows, columns, samples, bytesPerSample)
pixels.ExpandYBR422(src, bitsAllocated)
pixels.UnpackSamples(data, bitsAllocated, pixelRepresentation, littleEndian)
```

## Describing an image without a dataset

`pixels.Descriptor` is the set of attributes a decoder needs. You can build one
from a dataset, or fill it in yourself and call the frame-level functions
directly:

```go
desc, err := pixels.DescriptorFromFile(ds)
// or: pixels.DescriptorFromDataset(ds.Dataset, ts)

out, err := pixels.DecodeFrame(frame, desc, pixels.DecodeOptions{})
enc, err := pixels.EncodeFrame(src, desc, uid.RLELossless)
```

`Descriptor` also answers the two questions that are easy to get wrong:
`BytesPerSample()` and `UnpackedFrameBytes()`.

## Compressing Pixel Data

```go
err := ds.CompressPixelData(uid.RLELossless)
err = ds.CompressPixelData(uid.JPEGLSLossless)
err = ds.CompressPixelData(uid.JPEG2000Lossless)
err = ds.CompressPixelData(uid.JPEG2000)        // lossy JPEG 2000
err = ds.CompressPixelData(uid.HTJ2KLossless)   // .201, LRCP
```

`CompressPixelData` re-encodes the current Pixel Data and updates both the
*Pixel Data* element and the *Transfer Syntax UID* in the File Meta, so the result
is a coherent dataset, not bytes you then have to reconcile with the header.
Source frames are decoded with `Raw=true`, so no photometric post-processing is
baked into the compressed result. It is a `*FileDataset` method — a bare
`*Dataset` has no File Meta to keep in step.

Encode targets:

| Target | UID |
|--------|-----|
| Uncompressed (native) | Implicit / Explicit VR |
| RLE Lossless | `1.2.840.10008.1.2.5` |
| Deflated Image Frame Compression | `1.2.840.10008.1.2.8.1` |
| JPEG Baseline / Extended / Lossless | `.50`, `.51`, `.57`, `.70` |
| JPEG-LS Lossless / Near-Lossless | `.80`, `.81` |
| JPEG 2000 Lossless / lossy | `.90`, `.91` |
| HTJ2K Lossless LRCP / Lossless RPCL / lossy | `.201`, `.202`, `.203` |

Encode options — `pixels.EncodeOption` values, passed variadically:
`pixels.WithEncodeTransferSyntax`, `pixels.WithBasicOffsetTable`.

For full control over the encoded result, encode the frames yourself and install
them. `EncodeFrames` takes the options as a struct rather than variadically, and
returns a `*pixels.EncodedPixelData` — the Pixel Data bytes plus the transfer
syntax and offset tables that have to agree with them:

```go
encoded, err := pixels.EncodeFrames(frames, desc, pixels.EncodeOptions{
	TransferSyntaxUID: uid.RLELossless,
})
if err != nil {
	log.Fatal(err)
}
if err := ds.SetEncodedPixelData(encoded); err != nil {
	log.Fatal(err)
}
```

## Encapsulation framing

The [`encaps`](https://pkg.go.dev/github.com/godicom-dev/godicom/encaps) package
is the item-and-fragment layer underneath encapsulated Pixel Data — the Basic
Offset Table, the Extended Offset Table, and the fragmentation of frames into
items. Its behaviour aligns with `pydicom.encaps`.

```go
pd, err := encaps.Encapsulate(frames, 1, true) // one fragment per frame, with BOT
pd, offsets, lengths, err := encaps.EncapsulateExtended(frames)

frame, err := encaps.GetFrame(pixelData, 0, encaps.FramesOptions{})
all, err := encaps.GenerateFrames(pixelData, encaps.FramesOptions{})
offsets, rest, err := encaps.ParseBasicOffsets(buf, true)
```

`FragmentFrame`, `ItemizeFragment`, `CountFragments` and
`GenerateFragmentedFrames` are there for the fragment level below that.

You need this only when you are assembling or dissecting Pixel Data by hand;
`PixelFrames` and `CompressPixelData` use it for you.
