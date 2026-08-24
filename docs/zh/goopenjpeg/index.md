# goopenjpeg

[![Release](https://img.shields.io/github/v/release/godicom-dev/goopenjpeg?label=release&color=007d9c)](https://github.com/godicom-dev/goopenjpeg/releases)
[![GoDoc](https://pkg.go.dev/badge/github.com/godicom-dev/goopenjpeg)](https://pkg.go.dev/github.com/godicom-dev/goopenjpeg)

Go 语言的 JPEG 2000 与 HTJ2K —— 解码与编码，调用方**无需 CGO**。

```bash
go get github.com/godicom-dev/goopenjpeg
```

与
[pylibjpeg-openjpeg](https://github.com/pydicom/pylibjpeg-openjpeg) 在这些 DICOM 传输语法上对齐：

| UID | 说明 |
|-----|-------------|
| `1.2.840.10008.1.2.4.90` | JPEG 2000 Lossless Only |
| `1.2.840.10008.1.2.4.91` | JPEG 2000 |
| `1.2.840.10008.1.2.4.201`–`.203` | HTJ2K |

::: info 你可能并不需要直接用它
[godicom](/zh/godicom/) 已经在用 goopenjpeg 处理 JPEG 2000 的 Pixel Data —— `PixelArray` 和 `CompressPixelData` 都走它。当你手上的 codestream 不在 DICOM 数据集里，或者你想用 godicom 没暴露出来的编码器参数时，才需要直接找 goopenjpeg。
:::

## 解码 {#decode}

`stream` 可以是 `[]byte`、文件路径（`string`）或 `io.Reader`。

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

JP2 文件，或任何别的容器，需要点名 codec：

```go
img, err := goopenjpeg.DecodeImage("image.jp2", goopenjpeg.CodecJP2)
```

`Codec` 取值：`CodecJ2K`（0）、`CodecJPT`（1）、`CodecJP2`（2），以及用于编码的 `CodecHTJ2K`。

## 只要参数，不要像素 {#parameters-without-pixels}

当你只需要几何信息 —— 算 buffer 大小、校验头部 —— 就别解码：

```go
params, err := goopenjpeg.GetParameters(data)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%dx%d, %d components, precision %d\n",
	params.Width, params.Height, params.Components, params.Precision)
```

## 读取采样值 {#reading-samples}

```go
b := img.ByteAt(y, x, c)   // 8-bit sample at (y, x), component c
u := img.Uint16At(y, x, c) // 16-bit little-endian
```

## 一个 DICOM 封装帧 {#a-dicom-encapsulated-frame}

`(7FE0,0010)` 里的一个 item：

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

两个版本对应 pylibjpeg 的 `Version.v1` / `Version.v2`。解码路径是同一条；v1 需要 `PhotometricInterpretation`，是为了跟 Python 的签名保持一致。

## 编码 {#encode}

无损 J2K：

```go
enc, err := goopenjpeg.Encode(pixels, goopenjpeg.EncodeOptions{
	Columns: 512, Rows: 512, SamplesPerPixel: 1, BitsStored: 16,
	ColourSpace: goopenjpeg.ColourGray,
	Codec:       goopenjpeg.CodecJ2K,
})
```

### HTJ2K {#htj2k}

OpenJPEG 能*解*HTJ2K 但不能编码，所以编码走
[OpenJPH](https://github.com/aous72/OpenJPH)，与它一起嵌进来。参数由你要对准的那个 DICOM 传输语法决定：

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

有损 J2K 是同一套做法：给 `CompressionRatios`。

## API {#api}

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

## 它怎么工作，代价是什么 {#how-it-works-and-what-that-costs}

原生库按平台预先构建，用 `//go:embed` 嵌在 `native/libs/` 里，并通过
[`purego`](https://github.com/ebitengine/purego) 调用。所以 `go get` 不需要 CMake，`CGO_ENABLED=0` 也能构建。桌面平台已经全覆盖：

| 操作系统 | amd64 | arm64 |
|----|-------|-------|
| Linux | ✅ | ✅ |
| macOS | ✅ | ✅ |
| Windows | ✅ | ✅ |

表外的平台上这个 module 依然**能构建** —— 只是不能解码或编码。每个函数都会返回一个包装了 `ErrUnsupportedPlatform` 的 error，所以一个 import 了 `goopenjpeg`（或者 import 了 godicom，它又依赖 goopenjpeg）的程序，在没有预编译库的平台上照样能编译、能运行，只有 JPEG 2000 会失败：

```go
img, err := goopenjpeg.Decode(data)
if errors.Is(err, goopenjpeg.ErrUnsupportedPlatform) {
	// no library for this GOOS/GOARCH; err names which one
}
```

加载是惰性的，永远不 panic，所以只读或者带 `noexec` 的 `TMPDIR` 也是同样的表现 —— 第一次调用时返回 error，而不是启动即崩。CI 会为表外的一批平台做交叉编译（`js/wasm` 也在内），保证这条一直成立。

## 仓库结构 {#repository-layout}

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

CI 构建原生库、在 `main` 上把它们提交进 `native/libs/`、对着它们跑测试，并把各平台的库挂到打了 tag 的 release 上。正是那一步提交，让 `go get` 不需要工具链。

## 另见 {#see-also}

- [golibjpeg](/zh/golibjpeg/) —— 同一套架构，面向 ISO 10918 / JPEG-LS
- [gorle](/zh/gorle/) —— DICOM RLE Lossless，纯 Go
- [pylibjpeg-openjpeg](https://github.com/pydicom/pylibjpeg-openjpeg) —— 行为与测试参照
