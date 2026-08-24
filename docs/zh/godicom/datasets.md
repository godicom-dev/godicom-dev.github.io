# 数据集

`Dataset` 是一组按 `Tag` 索引的 `DataElement`。`FileDataset` 在它外面包上 Part 10 文件携带的那些东西 —— preamble、File Meta Information，以及它来自哪个文件：

```go
type FileDataset struct {
	*Dataset
	Filename  string
	Preamble  []byte
	FileMeta  *FileMetaDataset
	Timestamp string
}
```

因为 `*Dataset` 是嵌入的，下面每个方法在两者上都能用。

## 读取 {#reading}

| 入口 | 来源 |
|-------------|--------|
| `ReadFile(filename, opts)` | 一个路径 |
| `Read(r, opts)` | 任意 `io.Reader` |
| `ReadBytes(data, opts)` | 一个 `[]byte` |
| `DecodeDataset(data, ts)` | **没有** File Meta 的数据集字节，传输语法由你给出 |
| `DecodeDatasetEncoding(data, isImplicitVR, isLittleEndian)` | 同上，但直接给出编码 |

每个都有一个 `…Context` 变体，首参接收 `context.Context`，用于取消和请求域内的日志：`ReadFileContext`、`ReadContext`、`ReadBytesContext`、`DecodeDatasetContext`、`DecodeDatasetEncodingContext`。

尽量给可 seek 的源 —— 用 `*os.File` 而不是包了一层的流 —— 这样 `StopBeforePixels`、`DeferSize` 和 `SpecificTags` 才能跳过大值，而不是把它们缓冲下来。

### ReadOptions {#readoptions}

```go
type ReadOptions struct {
	DeferSize        uint32
	StopBeforePixels bool
	Force            bool
	SpecificTags     []Tag
	Logger           *slog.Logger
	OnDiagnostic     func(Diagnostic) error
}
```

- **`DeferSize`** —— 超过这个字节数的值不预先读入。元素存在，值在首次访问时加载。
- **`StopBeforePixels`** —— 到 *Pixel Data* 停下。只要头部信息时的快路径。
- **`Force`** —— 读取没有 DICM 前缀的文件，等价于 pydicom 的 `force=True`。
- **`SpecificTags`** —— 只读这些标签（外加为了到达它们所必需的组长度和 File Meta 元素）。
- **`Logger`** —— 见[日志](/zh/godicom/logging)。
- **`OnDiagnostic`** —— 见[诊断](/zh/godicom/diagnostics)。

### 延迟加载的值 {#deferred-values}

设了 `DeferSize` 之后，一个大值是一个承诺而不是一段缓冲。通过 `Get` 访问会触发加载；`LoadDeferred` 则是显式触发：

```go
ds, err := godicom.ReadFile("ct.dcm", &godicom.ReadOptions{DeferSize: 1024})
if err != nil {
	log.Fatal(err)
}
// … later, when the pixels are actually needed:
if err := ds.LoadDeferred(tag.PixelData); err != nil {
	log.Fatal(err) // the file moved, or changed under us
}
```

`FileDataset.Timestamp` 是源文件的修改时间，延迟加载会核对它 —— 一个在你背后被重写过的文件不会悄悄给出错误的字节。如果延迟加载在读取返回之后才失败，会通过 `ReadOptions.OnDiagnostic` 上报，这也是那个钩子必须能从数据集被使用的任何地方安全调用的原因。

## 读取元素 {#reading-elements}

带类型的 getter 返回值以及它是否存在：

```go
name, ok := ds.GetString(tag.PatientName)
rows, ok := ds.GetInt(tag.Rows)
thickness, ok := ds.GetFloat(tag.SliceThickness)
spacing, ok := ds.GetFloats(tag.PixelSpacing)
raw, ok := ds.GetBytes(tag.PixelData)
seq, ok := ds.GetSequence(tag.ReferencedImageSequence)
```

对于自带语义的 VR，有一组 VR 类型化的 getter 保留这些语义，而不是压平成 Go 基本类型 —— `GetDA`、`GetTM`、`GetDT`、`GetIS`、`GetDS`、`GetPN`：

```go
pn, ok := ds.GetPN(tag.PatientName) // PersonName: family, given, middle, prefix, suffix
da, ok := ds.GetDA(tag.StudyDate)
```

`StringValue`、`IntValue`、`FloatValue`、`BytesValue` 和 `SequenceValue` 是对应 `Get*` 的一行别名 —— 行为一样，在哪处读起来更顺就用哪个。

