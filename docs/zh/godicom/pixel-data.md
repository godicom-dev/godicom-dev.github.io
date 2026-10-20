# Pixel Data

本页讲的都是 `*FileDataset` 和
[`pixels`](https://pkg.go.dev/github.com/godicom-dev/godicom/pixels) 包上的方法。压缩传输语法由编解码器模块解码，不用注册，也没有 build tag。这么做的代价见
[生态总览](/zh/ecosystem#the-codecs-are-not-optional)。

```go
import "github.com/godicom-dev/godicom/pixels"
```

## 取像素的四种方式 {#four-ways-to-ask-for-pixels}

| 方法 | 返回 | 什么时候用 |
|--------|---------|----------|
| `PixelBytes` | 所有帧拼接起来的 `[]byte` | 你要的是字节，按原生精度 |
| `PixelFrames` | `[][]byte`，一帧一项 | 你逐帧处理 |
| `PixelSamples` | `[]float64`，一个采样一项 | 接下来要做计算 |
| `PixelArray` | `*pixels.Array` —— 采样加几何信息 | 要的是 pydicom 的 `pixel_array` |

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

`pixels.Array` 把形状和数据放在一起，不用再从数据集里算一遍：

```go
type Array struct {
	Samples         []float64
	Frames          int
	Rows            int
	Columns         int
	SamplesPerPixel int
}
```

帧数、行数、列数和每像素采样数，与 pydicom `pixel_array` 的 shape 一致。

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

`DisplayFrame` 一次走完显示流程。它返回一帧 8 位、按像素交织的字节，可以直接交给 JPEG 或 PNG 编码器。里面已经做了 Modality LUT / rescale、VOI LUT / windowing，有 Presentation LUT Shape 时也会用上：

```go
frame, err := ds.DisplayFrame(0)

frame, err = ds.DisplayFrame(0,
	pixels.WithDisplayWindowIndex(1), // which Window Center/Width pair
	pixels.WithPreferVOILUT(true),    // VOI LUT over windowing when both exist
)
```

`PALETTE COLOR` 图像不走上面这条灰度流水线。`DisplayFrame` 用它自己的颜色查找表展开，16 位表项保留高字节。`ApplyColorLUT` 返回完整位深的样本，表可以来自数据集，也可以用八个标准调色板（`PET`、`HOT_IRON`、`SPRING` 等）的名字或 SOP Instance UID：

```go
samples, err := ds.PixelSamples(pixels.WithRaw(true))
rgb, err := godicom.ApplyColorLUT(samples, ds, "")
rgb, err = godicom.ApplyColorLUT(samples, nil, "PET")
```

补充调色板和增强调色板暂不支持。

## Overlay {#overlays}

`OverlayArray` 把一个 1 位 Overlay Plane 拆成 0/1 掩码。`group` 是重复组号，第一层是 `0x6000`，范围是 `0x6000` 到 `0x60FF`：

```go
ov, err := ds.OverlayArray(0x6000)
if err != nil {
	log.Fatal(err)
}
bit := ov.At(0, row, col) // 0 或 1
```

`Samples` 每个像素一个字节，按行优先，值只有 0 或 1。多帧按帧序拼在一起，和 pydicom 的 `overlay_array` 一样，布局是 `(frames, rows, columns)`。没有 Number of Frames in Overlay `(60xx,0015)` 时按 1 帧。位从每个字节的最低位开始拆。

嵌在 Pixel Data 里的 overlay 位目前不支持。

## 自己应用 LUT {#applying-luts-yourself}

要的是中间值而不是 8 位输出时，每一步都可以单独调用：

```go
samples, err := ds.PixelSamples(pixels.WithRaw(true))
if err != nil {
	log.Fatal(err)
}

samples, err = ds.ApplyModalityLUT(samples)         // rescale slope/intercept or LUT
samples, err = ds.ApplyVOILUT(samples, 0, false)    // window index, prefer LUT
samples, err = ds.ApplyPresentationLUTShape(samples)
```

`pixels` 包里也有同样的函数，采样不必来自数据集。参数要自己传，不会去数据集里读：`ApplyModalityLUT` 要一个 `ModalityParams`，`ApplyVOILUT` 要一个 `VOIParams`，`ApplyWindowing` 要一个 `WindowConfig`，`ApplyVOI` 要一个 `LUT`。函数有 `ApplyRescale`、`ApplyWindowing`、`ApplyVOI`、`ApplyVOILUT`、`ApplyModalityLUT`、`ApplyPresentationLUTShape`、`InvertValues`、`PackDisplayU8`。

## 排布与色彩辅助函数 {#layout-and-colour-helpers}

```go
pixels.ConvertColorSpace(src, "YBR_FULL_422", "RGB", 8)
pixels.PlanarToColorByPixel(src, rows, columns, samples, bytesPerSample)
pixels.ColorByPixelToPlanar(src, rows, columns, samples, bytesPerSample)
pixels.ExpandYBR422(src, bitsAllocated)
pixels.UnpackSamples(data, bitsAllocated, pixelRepresentation, littleEndian)
```

## 没有数据集时怎么描述一幅图 {#describing-an-image-without-a-dataset}

`pixels.Descriptor` 是解码器需要的那组属性。可以从数据集构造，也可以自己填好，然后直接调用帧一级的函数：

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

`CompressPixelData` 会重新编码当前的 Pixel Data，并同时改 *Pixel Data* 元素和 File Meta 里的 *Transfer Syntax UID*。得到的是一份前后一致的数据集，不用再拿字节去对文件头。源帧按 `Raw=true` 解码，光度变换不会写进压缩结果。这是 `*FileDataset` 的方法，裸 `*Dataset` 没有 File Meta 可以一起改。

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
