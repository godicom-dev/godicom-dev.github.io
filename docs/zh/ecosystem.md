# 生态总览

这个组织有意拆成一个模块负责一件事。没有需要你注册的插件，也没有构建期可选的部分 —— 拆分的目的是划清*谁负责什么*，好让 JPEG 2000 解码的 bug 只有一个归属地，而数据集库不必长出一个编解码部门。

## 各模块 {#the-modules}

| 模块 | 负责 | 最新版本 | Python 对照 |
|--------|------|--------|--------------------|
| [godicom](/zh/godicom/) | 数据集、Part 10 文件、传输语法、数据字典、Pixel Data、DICOM JSON、命令行 | [![](https://img.shields.io/github/v/release/godicom-dev/godicom?label=&color=007d9c)](https://github.com/godicom-dev/godicom/releases) | [pydicom](https://github.com/pydicom/pydicom) |
| [gonetdicom](/zh/gonetdicom/) | Upper Layer PDU、关联协商、DIMSE-C / DIMSE-N、DICOMweb | [![](https://img.shields.io/github/v/release/godicom-dev/gonetdicom?label=&color=007d9c)](https://github.com/godicom-dev/gonetdicom/releases) | [pynetdicom](https://github.com/pydicom/pynetdicom) |
| [goopenjpeg](/zh/goopenjpeg/) | JPEG 2000、HTJ2K | [![](https://img.shields.io/github/v/release/godicom-dev/goopenjpeg?label=&color=007d9c)](https://github.com/godicom-dev/goopenjpeg/releases) | [pylibjpeg-openjpeg](https://github.com/pydicom/pylibjpeg-openjpeg) |
| [golibjpeg](/zh/golibjpeg/) | JPEG（ISO 10918）、JPEG-LS（ISO 14495）、JPEG XT 解码 | [![](https://img.shields.io/github/v/release/godicom-dev/golibjpeg?label=&color=007d9c)](https://github.com/godicom-dev/golibjpeg/releases) | [pylibjpeg-libjpeg](https://github.com/pydicom/pylibjpeg-libjpeg) |
| [gorle](/zh/gorle/) | DICOM RLE Lossless | [![](https://img.shields.io/github/v/release/godicom-dev/gorle?label=&color=007d9c)](https://github.com/godicom-dev/gorle/releases) | [pylibjpeg-rle](https://github.com/pydicom/pylibjpeg-rle) |

版本徽章直接读 GitHub releases，所以这张表不会像手写版本号那样过期。

## 谁依赖了谁 {#which-module-pulls-in-which}

```
gonetdicom
 └── godicom
      ├── golibjpeg   ──┐
      ├── goopenjpeg  ──┼── ebitengine/purego  (不用 CGO 的 FFI)
      └── gorle         │
                        └── 纯 Go，无原生库
```

`golang.org/x/text` 是 godicom 另一个也是唯一的直接依赖；`purego` 和 `golang.org/x/sys` 是通过编解码器间接引入的。

## 编解码器不是可选的 {#the-codecs-are-not-optional}

这点值得直说，因为它是整个布局里最容易让人意外的地方。

godicom 的根包导入了 `godicom/pixels`，而 `pixels` 无条件导入全部三个编解码模块 —— 没有 build tag，没有注册钩子。所以：

```bash
go get github.com/godicom-dev/godicom
```

会把 **golibjpeg、goopenjpeg 和 gorle** 一并拉进你的模块图，连同 golibjpeg 与 goopenjpeg 内嵌的预编译原生库。你不需要主动开启，目前也没法关掉。

换来的是：所有传输语法开箱可用，在一台全新机器上也不需要 CMake、不需要 CGO 工具链 —— 这正是 purego 路线的全部意义。代价是：模块下载体积，以及构建的可移植性受限于内嵌库的可移植性。

## 原生编解码器的平台支持 {#platform-support-of-the-native-codecs}

`gorle` 是纯 Go，Go 能跑的地方它都能跑。`golibjpeg` 和 `goopenjpeg` 随包分发预编译动态库，所以只能在已经构建过库的平台上运行：

| 操作系统 | amd64 | arm64 |
|----|-------|-------|
| Linux | ✅ | ✅ |
| macOS | — | ✅ |
| Windows | ✅ | — |

Intel 版 macOS 和 ARM 版 Windows 没有覆盖。如果你需要其中之一，请到对应的编解码器仓库开 issue，而不是 godicom —— 构建矩阵在那边。

## 调用方不需要 CGO {#no-cgo-for-callers}

两个原生编解码器都通过
[`ebitengine/purego`](https://github.com/ebitengine/purego) 而非 CGO 加载自己的库。库本身用 `//go:embed` 内嵌，首次使用时释放出来。对你来说意味着：

- `CGO_ENABLED=0` 能正常构建
- 不需要 C 工具链、CMake 或 `pkg-config`
- 在上面的平台矩阵范围内，交叉编译和纯 Go 一样简单

重新构建原生库是维护者的活，在各编解码器仓库的 CI 里完成，产物会提交进仓库，所以 `go get` 的用户永远不用碰。

## 与 pydicom 的对齐 {#alignment-with-pydicom}

每个模块都是对着它的 Python 对照实现开发的：参考项目以只读 submodule 形式引入，测试夹具直接复用。目的不是做 Python 的逐句转写 —— API 就是 Go 的 API —— 而是让实现能被*除了自己对 DICOM 的理解之外*的东西校验一遍。

godicom 在
[PARITY.md](https://github.com/godicom-dev/godicom/blob/main/PARITY.md) 里维护覆盖度对照表，有意推迟的工作列在
[TODO.md](https://github.com/godicom-dev/godicom/blob/main/TODO.md)。

## 什么归谁管 {#what-lives-where}

如果你不确定问题该提到哪个仓库：

| 你想 | 模块 |
|-------------|--------|
| 读写一个 `.dcm` 文件 | godicom |
| 从压缩图像里取出像素 | godicom（`PixelArray`、`PixelFrames`） |
| 把 Pixel Data 压成另一种传输语法 | godicom（`CompressPixelData`） |
| 向 PACS 发送影像，或接收影像 | gonetdicom |
| 查询 PACS（C-FIND、QIDO-RS） | gonetdicom |
| 解一个不在 DICOM 数据集里的裸 `.j2k` / `.jpg` | goopenjpeg / golibjpeg |
| 就某个具体码流报解码器 bug | 对应的编解码器模块 |
| 处理特定 SOP Class、DICOMDIR 或结构化报告 | 目前都不支持 —— 见 godicom 的 TODO |
