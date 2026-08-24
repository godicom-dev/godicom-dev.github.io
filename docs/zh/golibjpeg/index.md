# golibjpeg

[![Release](https://img.shields.io/github/v/release/godicom-dev/golibjpeg?label=release&color=007d9c)](https://github.com/godicom-dev/golibjpeg/releases)
[![GoDoc](https://pkg.go.dev/badge/github.com/godicom-dev/golibjpeg)](https://pkg.go.dev/github.com/godicom-dev/golibjpeg)

Go 语言的 JPEG —— 解码 baseline 与 lossless JPEG、JPEG-LS、JPEG XT；编码 JPEG 与 JPEG-LS。调用方**无需 CGO**。

```bash
go get github.com/godicom-dev/golibjpeg
```

| 格式 | 标准 | 解码 | 编码 |
|--------|----------|--------|--------|
| JPEG | ISO 10918-1（baseline / lossless） | ✅ | ✅ |
| JPEG-LS | ISO 14495（lossless / near-lossless） | ✅ | ✅ |
| JPEG XT | ISO 18477（HDR） | ✅ | — |

与
[pylibjpeg-libjpeg](https://github.com/pydicom/pylibjpeg-libjpeg) 的
`libjpeg.utils` 对齐。

::: info 你可能并不需要直接用它
[godicom](/zh/godicom/) 已经在用 golibjpeg 处理 JPEG 和 JPEG-LS 的 Pixel Data。当你手上的 JPEG 不在 DICOM 数据集里，或者想用 godicom 没暴露出来的编码器参数时，才需要直接找 golibjpeg。
:::

## 解码 {#decode}

`stream` 可以是 `[]byte`、文件路径（`string`）或 `io.Reader`。

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

在字节本身有歧义、或者你已经知道答案时强制指定格式：

```go
img, err := golibjpeg.DecodeWithFormat(data, golibjpeg.FormatJPEGLS)
```

或者带上颜色变换，对应 Python 那边的默认值 `0`：

```go
img, err := golibjpeg.DecodeImage(data, golibjpeg.ColourTransformNone)
```

`ColourTransform` 取值：`ColourTransformNone`（0）、`ColourTransformYCbCr`（1）、`ColourTransformRCT`（2）、`ColourTransformFreeform`（3）。

## 只要参数，不要像素 {#parameters-without-pixels}

```go
params, err := golibjpeg.GetParameters(data)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%dx%d, %d components, precision %d\n",
	params.Width, params.Height, params.Components, params.Precision)
```

## 编码 {#encode}

Baseline JPEG，有损 —— `Quality` 就是常见的那个 1–100 旋钮：

```go
out, err := golibjpeg.Encode(pixels, golibjpeg.EncodeOptions{
	Columns: 512, Rows: 512, SamplesPerPixel: 3, BitsPerSample: 8,
	FrameType:       golibjpeg.FrameBaseline,
	ColourTransform: golibjpeg.ColourTransformYCbCr,
	Quality:         90,
})
```

JPEG-LS，无损 —— 没有 quality，16 位采样也没问题：

```go
out, err := golibjpeg.Encode(frame, golibjpeg.EncodeOptions{
	Columns: 512, Rows: 512, SamplesPerPixel: 1, BitsPerSample: 16,
	FrameType:      golibjpeg.FrameJPEGLS,
	LSInterleaving: golibjpeg.LSInterleaveSample,
})
```

输入是交错排列的小端像素。

## API {#api}

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

## 它怎么工作，代价是什么 {#how-it-works-and-what-that-costs}

Go 这边通过
[`purego`](https://github.com/ebitengine/purego) 而不是 CGO 去包一个 C++ 共享库。库按平台用 `//go:embed` 嵌入，首次使用时解到临时目录。C++ 的解码逻辑跟随 pylibjpeg-libjpeg（`lib/interface/` 加上
[thorfdbg/libjpeg](https://github.com/thorfdbg/libjpeg)）。

解码是按条带来的 —— 一次八行 —— 这让大图上的内存压力保持在低位。输出是原生精度，8 位或 16 位，planar-interleaved。

代价跟 [goopenjpeg](/zh/goopenjpeg/) 一样：只能跑在已经构建过库的平台上。

| 操作系统 | amd64 | arm64 |
|----|-------|-------|
| Linux | ✅ | ✅ |
| macOS | — | ✅ |
| Windows | ✅ | — |

## 仓库结构 {#repository-layout}

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

`native/libs/` 里的库默认**不**在本地构建。当 `main` 上的 `lib/**` 有变动时由 CI 构建并提交结果，这就是 `go get` 不需要 CMake 的原因：

```bash
gh workflow run build-libs.yml   # rebuild on CI without touching lib/
make build-native                # or build locally, requires CMake
```

`reference_compliance_test.go` 里的参照测试，在 pylibjpeg-libjpeg 那张 23 张图的 `REF_JPG` 表上复刻了它的 `test_parameters.py` 和 `test_decode.py`。图片是抓取的，不是 vendored：

```bash
bash scripts/fetch-testdata.sh
go test ./...
```

## 另见 {#see-also}

- [goopenjpeg](/zh/goopenjpeg/) —— JPEG 2000 与 HTJ2K
- [gorle](/zh/gorle/) —— DICOM RLE Lossless，纯 Go
- [pylibjpeg-libjpeg](https://github.com/pydicom/pylibjpeg-libjpeg) —— 解码行为与测试
- [pylibjpeg](https://github.com/pydicom/pylibjpeg) —— pydicom 采用的那种插件式集成模型
