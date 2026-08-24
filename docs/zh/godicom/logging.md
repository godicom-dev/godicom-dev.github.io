# 日志

*godicom* 用标准库的
[`log/slog`](https://pkg.go.dev/log/slog)。默认是**静默**的 —— 默认 logger 丢弃一切，和不去开 pydicom 的 `config.debug()` 是同一个精神。

## 打开它 {#turning-it-on}

按调用来设，通常你要的就是这个：

```go
h := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug})
logger := slog.New(h)

ds, err := godicom.ReadFile("ct.dcm", &godicom.ReadOptions{Logger: logger})
```

通过 context，用于与 [gonetdicom](/zh/gonetdicom/) 共享的请求域日志：

```go
ctx := godicom.WithLogger(context.Background(), logger)
ds, err := godicom.ReadFileContext(ctx, "ct.dcm", nil)
```

或者进程级：

```go
godicom.SetDefaultLogger(logger)
```

## 哪个 logger 生效 {#which-logger-wins}

对任意一次调用：

1. `ReadOptions.Logger` / `WriteOptions.Logger`，如果设了
2. 否则是 context 里的 logger，经由 `LoggerFromContext`
3. 否则是 `DefaultLogger()`

| 函数 | |
|----------|--|
| `WithLogger(ctx, l)` | 把 logger 挂到 context 上 |
| `LoggerFromContext(ctx)` | 读回来 |
| `SetDefaultLogger(l)` | 设进程级兜底 |
| `DefaultLogger()` | 读它 |

## 读取器会记什么 {#what-the-reader-logs}

在 `LevelDebug` 下，读取器发出的事件与 pydicom 的 debugger 相同：FMI/DICM preamble、每个元素的头部及值预览（前 20 字节）、延迟值的跳过，以及序列 item 的边界。

记录使用固定的属性键，选得与 pydicom filereader 的诊断对得上，好让来自任一边的追踪都能用同一种方式读：

`component`、`offset`、`offset_hex`、`hex`、`tag`、`vr`、`len`、`undefined_length`、`value_hex`、`value`、`transfer_syntax`

因为键是固定的，用一个 JSON handler 就能得到可查询的追踪：

```go
h := slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug})
```

```bash
godicom show -debug suspect.dcm 2>&1 >/dev/null | grep '"tag":"(7FE0,0010)"'
```

## 日志与诊断的区别 {#logging-versus-diagnostics}

这两者回答不同的问题，值得别混起来：

- **日志**是读取器做了什么的追踪。它是给你在终端前看的，当一个文件解析不了、你想看它走到了哪一步时。
- **[诊断](/zh/godicom/diagnostics)**是关于异常的结构化事实，投递给一个回调，带标签、偏移和序列路径。它们是给你的程序看的 —— 用来决定是否接收一个文件，或者用来生成一份交给设备运维方的报告。

如果你发现自己在解析日志行来判断一个文件有没有被截断，你要的是 `OnDiagnostic`。

## 命令行的捷径 {#the-cli-shortcut}

```bash
godicom show -debug file.dcm
```

会替你挂上一个 `LevelDebug` 的文本 handler。见[命令行工具](/zh/godicom/cli)。
