# 快速开始

## 环境要求 {#requirements}

Go 1.26 或更新版本。不需要 C 工具链，也不需要 CMake —— 压缩 Pixel Data 的编解码器通过 `purego` 加载原生库，所以 `CGO_ENABLED=0` 能正常构建。这些库为哪些平台构建过，见
[生态总览](/zh/ecosystem#platform-support-of-the-native-codecs)。

## 安装 {#install}

```bash
go get github.com/godicom-dev/godicom@latest
```

读写文件（包括压缩 Pixel Data）只需要这一个模块 —— 编解码器模块会跟着一起来。如果还要用 DIMSE 或 DICOMweb，再单独加
[gonetdicom](/zh/gonetdicom/)。

```bash
go get github.com/godicom-dev/gonetdicom@latest
```

## 读一个文件 {#read-a-file}

```go
package main

import (
	"fmt"
	"log"

	"github.com/godicom-dev/godicom"
	"github.com/godicom-dev/godicom/tag"
)

func main() {
	ds, err := godicom.ReadFile("ct.dcm", nil)
	if err != nil {
		log.Fatal(err)
	}

	name, ok := ds.GetString(tag.PatientName)
	if !ok {
		log.Fatal("no PatientName")
	}
	fmt.Println(name)
}
```

`ReadFile` 返回一个 `*godicom.FileDataset`：数据集本身，加上 Part 10 文件在它周围携带的 preamble 与 File Meta Information。元素用带类型的 getter 读取，标签用
[`tag`](https://pkg.go.dev/github.com/godicom-dev/godicom/tag) 包里的常量。

## 改一处再写回去 {#change-something-and-write-it-back}

```go
if err := ds.SetString(tag.PatientID, "12345678"); err != nil {
	log.Fatal(err)
}
if err := ds.SaveAs("ct_updated.dcm", nil); err != nil {
	log.Fatal(err)
}
```

setter 从数据字典取 VR，所以对数值标签调 `SetString`、对整数标签调 `SetFloat`，会在调用处就失败，而不是产出一个接收方会拒收的文件。[数据集](/zh/godicom/datasets)一页完整覆盖 getter 与 setter。

## 一次不落地的往返 {#a-round-trip-with-no-files-involved}

拿来做冒烟测试很合适，本站大多数示例也是这个形状 —— 每个字节都在内存里造出来，所以你不需要任何夹具就能跑：

```go
package main

import (
	"fmt"
	"log"

	"github.com/godicom-dev/godicom"
	"github.com/godicom-dev/godicom/tag"
	"github.com/godicom-dev/godicom/uid"
)

func main() {
	ds := godicom.NewDataset()
	if err := ds.SetString(tag.PatientID, "12345678"); err != nil {
		log.Fatal(err)
	}
	if err := ds.SetString(tag.PatientName, "Doe^Jane"); err != nil {
		log.Fatal(err)
	}

	// PS3.10 requires File Meta to name the SOP Class and Instance;
	// EnforceFileFormat fills the File Meta in from the dataset.
	if err := ds.SetString(tag.SOPClassUID, string(uid.CTImageStorage)); err != nil {
		log.Fatal(err)
	}
	if err := ds.SetString(tag.SOPInstanceUID, "1.2.826.0.1.3680043.10.1337.1"); err != nil {
		log.Fatal(err)
	}

	fd := &godicom.FileDataset{Dataset: ds, FileMeta: godicom.NewFileMetaDataset()}
	data, err := godicom.EncodeFile(fd, &godicom.WriteOptions{EnforceFileFormat: true})
	if err != nil {
		log.Fatal(err)
	}

	reread, err := godicom.ReadBytes(data, nil)
	if err != nil {
		log.Fatal(err)
	}
	id, _ := reread.GetString(tag.PatientID)
	name, _ := reread.GetString(tag.PatientName)
	fmt.Println(id, name) // 12345678 Doe^Jane
}
```

::: tip
这段就是 godicom `example_test.go` 里的
[`Example`](https://pkg.go.dev/github.com/godicom-dev/godicom#example-package)，因此每次提交时 `go test ./...` 都会编译它并核对输出。一段失效的示例会让 CI 挂掉，而不是悄悄误导读者。
:::

## 查出一个文件藏了什么 {#find-out-what-a-file-is-hiding}

默认情况下，读取会保留文件开始变得不合理之前它成功解析出的一切。大多数 DICOM 工具都这么做，这也正是一个损坏的文件为什么经常看起来好得很。设上 `ReadOptions.OnDiagnostic`，你就会被告知：

```go
ds, err := godicom.ReadFile("suspect.dcm", &godicom.ReadOptions{
	OnDiagnostic: func(d godicom.Diagnostic) error {
		log.Printf("%s", d) // return nil: keep parsing
		return nil
	},
})
```

`Diagnostic` 本身就是一个 `error`，所以把它返回出去就等于拒收该文件。[诊断](/zh/godicom/diagnostics)一页说明会报哪些东西，以及为什么写入侧也有同一个钩子。

## 取到像素 {#get-at-the-pixels}

```go
import "github.com/godicom-dev/godicom/pixels"

ds, err := godicom.ReadFile("mr_j2k.dcm", nil)
if err != nil {
	log.Fatal(err)
}

arr, err := ds.PixelArray(pixels.WithRaw(true)) // decoded samples + shape
frame, err := ds.DisplayFrame(0)                // 8-bit, display-ready
```

压缩传输语法通过编解码器模块解码，不需要额外设置。[Pixel Data](/zh/godicom/pixel-data) 一页覆盖帧、原始与归一化输出、LUT，以及压缩。

## 接下来看哪里 {#where-to-go-next}

- [godicom 概览](/zh/godicom/) —— 数据集库的全部表面
- [诊断](/zh/godicom/diagnostics) —— 读写两侧钩子的细节
- [Pixel Data](/zh/godicom/pixel-data) —— 解码、显示、压缩
- [gonetdicom](/zh/gonetdicom/) —— 在机器之间搬运影像
- [pkg.go.dev](https://pkg.go.dev/github.com/godicom-dev/godicom) —— 生成的 API 参考
