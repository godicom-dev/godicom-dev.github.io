# 命令行工具

```bash
go install github.com/godicom-dev/godicom/cmd/godicom@latest
```

```
Usage: godicom <command> [args...]
Commands:
  show <file>          - Display DICOM file (file meta + dataset)
  read <file>          - Alias for show
  readcopy <src> <dst> - Read then write DICOM file
```

## show {#show}

```bash
godicom show ct.dcm
```

打印文件名、File Meta Information、传输语法、元素个数，以及每一个顶层元素。

| 标志 | 作用 |
|------|--------|
| `-no-meta` | 跳过 File Meta 那一段 |
| `-top` | 与 `-t` 一起用时，不递归进序列 |
| `-t <tag>` | 只显示这个标签的元素 —— 关键字或十六进制，可重复 |
| `-tag <tag>` | `-t` 的别名 |
| `-debug` | 把读取器的调试日志输出到 stderr |

`-t` 接受 `godicom.ParseTag` 能接受的任何形式，所以关键字和十六进制标签可以互换：

```bash
godicom show -t PatientName -t 00100020 ct.dcm
godicom show -t ReferencedImageSequence ct.dcm        # recurses by default
godicom show -t ReferencedImageSequence -top ct.dcm   # top level only
```

用了 `-t` 时，输出末尾给出的是匹配元素的个数，而不是总数。

### 调试一个读不进来的文件 {#debugging-a-file-that-will-not-read}

```bash
godicom show -debug suspect.dcm
```

`-debug` 会给这次读取挂上一个 `LevelDebug` 的 `slog` 文本 handler，于是逐元素的头部追踪走 stderr，而数据集走 stdout —— 也就是说你可以把两者分开重定向：

```bash
godicom show -debug suspect.dcm > dataset.txt 2> trace.log
```

追踪里有什么，见[日志](/zh/godicom/logging)。

## readcopy {#readcopy}

```bash
godicom readcopy in.dcm out.dcm
```

读入、写出、再把结果读回来，每一步都报告元素个数：

```
Read 148 elements from in.dcm
Written to out.dcm
Re-read 148 elements from out.dcm
```

如果个数变了它会以非零码退出，因此可以在脚本里当往返检查用 —— 这是一种很便宜的办法，用来查明 godicom 能不能完整保住某台特定设备产出的文件里的一切。
