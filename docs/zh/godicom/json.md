# DICOM JSON

[DICOM JSON Model](https://dicom.nema.org/medical/dicom/current/output/chtml/part18/chapter_F.html)（PS3.18 Annex F）是 DICOMweb 说的语言。
[`dicomjson`](https://pkg.go.dev/github.com/godicom-dev/godicom/dicomjson) 包在数据集与它之间双向转换。

```go
import "github.com/godicom-dev/godicom/dicomjson"
```

## 两个方向 {#both-directions}

```go
jsonData, err := dicomjson.MarshalDataset(ds.Dataset)
parsed, err := dicomjson.ParseDataset(jsonData)

arr, err := dicomjson.MarshalDatasets([]*godicom.Dataset{ds1, ds2})
dss, err := dicomjson.ParseDatasets(arr)
```

| 函数 | 用途 |
|----------|-----|
| `MarshalDataset(ds, opts…)` | 一个数据集 → JSON 字节，按标签排序 |
| `MarshalDatasetString(ds, opts…)` | 同上，返回 `string` |
| `MarshalDatasets(dss, opts…)` | 数据集的 JSON 数组 —— 一份 QIDO-RS 结果 |
| `ParseDataset(data, opts…)` | JSON 字节 → `*godicom.Dataset` |
| `ParseDatasets(data, opts…)` | JSON 数组 → `[]*godicom.Dataset` |
| `DecodeDataset(r, opts…)` | 直接从 `io.Reader` 读 |
| `DatasetToMap(ds, opts…)` | `map[string]Element`，如果你想在编码前再加工一遍 |

输出按标签排序，所以对同一个数据集跑两遍会产出逐字节相同的 JSON —— 当你在 diff 夹具或给载荷签名时，这件事的分量比听起来大。

## 元素的形状 {#the-element-shape}

```go
type Element struct {
	VR           string            `json:"vr"`
	Value        []json.RawMessage `json:"Value,omitempty"`
	InlineBinary string            `json:"InlineBinary,omitempty"`
	BulkDataURI  string            `json:"BulkDataURI,omitempty"`
}
```

`Value` 保持为 `json.RawMessage`，所以一个以 `1.0` 进来的数不会在中途变成 `1`。

## 大块数据 {#bulk-data}

一个 20 MB 的 *Pixel Data* 元素做 base64 内联，技术上是合法 JSON，实际上是个错误。超过某个阈值就改为输出一个引用：

```go
jsonData, err := dicomjson.MarshalDataset(ds.Dataset,
	dicomjson.WithBulkDataThreshold(1024),
	dicomjson.WithBulkDataURIBuilder(func(t godicom.Tag, vr godicom.VR, value []byte) (string, error) {
		return store(t, value) // return the URI you stored it at
	}),
)
```

读回来的时候再解析它们：

```go
parsed, err := dicomjson.ParseDataset(jsonData,
	dicomjson.WithBulkDataURIReader(func(t godicom.Tag, vr godicom.VR, uri string) ([]byte, error) {
		return fetch(uri)
	}),
)
```

阈值以下的值以 base64 装在 `InlineBinary` 里。没有设 builder 时，什么都不会被外置。

## 无法 marshal 的元素 {#elements-that-will-not-marshal}

`WithSuppressInvalidTags()` 会丢掉 marshal 失败的元素，而不是让整份文档失败。当你从不受自己控制的文件里导出、而一个坏元素不该让你连带丢掉另外四百个时，用它：

```go
jsonData, err := dicomjson.MarshalDataset(ds.Dataset, dicomjson.WithSuppressInvalidTags())
```

不用它的话，marshal 错误会被返回 —— 这是正确的默认，因为悄悄丢一个元素正是那种半年后才发现的事。

## 与 DICOMweb 一起 {#with-dicomweb}

[gonetdicom 的 DICOMweb 客户端](/zh/gonetdicom/dicomweb)对 WADO-RS 和 QIDO-RS 事务已经返回解析好的 metadata，所以通常只有在你自己构造载荷或实现服务端时，才会直接去用 `dicomjson`。
