# godicom

[![Release](https://img.shields.io/github/v/release/godicom-dev/godicom?label=release&color=007d9c)](https://github.com/godicom-dev/godicom/releases)
[![CI](https://github.com/godicom-dev/godicom/actions/workflows/ci.yml/badge.svg)](https://github.com/godicom-dev/godicom/actions/workflows/ci.yml)
[![GoDoc](https://pkg.go.dev/badge/github.com/godicom-dev/godicom)](https://pkg.go.dev/github.com/godicom-dev/godicom)

*godicom* reads, modifies and writes [DICOM](https://www.dicomstandard.org/)
data from Go. It is the foundation the rest of the organisation is built on.

```bash
go get github.com/godicom-dev/godicom@latest
```

## What it is

A general-purpose DICOM framework concerned with **datasets** — the bytes on
disk, the encoding rules, the data dictionary, and the Pixel Data inside. It is
the Go counterpart to [pydicom](https://github.com/pydicom/pydicom), developed
against pydicom's source and test fixtures rather than against its own idea of
what the standard says.

## What it deliberately is not

To keep the project manageable it does not handle:

- **DICOM networking** — DIMSE, DICOMweb, PACS interaction. That is
  [gonetdicom](/gonetdicom/).
- **The specifics of individual SOP classes** — no per-modality IOD validation,
  no DICOMDIR / file-set handling, no structured reporting object model.

Those are not oversights; they are recorded as out-of-scope or deferred in
[TODO.md](https://github.com/godicom-dev/godicom/blob/main/TODO.md), with the
rule that they do not get started without a real consumer.

## Packages

| Package | What it holds |
|---------|---------------|
| [`godicom`](https://pkg.go.dev/github.com/godicom-dev/godicom) | `Dataset`, `FileDataset`, `DataElement`, read/write entry points, `ReadOptions` / `WriteOptions`, `Diagnostic` |
| [`tag`](https://pkg.go.dev/github.com/godicom-dev/godicom/tag) | Tag constants and keyword lookup — `tag.PatientName`, `tag.Parse`, `tag.Keyword` |
| [`uid`](https://pkg.go.dev/github.com/godicom-dev/godicom/uid) | UID constants, the UID dictionary, and `GenerateUID` |
| [`pixels`](https://pkg.go.dev/github.com/godicom-dev/godicom/pixels) | Native and encapsulated Pixel Data decoding, LUTs, colour-space conversion, display packing |
| [`encaps`](https://pkg.go.dev/github.com/godicom-dev/godicom/encaps) | Encapsulated Pixel Data framing — Basic Offset Table, fragments, `Encapsulate` / `GenerateFrames` |
| [`dicomjson`](https://pkg.go.dev/github.com/godicom-dev/godicom/dicomjson) | The DICOM JSON Model, including BulkDataURI handling |
| [`cmd/godicom`](https://pkg.go.dev/github.com/godicom-dev/godicom/cmd/godicom) | The CLI |

## On this site

- **[Datasets](/godicom/datasets)** — reading, writing, getters and setters,
  sequences, and the encoding options
- **[Diagnostics](/godicom/diagnostics)** — what a truncated or malformed file
  tells you, and the matching hook on the way out
- **[Pixel Data](/godicom/pixel-data)** — frames, raw versus display output,
  LUTs, compression
- **[DICOM JSON](/godicom/json)** — the JSON Model, both directions
- **[Logging](/godicom/logging)** — `log/slog`, and the attribute keys the
  reader emits
- **[CLI](/godicom/cli)** — `godicom show`, `read`, `readcopy`

## Transfer syntax support

| Transfer Syntax | Read | Write |
|-----------------|------|-------|
| Explicit / Implicit VR Little Endian | ✅ | ✅ |
| Explicit VR Big Endian | ✅ | ✅ |
| Deflated Explicit VR Little Endian | ✅ | ✅ |
| RLE Lossless | ✅ | ✅ |
| JPEG Baseline / Extended / Lossless | ✅ | ✅ |
| JPEG-LS | ✅ | ✅ |
| JPEG 2000 / HTJ2K | ✅ | ✅ |

## Platforms and binary size

godicom builds and runs anywhere Go does. The native codecs ship prebuilt
libraries for six platforms — `linux/amd64`, `linux/arm64`, `darwin/amd64`,
`darwin/arm64`, `windows/amd64`, `windows/arm64` — and everywhere else reading
and writing still work, with only the four native-codec transfer syntaxes
returning an error wrapping `ErrUnsupportedPlatform`. See
[the ecosystem page](../ecosystem.md) for the degradation story in full.

A binary carries **one platform's libraries, never all twelve**. The `//go:embed`
directives sit behind per-platform build tags, so the linker only ever sees the
pair for the target being built:

| `cmd/godicom`, `go build` | Size | Embedded libraries |
|---------------------------|------|--------------------|
| linux/amd64   | 11.0 MB | 3.7 MB |
| linux/arm64   | 10.4 MB | 3.4 MB |
| darwin/amd64  | 10.4 MB | 2.7 MB |
| darwin/arm64  |  9.8 MB | 2.3 MB |
| windows/amd64 | 10.5 MB | 2.6 MB |
| windows/arm64 |  9.8 MB | 2.4 MB |
| js/wasm       |  8.3 MB | none |
| linux/386     |  6.4 MB | none |

All twelve libraries together are 17.0 MB, so embedding them unconditionally
would add about 13.3 MB to every binary — a `linux/amd64` build would be 24.3 MB
instead of 11.0 MB. To confirm what your own build embeds:

```bash
go list -f '{{.EmbedFiles}}' github.com/godicom-dev/golibjpeg/native
```

There is no cgo and no toolchain to install; the libraries load through purego,
so a plain `go build` is all a cross-compile takes.

CI cross-builds every release for `windows/386`, `linux/386`, `linux/arm`
(including `GOARM=5`), `linux/riscv64`, `linux/ppc64le`, `js/wasm` and
`wasip1/wasm`, and runs the full test suite on 32-bit — a DICOM value length is
unsigned 32 bits, so 32-bit targets are where width mistakes surface.
`linux/mips` and `linux/mipsle` do not build, because purego does not support
them yet.

## Repository documents

The generated API reference is the authority on signatures; these are the
authority on intent:

- [pkg.go.dev](https://pkg.go.dev/github.com/godicom-dev/godicom) — full API reference
- [CHANGELOG.md](https://github.com/godicom-dev/godicom/blob/main/CHANGELOG.md) — what changed, release by release
- [PARITY.md](https://github.com/godicom-dev/godicom/blob/main/PARITY.md) — coverage map against pydicom, per domain
- [TODO.md](https://github.com/godicom-dev/godicom/blob/main/TODO.md) — deferred and out-of-scope work

## Test fixtures

The reference fixtures are a git submodule, optional for building but needed to
run the full test suite:

```bash
git clone --recurse-submodules https://github.com/godicom-dev/godicom.git
```
