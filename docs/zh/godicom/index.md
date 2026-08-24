# godicom

[![Release](https://img.shields.io/github/v/release/godicom-dev/godicom?label=release&color=007d9c)](https://github.com/godicom-dev/godicom/releases)
[![CI](https://github.com/godicom-dev/godicom/actions/workflows/ci.yml/badge.svg)](https://github.com/godicom-dev/godicom/actions/workflows/ci.yml)
[![GoDoc](https://pkg.go.dev/badge/github.com/godicom-dev/godicom)](https://pkg.go.dev/github.com/godicom-dev/godicom)

*godicom* 用 Go 读取、修改和写入 [DICOM](https://www.dicomstandard.org/) 数据。组织里其余部分都建立在它之上。

```bash
go get github.com/godicom-dev/godicom@latest
```

## 它是什么 {#what-it-is}

一个通用 DICOM 框架，关心的是**数据集** —— 磁盘上的字节、编码规则、数据字典，以及里面的 Pixel Data。它是 [pydicom](https://github.com/pydicom/pydicom) 的 Go 对照物，开发时对着 pydicom 的源码和测试夹具，而不是对着自己以为标准说了什么。

## 它有意不做什么 {#what-it-deliberately-is-not}

为了让项目规模可控，它不处理：

- **DICOM 网络通信** —— DIMSE、DICOMweb、与 PACS 交互。那是
  [gonetdicom](/zh/gonetdicom/) 的事。
- **具体 SOP Class 的细节** —— 没有按模态的 IOD 校验，没有 DICOMDIR / file-set 处理，没有结构化报告对象模型。

这些不是遗漏，而是明确记在
[TODO.md](https://github.com/godicom-dev/godicom/blob/main/TODO.md) 里的范围外或推迟项，并且有一条规则：没有真实使用者之前不开工。

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

- **[数据集](/zh/godicom/datasets)** —— 读取、写入、getter 与 setter、序列，以及编码选项
- **[诊断](/zh/godicom/diagnostics)** —— 一个被截断或畸形的文件会告诉你什么，以及写出时对应的钩子
- **[Pixel Data](/zh/godicom/pixel-data)** —— 帧、原始与显示输出、LUT、压缩
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

## 仓库文档 {#repository-documents}

生成的 API 参考是签名的权威；下面这些是意图的权威：

- [pkg.go.dev](https://pkg.go.dev/github.com/godicom-dev/godicom) —— 完整 API 参考
- [CHANGELOG.md](https://github.com/godicom-dev/godicom/blob/main/CHANGELOG.md) —— 逐个版本的变更
- [PARITY.md](https://github.com/godicom-dev/godicom/blob/main/PARITY.md) —— 按领域对照 pydicom 的覆盖度
- [TODO.md](https://github.com/godicom-dev/godicom/blob/main/TODO.md) —— 推迟与范围外的工作

## 测试夹具 {#test-fixtures}

参考夹具是一个 git submodule，构建时可选，但跑完整测试套件需要它：

```bash
git clone --recurse-submodules https://github.com/godicom-dev/godicom.git
```
