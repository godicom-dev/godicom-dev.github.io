# The ecosystem

The organisation is deliberately split into one module per concern. Nothing is a
plugin you have to register and nothing is optional at build time — the split is
about *who owns what*, so that a bug in JPEG 2000 decoding has one home and the
dataset library does not grow a codec department.

## The modules

| Module | Owns | Latest | Python counterpart |
|--------|------|--------|--------------------|
| [godicom](/godicom/) | Datasets, Part 10 files, transfer syntaxes, the data dictionary, Pixel Data, DICOM JSON, CLI | [![](https://img.shields.io/github/v/release/godicom-dev/godicom?label=&color=007d9c)](https://github.com/godicom-dev/godicom/releases) | [pydicom](https://github.com/pydicom/pydicom) |
| [gonetdicom](/gonetdicom/) | Upper Layer PDUs, association negotiation, DIMSE-C / DIMSE-N, DICOMweb | [![](https://img.shields.io/github/v/release/godicom-dev/gonetdicom?label=&color=007d9c)](https://github.com/godicom-dev/gonetdicom/releases) | [pynetdicom](https://github.com/pydicom/pynetdicom) |
| [goopenjpeg](/goopenjpeg/) | JPEG 2000, HTJ2K | [![](https://img.shields.io/github/v/release/godicom-dev/goopenjpeg?label=&color=007d9c)](https://github.com/godicom-dev/goopenjpeg/releases) | [pylibjpeg-openjpeg](https://github.com/pydicom/pylibjpeg-openjpeg) |
| [golibjpeg](/golibjpeg/) | JPEG (ISO 10918), JPEG-LS (ISO 14495), JPEG XT decode | [![](https://img.shields.io/github/v/release/godicom-dev/golibjpeg?label=&color=007d9c)](https://github.com/godicom-dev/golibjpeg/releases) | [pylibjpeg-libjpeg](https://github.com/pydicom/pylibjpeg-libjpeg) |
| [gorle](/gorle/) | DICOM RLE Lossless | [![](https://img.shields.io/github/v/release/godicom-dev/gorle?label=&color=007d9c)](https://github.com/godicom-dev/gorle/releases) | [pylibjpeg-rle](https://github.com/pydicom/pylibjpeg-rle) |

The version badges read from the GitHub releases, so this table cannot go stale
the way a hand-written version number does.

## Which module pulls in which

```
gonetdicom
 └── godicom
      ├── golibjpeg   ──┐
      ├── goopenjpeg  ──┼── ebitengine/purego  (FFI without CGO)
      └── gorle         │
                        └── pure Go, no native library
```

`golang.org/x/text` is godicom's only other direct dependency; `purego` and
`golang.org/x/sys` arrive indirectly, through the codecs.

## The codecs are not optional

This is worth being blunt about, because it is the one thing about the layout
that surprises people.

godicom's root package imports `godicom/pixels`, and `pixels` imports all three
codec modules unconditionally — no build tags, no registration hook. So:

```bash
go get github.com/godicom-dev/godicom
```

pulls **golibjpeg, goopenjpeg and gorle** into your module graph, along with the
prebuilt native libraries that golibjpeg and goopenjpeg embed. You do not opt
in, and you cannot currently opt out.

What you get for that: every transfer syntax works out of the box, on a fresh
machine, with no CMake and no CGO toolchain — which is the whole point of the
purego approach. What it costs: module download size, and a build that is only
as portable as the embedded libraries.

## Platform support of the native codecs

`gorle` is pure Go and runs wherever Go runs. `golibjpeg` and `goopenjpeg` ship
prebuilt shared libraries, and every desktop platform is covered:

| OS | amd64 | arm64 |
|----|-------|-------|
| Linux | ✅ | ✅ |
| macOS | ✅ | ✅ |
| Windows | ✅ | ✅ |

Anywhere else — a 32-bit target, `js/wasm`, a BSD — the codecs still **compile**
and importing them stays safe. Only the compressed transfer syntaxes fail, with
an error wrapping `ErrUnsupportedPlatform`; the library loads lazily on first
use, so nothing panics at program start. If you need a platform outside the
table, open an issue on the codec repository rather than on godicom — that is
where the build matrix lives.

## No CGO for callers

Both native codecs load their library through
[`ebitengine/purego`](https://github.com/ebitengine/purego) rather than CGO. The
library itself is embedded with `//go:embed` and extracted on first use. For you
that means:

- `CGO_ENABLED=0` builds work
- no C toolchain, no CMake, no `pkg-config`
- cross-compiling stays as easy as it is for pure Go, within the platform matrix above

Rebuilding the native libraries is a maintainer activity, done in each codec
repository's CI, and the result is committed so that `go get` users never touch
it.

## Alignment with pydicom

Each module is developed against its Python counterpart, with the reference
project vendored as a read-only submodule and its test fixtures reused. The
point is not to be a transliteration of Python — the APIs are Go APIs — but to
be *checked* against something other than its own opinion of what DICOM means.

godicom keeps a coverage map in
[PARITY.md](https://github.com/godicom-dev/godicom/blob/main/PARITY.md) and
lists deliberately deferred work in
[TODO.md](https://github.com/godicom-dev/godicom/blob/main/TODO.md).

## What lives where

If you are not sure which repository your question belongs to:

| You want to | Module |
|-------------|--------|
| Read or write a `.dcm` file | godicom |
| Get pixels out of a compressed image | godicom (`PixelArray`, `PixelFrames`) |
| Compress Pixel Data into a new transfer syntax | godicom (`CompressPixelData`) |
| Send images to a PACS, or receive them | gonetdicom |
| Query a PACS (C-FIND, QIDO-RS) | gonetdicom |
| Decode a bare `.j2k` / `.jpg` file that is not in a DICOM dataset | goopenjpeg / golibjpeg |
| Report a decoder bug on a specific codestream | the codec module |
| Handle a specific SOP class, DICOMDIR, or structured reporting | none of them yet — see godicom's TODO |
