# Pixel Data

本页所有内容都挂在 `*FileDataset` 和
[`pixels`](https://pkg.go.dev/github.com/godicom-dev/godicom/pixels) 包上。压缩传输语法通过编解码器模块解码，没有注册步骤也没有 build tag —— 这么做的代价见
[生态总览](/zh/ecosystem#the-codecs-are-not-optional)。

```go
import "github.com/godicom-dev/godicom/pixels"
```

## 取像素的四种方式 {#four-ways-to-ask-for-pixels}

| 方法 | 返回 | 什么时候用 |
|--------|---------|----------|
| `PixelBytes` | 所有帧拼接起来的 `[]byte` | 你要的是字节，按原生精度 |
| `PixelFrames` | `[][]byte`，一帧一项 | 你逐帧处理 |
| `PixelSamples` | `[]float64`，一个 sample 一项 | 你接下来要对它们做算术 |
| `PixelArray` | `*pixels.Array` —— sample 加几何信息 | 你要的是 pydicom 的 `pixel_array` |

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

`pixels.Array` 把形状和数据带在一起，所以你永远不必从数据集里再推一遍：

```go
type Array struct {
	Samples         []float64
	Frames          int
	Rows            int
	Columns         int
	SamplesPerPixel int
}
```

这个几何形状与 pydicom `pixel_array` 的 shape 一致。

## 原始与归一化 {#raw-versus-normalised}

这是唯一一个会改变字节*含义*的选项。

- **`WithRaw(true)`** —— 解码器产出的原样。不做色彩变换，不做平面重排。
- **`WithRaw(false)`**（默认）—— 应用光度变换：YBR→RGB，planar configuration 1 → 交织。

两者都不应用 Modality 或 VOI LUT。那些**不是**自动的 —— 见下文。

```go
raw, err := ds.PixelBytes(pixels.WithRaw(true))  // decoder output
disp, err := ds.PixelBytes()                     // YBR→RGB, interleaved
```

解码选项：`pixels.WithRaw`、`pixels.WithFrameIndex`、`pixels.WithLogger`。

## 可直接显示的字节 {#display-ready-bytes}

`DisplayFrame` 把整条显示流水线放进一次调用。它返回一帧 8 位、按像素排列的彩色字节，可以直接交给 JPEG 或 PNG 编码器，其中已应用了 Modality LUT / rescale、VOI LUT / windowing，以及存在时的 Presentation LUT Shape：

```go
frame, err := ds.DisplayFrame(0)

frame, err = ds.DisplayFrame(0,
	pixels.WithDisplayWindowIndex(1), // which Window Center/Width pair
	pixels.WithPreferVOILUT(true),    // VOI LUT over windowing when both exist
)
```

## 自己应用 LUT {#applying-luts-yourself}

当你要的是中间值而不是 8 位输出时，各阶段是分开的：

```go
samples, err := ds.PixelSamples(pixels.WithRaw(true))
if err != nil {
	log.Fatal(err)
}

samples, err = ds.ApplyModalityLUT(samples)         // rescale slope/intercept or LUT
samples, err = ds.ApplyVOILUT(samples, 0, false)    // window index, prefer LUT
samples, err = ds.ApplyPresentationLUTShape(samples)
```

`pixels` 包把同样的操作也提供为自由函数，供你手上的 sample 并非来自数据集时使用。它们的参数是显式传入的，不从数据集里读，所以 `ApplyModalityLUT` 要一个 `ModalityParams`，`ApplyVOILUT` 要一个 `VOIParams`，`ApplyWindowing` 要一个 `WindowConfig`，`ApplyVOI` 要一个 `LUT`：`ApplyRescale`、`ApplyWindowing`、`ApplyVOI`、`ApplyVOILUT`、`ApplyModalityLUT`、`ApplyPresentationLUTShape`、`InvertValues`、`PackDisplayU8`。

## 排布与色彩辅助函数 {#layout-and-colour-helpers}

```go
pixels.ConvertColorSpace(src, "YBR_FULL_422", "RGB", 8)
pixels.PlanarToColorByPixel(src, rows, columns, samples, bytesPerSample)
pixels.ColorByPixelToPlanar(src, rows, columns, samples, bytesPerSample)
pixels.ExpandYBR422(src, bitsAllocated)
pixels.UnpackSamples(data, bitsAllocated, pixelRepresentation, littleEndian)
```

## 不靠数据集来描述一幅图像 {#describing-an-image-without-a-dataset}

`pixels.Descriptor` 是解码器需要的那组属性。你可以从数据集构造一个，也可以自己填好然后直接调用帧级函数：

```go
desc, err := pixels.DescriptorFromFile(ds)
// or: pixels.DescriptorFromDataset(ds.Dataset, ts)

out, err := pixels.DecodeFrame(frame, desc, pixels.DecodeOptions{})
enc, err := pixels.EncodeFrame(src, desc, uid.RLELossless)
```

`Descriptor` 还回答了两个很容易搞错的问题：`BytesPerSample()` 和 `UnpackedFrameBytes()`。

## 压缩 Pixel Data {#compressing-pixel-data}

```go
err := ds.CompressPixelData(uid.RLELossless)
err = ds.CompressPixelData(uid.JPEGLSLossless)
err = ds.CompressPixelData(uid.JPEG2000Lossless)
err = ds.CompressPixelData(uid.JPEG2000)        // lossy JPEG 2000
err = ds.CompressPixelData(uid.HTJ2KLossless)   // .201, LRCP
```

`CompressPixelData` 重新编码当前的 Pixel Data，并同时更新 *Pixel Data* 元素和 File Meta 里的 *Transfer Syntax UID*，所以结果是一个自洽的数据集，而不是一堆你事后还得跟头部对上的字节。源帧按 `Raw=true` 解码，因此不会有任何光度后处理被烘进压缩结果里。它是 `*FileDataset` 的方法 —— 裸 `*Dataset` 没有 File Meta 可供同步。

编码目标：

| 目标 | UID |
|--------|-----|
| 未压缩（native） | Implicit / Explicit VR |
| RLE Lossless | `1.2.840.10008.1.2.5` |
| Deflated Image Frame Compression | `1.2.840.10008.1.2.8.1` |
| JPEG Baseline / Extended / Lossless | `.50`、`.51`、`.57`、`.70` |
| JPEG-LS Lossless / Near-Lossless | `.80`、`.81` |
| JPEG 2000 Lossless / 有损 | `.90`、`.91` |
| HTJ2K Lossless LRCP / Lossless RPCL / 有损 | `.201`、`.202`、`.203` |

编码选项 —— `pixels.EncodeOption` 值，以变参方式传入：`pixels.WithEncodeTransferSyntax`、`pixels.WithBasicOffsetTable`。

要完全控制编码结果，就自己编码这些帧再装回去。`EncodeFrames` 的选项是一个结构体而不是变参，返回一个 `*pixels.EncodedPixelData` —— Pixel Data 字节，加上必须与之一致的传输语法和偏移表：

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

## 封装分帧 {#encapsulation-framing}

[`encaps`](https://pkg.go.dev/github.com/godicom-dev/godicom/encaps) 包是封装 Pixel Data 底下的 item 与 fragment 层 —— Basic Offset Table、Extended Offset Table，以及把帧切成 item 的分片。它的行为与 `pydicom.encaps` 对齐。

```go
pd, err := encaps.Encapsulate(frames, 1, true) // one fragment per frame, with BOT
pd, offsets, lengths, err := encaps.EncapsulateExtended(frames)

frame, err := encaps.GetFrame(pixelData, 0, encaps.FramesOptions{})
all, err := encaps.GenerateFrames(pixelData, encaps.FramesOptions{})
offsets, rest, err := encaps.ParseBasicOffsets(buf, true)
```

再往下的 fragment 层有 `FragmentFrame`、`ItemizeFragment`、`CountFragments` 和 `GenerateFragmentedFrames`。

只有当你在手工装配或拆解 Pixel Data 时才需要这些；`PixelFrames` 和 `CompressPixelData` 已经替你用了。
