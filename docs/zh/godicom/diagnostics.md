# 诊断

默认情况下，读取会保留文件开始变得不合理之前它解析出的一切。大多数 DICOM 工具都这么做，这也是一个受损文件为什么会看起来很健康。`Diagnostic` 是 godicom 转而告诉你的方式。

```go
type Diagnostic struct {
	Kind       DiagnosticKind
	Tag        Tag
	VR         VR
	ExpectedVR VR
	Offset     int64
	Path       []PathStep
	Need       int64
	Have       int64
	Err        error
}
```

一个类型覆盖两个方向 —— 同一个结构体既交给 `ReadOptions.OnDiagnostic`，也交给 `WriteOptions.OnDiagnostic`。

## 钩子 {#the-hook}

```go
ds, err := godicom.ReadFile("truncated.dcm", &godicom.ReadOptions{
	OnDiagnostic: func(d godicom.Diagnostic) error {
		log.Printf("%s", d)
		return nil // keep parsing
	},
})
```

`Diagnostic` 实现了 `error`，所以把它返回出去就等于拒收该文件：

```go
opts := &godicom.ReadOptions{
	OnDiagnostic: func(d godicom.Diagnostic) error { return d },
}
```

返回 `nil`，你得到的是原来那种宽松行为，外加一份哪里出了错的记录。返回诊断本身，你得到的是一个严格解析器。没有模式枚举：你是否设了这个钩子、以及你从里面返回什么，就是那个开关。

## 会报什么 {#what-gets-reported}

| Kind | 含义 |
|------|---------|
| `truncated_header` | 流在一个数据元素头部中间结束，因此该元素及其后的一切都无法解析。 |
| `truncated_value` | 元素声明的值字节数多于流里实际有的。要么文件被截断，要么长度字段是错的；读取器分辨不出是哪一种。 |
| `truncated_item` | 流在一个序列 item 头部中间结束。 |
| `deferred_value_unreadable` | 一个按延迟方式解析的元素，在其值最终被请求时无法加载。 |
| `vr_mismatch` | 一个 explicit VR 元素带的 VR，数据字典无法与它的标签调和。 |
| `invalid_value` | 交给**写入器**的一个值无法按它的 VR 所要求的方式书写。 |

### 长度异常 {#length-anomalies}

`Need` 和 `Have` 分别是编码要求的字节数和实际可用的字节数。当异常与长度无关时两者都为零。

```go
reread, err := godicom.ReadBytes(data[:len(data)-4], &godicom.ReadOptions{
	OnDiagnostic: func(d godicom.Diagnostic) error {
		fmt.Printf("%s at %s: need %d, have %d\n", d.Kind, d.Tag, d.Need, d.Have)
		return nil
	},
})
// truncated_value at (0010,0010): need 8, have 4
```

该元素不在结果里 —— 对它调 `GetString` 会报告不存在 —— 但你确切知道少了哪一个、少了多少。

### 字典不认同的 VR {#a-vr-the-dictionary-disagrees-with}

`vr_mismatch` 是唯一一种不改变解析结果的异常。godicom 保留文件给它的 VR，因为文件说什么就是文件的意思。`VR` 存的是文件实际携带的 VR（也就是 godicom 接着用的那个），`ExpectedVR` 存的是字典给这个标签的那个。

对其他每一种 kind，`ExpectedVR` 都是空的 —— 对字典里没有条目的标签也是空的，因为一个不认识的标签或私有标签没有可供落空的期望。

之所以要报它，是因为当一台真实设备拒收你的文件时，这通常是第一件有用的信息。

### 永远没到的延迟值 {#deferred-values-that-never-arrive}

延迟加载可能在 `ReadFile` 返回之后很久才失败 —— 文件被移动了，或者被重写了。`deferred_value_unreadable` 就在那一刻上报，走的是你当初给那次读取的钩子。所以这个钩子必须能从数据集被使用的任何地方安全调用，不只是从读取里。

