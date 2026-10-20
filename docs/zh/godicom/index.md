# godicom

[![Release](https://img.shields.io/github/v/release/godicom-dev/godicom?label=release&color=007d9c)](https://github.com/godicom-dev/godicom/releases)
[![CI](https://github.com/godicom-dev/godicom/actions/workflows/ci.yml/badge.svg)](https://github.com/godicom-dev/godicom/actions/workflows/ci.yml)
[![GoDoc](https://pkg.go.dev/badge/github.com/godicom-dev/godicom)](https://pkg.go.dev/github.com/godicom-dev/godicom)

*godicom* 用 Go 读写 [DICOM](https://www.dicomstandard.org/) 数据。这个组织里的其他库都建立在它上面。

```bash
go get github.com/godicom-dev/godicom@latest
```

## 它是什么 {#what-it-is}

它是一个面向**数据集**的通用 DICOM 库：磁盘上的字节、编码规则、数据字典，以及里面的 Pixel Data。对应的 Python 库是 [pydicom](https://github.com/pydicom/pydicom)。实现和测试都对照 pydicom 的源码和测试数据，而不是只凭我们对标准的理解。

## 它有意不做什么 {#what-it-deliberately-is-not}

为了把范围收住，这些事情它不做：

- **DICOM 网络** —— DIMSE、DICOMweb、和 PACS 通信。那是
  [gonetdicom](/zh/gonetdicom/) 的事。
- **各 SOP Class 自己的业务** —— 不做按模态的 IOD 校验，也没有结构化报告的对象模型。DICOMDIR 可以读，不能写。

这些写在
[TODO.md](https://github.com/godicom-dev/godicom/blob/main/TODO.md) 里，是范围外或暂缓项，不是漏做了。没有真实使用方之前，不会开工。

## 包 {#packages}

| 包 | 内容 |
|---------|---------------|
| [`godicom`](https://pkg.go.dev/github.com/godicom-dev/godicom) | `Dataset`、`FileDataset`、`DataElement`、读写入口、`ReadOptions` / `WriteOptions`、`Diagnostic` |
| [`tag`](https://pkg.go.dev/github.com/godicom-dev/godicom/tag) | 标签常量与关键字查询 —— `tag.PatientName`、`tag.Parse`、`tag.Keyword` |
| [`uid`](https://pkg.go.dev/github.com/godicom-dev/godicom/uid) | UID 常量、UID 字典，以及 `GenerateUID` |
| [`pixels`](https://pkg.go.dev/github.com/godicom-dev/godicom/pixels) | 原生与封装 Pixel Data 解码、LUT、色彩空间转换、显示打包 |
| [`encaps`](https://pkg.go.dev/github.com/godicom-dev/godicom/encaps) | 封装 Pixel Data 的分帧 —— Basic Offset Table、fragment、`Encapsulate` / `GenerateFrames` |
| [`dicomjson`](https://pkg.go.dev/github.com/godicom-dev/godicom/dicomjson) | DICOM JSON Model，含 BulkDataURI 处理 |
| [`cmd/godicom`](https://pkg.go.dev/github.com/godicom-dev/godicom/cmd/godicom) | 命令行工具 |

## 本站相关页面 {#on-this-site}

- **[数据集](/zh/godicom/datasets)** —— 读取、写入、getter 与 setter、序列、编码选项，以及读取 DICOMDIR
- **[诊断](/zh/godicom/diagnostics)** —— 截断或畸形的文件会报出什么，以及写出时对应的回调
- **[Pixel Data](/zh/godicom/pixel-data)** —— 帧、原始与显示输出、LUT、压缩，以及 Overlay 平面
- **[DICOM JSON](/zh/godicom/json)** —— JSON Model，双向
- **[日志](/zh/godicom/logging)** —— `log/slog`，以及读取器发出的属性键
- **[命令行工具](/zh/godicom/cli)** —— `godicom show`、`read`、`readcopy`

## 传输语法支持 {#transfer-syntax-support}

| 传输语法 | 读 | 写 |
|-----------------|------|-------|
| Explicit / Implicit VR Little Endian | ✅ | ✅ |
| Explicit VR Big Endian | ✅ | ✅ |
| Deflated Explicit VR Little Endian | ✅ | ✅ |
| RLE Lossless | ✅ | ✅ |
| JPEG Baseline / Extended / Lossless | ✅ | ✅ |
| JPEG-LS | ✅ | ✅ |
| JPEG 2000 / HTJ2K | ✅ | ✅ |

## 平台与二进制体积 {#platforms-and-binary-size}

Go 能编译的地方，godicom 都能编译、能运行。原生编解码器为六个平台提供预编译库
—— `linux/amd64`、`linux/arm64`、`darwin/amd64`、`darwin/arm64`、
`windows/amd64`、`windows/arm64`。表外的平台上，读写照常工作，只有那四种依赖原生
编解码器的传输语法会返回一个包装了 `ErrUnsupportedPlatform` 的 error。完整的降级
说明见[生态页](../ecosystem.md)。

一个二进制里**只会带当前平台的那一对库，绝不会带全部十二个**。`//go:embed` 指令都
放在按平台区分的 build tag 后面，所以链接器只能看到当前目标平台对应的那一对：

| `cmd/godicom`，`go build` | 体积 | 内嵌的库 |
|---------------------------|------|----------|
| linux/amd64   | 11.0 MB | 3.7 MB |
| linux/arm64   | 10.4 MB | 3.4 MB |
| darwin/amd64  | 10.4 MB | 2.7 MB |
| darwin/arm64  |  9.8 MB | 2.3 MB |
| windows/amd64 | 10.5 MB | 2.6 MB |
| windows/arm64 |  9.8 MB | 2.4 MB |
| js/wasm       |  8.3 MB | 无 |
| linux/386     |  6.4 MB | 无 |

十二个库加起来是 17.0 MB。如果无条件全部内嵌，每个二进制都要多出大约 13.3 MB ——
`linux/amd64` 的构建会变成 24.3 MB，而不是 11.0 MB。想确认你自己的构建到底嵌了
什么：

```bash
go list -f '{{.EmbedFiles}}' github.com/godicom-dev/golibjpeg/native
```

没有 cgo，也不需要装任何工具链；库是通过 purego 加载的，交叉编译一条普通的
`go build` 就够了。

CI 会为每个 release 交叉编译 `windows/386`、`linux/386`、`linux/arm`（含
`GOARM=5`）、`linux/riscv64`、`linux/ppc64le`、`js/wasm` 和 `wasip1/wasm`，并在
32 位上跑完整测试。DICOM 的值长度是无符号 32 位，整数位宽写错会在 32 位上暴露出来。`linux/mips` 和 `linux/mipsle` 目前编译不过，因为 purego 还不支持它们。

## 仓库文档 {#repository-documents}

pkg.go.dev 上的参考从源码生成，函数签名以它为准。下面这些文档说明设计意图：

- [pkg.go.dev](https://pkg.go.dev/github.com/godicom-dev/godicom) —— 完整 API 参考
- [CHANGELOG.md](https://github.com/godicom-dev/godicom/blob/main/CHANGELOG.md) —— 逐个版本的变更
- [PARITY.md](https://github.com/godicom-dev/godicom/blob/main/PARITY.md) —— 按领域对照 pydicom 的覆盖度
- [TODO.md](https://github.com/godicom-dev/godicom/blob/main/TODO.md) —— 推迟与范围外的工作

## 测试夹具 {#test-fixtures}

参考夹具是一个 git submodule，构建时可选，但跑完整测试套件需要它：

```bash
git clone --recurse-submodules https://github.com/godicom-dev/godicom.git
```