要拿元素本身而不是它的值：`Get`、`GetDataElement`、`ElementByKeyword`、`Has`、`Len`。

## 写入元素 {#writing-elements}

setter 从数据字典取 VR，并在调用处拒绝该 VR 装不下的值：

```go
ds.SetString(tag.PatientID, "12345678")
ds.SetStrings(tag.ImageType, "DERIVED", "SECONDARY")
ds.SetInt(tag.Rows, 512)
ds.SetInts(tag.AcquisitionMatrix, 0, 256, 256, 0)
ds.SetFloat(tag.SliceThickness, 1.5)
ds.SetFloats(tag.PixelSpacing, 0.5, 0.5)
ds.SetBytes(tag.PixelData, raw)
ds.SetSequence(tag.ReferencedImageSequence, seq)
```

它们全都返回 `error` —— 请检查。`SetFloat(tag.EchoNumbers, 1.5)` 会失败，因为 `EchoNumbers` 是 `IS`，而 `IS` 装不下浮点值。

与 VR 类型化的 getter 相对，也有一组 VR 类型化的 setter，供你手上已经是 VR 自己的类型而不是 Go 基本类型时使用 —— `SetDA`、`SetTM`、`SetDT`、`SetIS`、`SetDS`、`SetPN`：

```go
ds.SetPN(tag.PatientName, pn)
ds.SetDA(tag.StudyDate, da)
```

两个逃逸出口，按你要自己担多少责任递增排列：

```go
// VR from the dictionary, value type NOT checked against it.
ds.SetValue(tag.PatientID, "12345678")

// VR supplied by you. For private tags and anything else the dictionary
// does not know. Note it returns nothing: there is no dictionary left to
// disagree with you.
ds.Set(godicom.NewDataElement(tag.New(0x0009, 0x0010), godicom.VRLO, "ACME"))
```