标签对 `SortedTags` 和 `Elements` 仍然可见，而 `Get` 会报告它不存在。

## 异常出在哪里 {#where-the-anomaly-was}

`Offset` 是被解析数据集中的字节偏移。对 Deflated 传输语法，它是*解压后*字节里的偏移，不是文件里的。对写入时产生的诊断它是零，因为那里没有源可指。

`Path` 指出外层的各个序列，最外层在前：

```go
type PathStep struct {
	Tag  Tag
	Item int // zero-based; -1 when the sequence was entered but no item was
}
```

它渲染成 `(0008,1140)[1] > (0008,1110)[1]`。PS3.5 只给序列 item 一个序号位置，没有别的可用来称呼它们的东西，所以少了下标，同一个序列的两个 item 会产生读起来一模一样的诊断 —— 当四十个 item 里只有一个畸形时，这毫无帮助。

当序列已经进入但还没有进入任何 item 时，`Item` 是 `-1`：可能是 item 头部本身不可读，也可能是异常关乎序列而非它的任何一个 item。这种情况下渲染时会省掉下标。

顶层数据集里的异常，`Path` 为 nil。

## 严格接收方会拒收的值 {#values-a-strict-receiver-would-reject}

`WriteOptions.OnDiagnostic` 是写出方向上的同一个钩子。它报告那些写入器本来会静默编码、但 godicom 自己的读取器又会对结果报出诊断的值 —— 一个超出 `[-2^31, 2^31)` 的 `IS`、一个长于 PS3.5 允许的 16 字节的 `DS`、一个带小数的 `IS`：

```go
if err := ds.SetInt(tag.EchoNumbers, 3000000000); err != nil {
	log.Fatal(err)
}
err := godicom.WriteFile("out.dcm", ds, &godicom.WriteOptions{
	OnDiagnostic: func(d godicom.Diagnostic) error { return d },
})
// err: godicom: error writing dataset: godicom: invalid_value at (0018,0086)
// IS: "3000000000" is outside [-2147483648, 2147483647], the range an IS allows
```

返回 `nil` 会按原样写出该值，所以现有调用方写出的东西一点不变；返回诊断则让这次写入失败。这就是 pydicom 在 `config.settings.writing_validation_mode` 里用 `IGNORE` / `WARN` / `RAISE` 表达的三选一，而这里不需要一个模式枚举。

### 为什么 setter 一个人做不到这件事 {#why-the-setters-cannot-do-this-alone}

按字典取 VR 的 setter 会在调用处拒绝它自己能看出来的一切。`SetFloat(tag.EchoNumbers, 1.5)` 立刻失败，因为 `EchoNumbers` 是 `IS`，而 `IS` 装不下浮点值。

钩子管的是 setter 判断不了的部分：

- 一个对它的 Go 类型来说在范围内、对它的 VR 来说不在的值 —— `3000000000` 是个没问题的 Go `int`，却不是个没问题的 `IS`
- 一个直接用 `Set(NewDataElement(tag, vr, value))` 造出来的元素，VR 是你给的，字典从没被咨询过
- 一个通过 `SetValue` 设的值，它从字典取 VR，但不拿值去对照检查

### 永远不会送来的 {#what-is-never-offered}

有两样东西有意不会到达写入钩子：

1. **直接按读入时的字节写出的值。** 它们被跳过了重新编码，而产生它们的那次读取已经有过自己的上报机会。
2. **通过 `WriteDataset` 和 `EncodeDataset` 的写入**，它们不接收 `*WriteOptions`，因此带不了钩子。

## 编译期核对过的示例 {#compile-checked-examples}

读写两个钩子由 godicom
[`example_test.go`](https://github.com/godicom-dev/godicom/blob/main/example_test.go) 里的 `ExampleReadOptions` 和 `ExampleWriteOptions` 实际跑过。它们在内存中构造 Part 10 字节，所以不需要夹具，而 `go test` 会核对它们的输出 —— 包括上面引用的那段诊断文本的确切内容。
