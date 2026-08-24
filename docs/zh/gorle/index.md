# gorle

[![Release](https://img.shields.io/github/v/release/godicom-dev/gorle?label=release&color=007d9c)](https://github.com/godicom-dev/gorle/releases)
[![GoDoc](https://pkg.go.dev/badge/github.com/godicom-dev/gorle)](https://pkg.go.dev/github.com/godicom-dev/gorle)

Go 语言的 DICOM **RLE Lossless** —— **纯 Go**，没有 CGO，也没有原生库。

```bash
go get github.com/godicom-dev/gorle
```

与 [pylibjpeg-rle](https://github.com/pydicom/pylibjpeg-rle) 在传输语法
`1.2.840.10008.1.2.5` 上对齐。

三个编解码器 module 里，只有这一个不带嵌入的二进制，所以 Go 能跑的地方它就能跑 —— 没有平台矩阵，首次使用也不用解压。

::: info 你可能并不需要直接用它
[godicom](/zh/godicom/) 已经在用 gorle 处理 RLE 的 Pixel Data，两个方向都是。当你处理的帧在数据集之外，或者需要 segment 级别的 API 时，才需要直接找 gorle。
:::

## 先说 planar configuration {#planar-configuration-first}

RLE 正是 planar configuration 咬人的地方，所以在写任何代码之前值得先讲清楚：

| 方向 | 像素排布 |
|-----------|--------------|
| `EncodeFrame` / `EncodePixelData` 的**输入** | planar configuration **0** —— `R1,G1,B1,R2,G2,B2,…` |
| `DecodeFrame` / `DecodePixelData` 的**输出** | planar configuration **1** —— 先全部 R，再全部 G，再全部 B |

这个搞错了，得到的图像会解码时不报错、看起来像噪声。如果你看到的就是这个，这张表是第一个该查的地方。

支持：`SamplesPerPixel` 为 1 或 3；`BitsAllocated` 为 1、8、16、32、64。

## 解码一个封装帧 {#decode-one-encapsulated-frame}

`nrPixels` 传的是 `rows * columns` —— 像素个数，**不是**字节长度。要字节长度的话，`UnpackedFrameLength` 会给你：

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

## 编码一帧 {#encode-one-frame}

```go
rows, cols, spp := 64, 64, 3
src := make([]byte, rows*cols*spp*2) // planar config 0, interleaved samples

encoded, err := gorle.EncodeFrame(src, rows, cols, spp, 16, gorle.LittleEndian)
if err != nil {
	log.Fatal(err)
}
```

## Pixel Data 辅助函数 {#pixel-data-helpers}

`DecodePixelData` 和 `EncodePixelData` 对应 pylibjpeg-rle 的
`decode_pixel_data` / `encode_pixel_data`。`PixelDataOptions` 内嵌了
`FrameOptions`，所以几何信息是作为一层嵌套字面量传进去的：

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

## 1 位图像 {#_1-bit-images}

对 `BitsAllocated: 1`，`DecodePixelData` 配上 `PackBits: true`（仅 v2）会返回打包好的位。`EncodePixelData` 打包和未打包的 1 位输入都吃，所以你不必在调用前先归一化。

```go
gorle.PackBits(src, gorle.LittleEndian)
gorle.UnpackBits(src, count, gorle.LittleEndian)
gorle.Packed1BitLength(rows, cols) // bytes a packed frame occupies
```

## Segment API {#the-segment-api}

RLE Lossless 就是最多 15 个 segment 偏移组成的头部，后面跟着 PackBits 编码的各个 segment。当你需要在那一层工作时：

```go
offsets, err := gorle.ParseHeader(frame[:64])
seg, err := gorle.DecodeSegment(frame[offsets[0]:offsets[1]])
row, err := gorle.EncodeRow([]byte{1, 2, 3, 3, 3, 4})
```

## API {#api}

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

## 开发 {#development}

```bash
git clone https://github.com/godicom-dev/gorle.git
cd gorle
go test ./...
```

还有一项可选的、与 Python 实现的交叉校验，没装就跳过 —— 正是它让"与 pylibjpeg-rle 对齐"是一个事实而不是一个愿望：

```bash
pip install pylibjpeg-rle
go test -v ./...
```

## 另见 {#see-also}

- [golibjpeg](/zh/golibjpeg/) —— JPEG 与 JPEG-LS
- [goopenjpeg](/zh/goopenjpeg/) —— JPEG 2000 与 HTJ2K
- [pylibjpeg-rle](https://github.com/pydicom/pylibjpeg-rle) —— 行为参照