setter 判断不了的值 —— 对它的 Go 类型来说在范围内、对它的 VR 来说不在 —— 会在写出时被抓住，交给
[`WriteOptions.OnDiagnostic`](/zh/godicom/diagnostics#values-a-strict-receiver-would-reject)。

删除：`Delete`、`Pop`、`Clear`、`RemovePrivateTags`。

## 序列 {#sequences}

`Sequence` 是一串 `*Dataset` item：

```go
item := godicom.NewDataset()
if err := item.SetString(tag.CodeValue, "T-A0100"); err != nil {
	log.Fatal(err)
}
if err := item.SetString(tag.CodingSchemeDesignator, "SRT"); err != nil {
	log.Fatal(err)
}

seq := godicom.NewSequence([]*godicom.Dataset{item})
seq.Append(anotherItem)

if err := ds.SetSequence(tag.AnatomicRegionSequence, seq); err != nil {
	log.Fatal(err)
}
```

读回来：

```go
if seq, ok := ds.GetSequence(tag.AnatomicRegionSequence); ok {
	for _, item := range seq.Items() {
		code, _ := item.GetString(tag.CodeValue)
		fmt.Println(code)
	}
}
```

`Len`、`Get(i)`、`IsEmpty` 和 `Items` 就是全部表面。

## 私有标签 {#private-tags}

```go
block := ds.PrivateBlock(0x0009, "ACME MEDICAL")
ds.RemovePrivateTags()
```

## 遍历数据集 {#walking-a-dataset}

| 方法 | 顺序与深度 |
|--------|-----------------|
| `Iter()` | 顶层元素，按标签顺序 |
| `IterAll()` | 每一个元素，递归进序列（pydicom 的 `iterall`） |
| `Walk(fn, recursive)` | 按标签顺序对每个元素回调（pydicom 的 `walk`） |
| `SortedTags()` | 排好序的标签 |
| `Elements()` | 底层的 `map[Tag]*DataElement` |
| `GroupDataset(group)` | 只含某一个组的新 `Dataset` |

整数据集级的操作：`Clone`、`Equal`、`Update`、`String`、`Top`、`FormattedLines`。

## 标签与 UID {#tags-and-uids}

标签以常量形式来自 `tag` 包，运行时取一个标签有四种方式：

```go
t := tag.New(0x0010, 0x0010)             // group and element
t, err := tag.Parse("(0010,0010)")       // also "0010,0010" and "00100010"
t = tag.MustParse("(0010,0010)")         // panics instead, for package vars
t, ok := tag.ByKeyword("PatientName")    // from the dictionary keyword
```

`tag.FromKeyword` 是 `ByKeyword` 的返回 error 形式，`tag.Keyword` 是反方向。在根包里，`godicom.ParseTag` 接受上面任意一种字符串形式*或*一对 group/element，命令行的 `-t` 用的就是它；`godicom.TagFromKeyword` 是关键字查询。

`Tag` 还回答了那些你本来得自己写的问题：`Group`、`Element`、`IsPrivate`、`IsPrivateCreator`、`PrivateCreator`，以及给 DICOM JSON Model 用的 `JSONKey`。

UID 方面，`uid.UID` 自带字典，所以按传输语法分支不需要你自备一张表。`FileDataset.TransferSyntaxUID` 帮你从 File Meta 里读出来：

```go
ts, ok := fd.TransferSyntaxUID()
if ok && ts.IsEncapsulated() {
	// compressed frames, in items
}
fmt.Println(ts.Name(), ts.IsCompressed(), ts.IsDeflated(),
	ts.IsImplicitVR(), ts.IsLittleEndian())
```

`IsTransferSyntax`、`IsRetired`、`IsPrivate`、`IsValid`、`Keyword`、`Type` 和 `ExtraInfo` 把它补齐，`uid.Lookup` 把关键字解析成 UID。

生成一个：

```go
u, err := uid.GenerateUID()                            // the godicom root
u, err = uid.GenerateUID(uid.WithPrefix("1.2.3.4."))   // your own org root
u, err = uid.GenerateUID(uid.WithUUIDPrefix())         // 2.25.<uuid>, PS3.5 B.2
```

`uid.MustGenerateUID` 用 panic 代替返回 error，`uid.WithEntropy` 混入你自己的字符串以便可复现地生成。

## 写入 {#writing}

| 入口 | 产出 |
|-------------|----------|
| `WriteFile(filename, ds *Dataset, opts)` | 一个 Part 10 文件，File Meta 从数据集推导 |
| `FileDataset.SaveAs(filename, opts)` / `Dataset.SaveAs(filename, opts)` | 同上，方法形式 |
| `Write(w, fd *FileDataset, opts)` / `FileDataset.Write(w, opts)` | Part 10 字节写到 `io.Writer` |
| `EncodeFile(fd *FileDataset, opts)` / `FileDataset.EncodeFile(opts)` | 内存中的 Part 10 字节 |
| `WriteDataset(w, ds *Dataset, ts)` / `EncodeDataset(ds, ts)` | 数据集字节，没有 preamble 和 File Meta |
| `Dataset.Encode(ts)` / `Dataset.EncodeEncoding(implicit, littleEndian)` | 同上，方法形式 |

带 `*FileDataset` 的入口会把 preamble 和已有的 File Meta 一路带过去；`WriteFile` 收的是裸 `*Dataset` 并自行推导 File Meta，这也是它和 `EnforceFileFormat` 配对的原因。

### WriteOptions {#writeoptions}

```go
type WriteOptions struct {
	ImplicitVR        *bool
	LittleEndian      *bool
	EnforceFileFormat bool
	Logger            *slog.Logger
	OnDiagnostic      func(Diagnostic) error
}
```

`ImplicitVR` 和 `LittleEndian` 是指针，好让「保持原样」能和「改成 explicit little endian」区分开。留 nil 时，从文件读来的数据集会按它进来时的编码写回去。

`EnforceFileFormat` 要求结果是合规的 Part 10，并从数据集填好 File Meta。当你是在创建文件而不是往返一个已有文件时，它就是你要的 —— 而且它会告诉你缺了什么：

```
required File Meta Information elements are missing or empty:
[(0002,0002) MediaStorageSOPClassUID (0002,0003) MediaStorageSOPInstanceUID]
```

意思是这个数据集需要设上 `SOPClassUID` 和 `SOPInstanceUID`。

::: warning
`WriteDataset` 和 `EncodeDataset` 不接收 `*WriteOptions`，所以它们带不了诊断钩子。想要写入诊断，就用接收 options 的那条路径。
:::

## 没有 File Meta 的数据集字节 {#dataset-bytes-with-no-file-meta}

DIMSE 消息或 DICOMweb multipart 载荷里装的就是这个：

```go
data, err := ds.Encode(uid.ExplicitVRLittleEndian)
parsed, err := godicom.DecodeDataset(data, uid.ExplicitVRLittleEndian)
```

## 重新读入的数据集的编码 {#encoding-of-a-re-read-dataset}

`SetOriginalEncoding` 和 `SetWriteEncoding` 显式设定编码；`IsOriginalEncoding` 报告一个数据集是否会被原样写回。没有被改动过的值会按它们被读入时的字节写出，这样既更快也无损 —— 也正是这类值永远不会被送到写入诊断钩子的原因。
