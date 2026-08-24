---
layout: home

hero:
  name: godicom-dev
  text: Go 语言的 DICOM 实现
  tagline: 用地道的 Go 读写 DICOM 数据集、编解码 Pixel Data、收发 DIMSE 与 DICOMweb —— 调用方无需 CGO。
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 浏览各模块
      link: /zh/ecosystem
    - theme: alt
      text: GitHub
      link: https://github.com/godicom-dev

features:
  - title: godicom
    details: 数据集库 —— Part 10 文件、传输语法、数据字典、Pixel Data、DICOM JSON，以及一个命令行工具。组织里其余一切都建立在它之上。
    link: /zh/godicom/
    linkText: 数据集、诊断、Pixel Data
  - title: gonetdicom
    details: DICOM 网络通信 —— 关联协商、以 SCU 或 SCP 身份收发 DIMSE-C 与 DIMSE-N、TLS，以及一个 DICOMweb 客户端和源服务器 MVP。
    link: /zh/gonetdicom/
    linkText: DIMSE 与 DICOMweb
  - title: goopenjpeg
    details: JPEG 2000 与 HTJ2K，编码解码双向。purego 加内嵌的预编译 OpenJPEG 与 OpenJPH —— 不需要 CMake，调用方不需要 CGO。
    link: /zh/goopenjpeg/
    linkText: JPEG 2000 / HTJ2K
  - title: golibjpeg
    details: 基线与无损 JPEG、JPEG-LS、JPEG XT 解码；JPEG 与 JPEG-LS 编码。同样的 purego 架构，原生 8 位与 16 位精度。
    link: /zh/golibjpeg/
    linkText: JPEG / JPEG-LS
  - title: gorle
    details: DICOM RLE Lossless，纯 Go 实现。帧级与 pixel data 级 API、面向 1 位图像的 PackBits 辅助函数，以及底层 segment API。
    link: /zh/gorle/
    linkText: RLE Lossless
  - title: 对着 pydicom 校验
    details: 每个模块都对齐一个 Python 对照实现 —— pydicom、pynetdicom、pylibjpeg-openjpeg、pylibjpeg-libjpeg、pylibjpeg-rle —— 并按它的行为来测试，而不是只跟自己较真。
    link: /zh/ecosystem
    linkText: 各部分如何拼合
---

## 读一个文件，改一处，再写回去 {#read-a-file-change-it-write-it-back}

```go
package main

import (
	"log"

	"github.com/godicom-dev/godicom"
	"github.com/godicom-dev/godicom/tag"
)

func main() {
	ds, err := godicom.ReadFile("ct.dcm", nil)
	if err != nil {
		log.Fatal(err)
	}
	if err := ds.SetString(tag.PatientID, "12345678"); err != nil {
		log.Fatal(err)
	}
	if err := ds.SaveAs("ct_updated.dcm", nil); err != nil {
		log.Fatal(err)
	}
}
```

```bash
go get github.com/godicom-dev/godicom@latest
```

## 接下来看哪里 {#where-to-go-next}

- **[快速开始](/zh/guide/getting-started)** —— 安装、读第一个文件，以及查出一个畸形文件藏了什么。
- **[生态总览](/zh/ecosystem)** —— 哪个模块负责什么，谁又依赖了谁。
- **[godicom](/zh/godicom/)** —— 数据集库的细节。
- **[gonetdicom](/zh/gonetdicom/)** —— 如果你要在机器之间搬运影像，而不是解析它们。

::: info 关于本站
这些页面是照着各模块的已发布版本写的，完整 API 参考一律链到
[pkg.go.dev](https://pkg.go.dev/github.com/godicom-dev/godicom)，那份是从源码生成的，因此永远不会过时。
两处说法不一致时，以 pkg.go.dev 为准。
:::
