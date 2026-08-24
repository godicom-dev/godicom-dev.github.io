# gonetdicom

[![Release](https://img.shields.io/github/v/release/godicom-dev/gonetdicom?label=release&color=007d9c)](https://github.com/godicom-dev/gonetdicom/releases)
[![CI](https://github.com/godicom-dev/gonetdicom/actions/workflows/ci.yml/badge.svg)](https://github.com/godicom-dev/gonetdicom/actions/workflows/ci.yml)
[![GoDoc](https://pkg.go.dev/badge/github.com/godicom-dev/gonetdicom)](https://pkg.go.dev/github.com/godicom-dev/gonetdicom)

*gonetdicom* 实现 DICOM 网络协议和 DICOMweb（PS3.18）事务。[godicom](/zh/godicom/) 关心的是一个数据集的字节，gonetdicom 关心的是把它们在机器之间搬动。

```bash
go get github.com/godicom-dev/gonetdicom@latest
```

```
gonetdicom
 └── github.com/godicom-dev/godicom
```

数据集和像素 I/O 来自 godicom；gonetdicom 负责 Upper Layer PDU、DIMSE command set、关联协商，以及 HTTP DICOMweb。DIMSE 行为与
[pynetdicom](https://github.com/pydicom/pynetdicom) 对齐，以 git submodule 形式复用它的夹具；DICOMweb 遵循 PS3.18。

## 包 {#packages}

| 包 | 职责 |
|---------|------|
| [`ae`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/ae) | Application Entity —— 以 SCU 或 SCP 建立关联、TLS、角色选择、用户身份 |
| [`dimse`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/dimse) | DIMSE command set，C- 与 N- 服务 |
| [`pdu`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/pdu) | Upper Layer PDU 与 PDV 分片 |
| [`dicomweb`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/dicomweb) | WADO-RS / STOW-RS / QIDO-RS 客户端，以及一个源服务器 MVP |
| [`status`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/status) | 具名的 DIMSE 状态常量 |

日常要写的东西几乎都在 `ae` 里。

## 两种形态 {#the-two-shapes}

**作为 SCU** —— 由你发起。`ae.Dial` 协商一个关联并返回 `*ae.Association`，你在它上面发 DIMSE 消息：

```go
assoc, err := ae.Dial(ctx, ae.Config{AETitle: "MYSCU"}, "pacs.example:11112", "ANY-SCP")
if err != nil {
	log.Fatal(err)
}
defer assoc.Abort()

if err := assoc.CEcho(ctx); err != nil {
	log.Fatal(err)
}
if err := assoc.Release(ctx); err != nil {
	log.Fatal(err)
}
```

**作为 SCP** —— 由你接受。`ae.Serve` 在一个 listener 上阻塞，把请求分派给你配置的 handler：

```go
err := ae.Serve(ctx, ln, ae.ServerConfig{
	AETitle:                  "STORESCP",
	AcceptedAbstractSyntaxes: ae.AllStorageSOPClasses,
	OnCStore:                 handleStore,
})
```

## 服务 {#services}

| 服务 | SCU 方法 | SCP handler |
|---------|-----------|-------------|
| C-ECHO | `CEcho` | 内置 |
| C-STORE | `CStore` | `OnCStore` |
| C-FIND | `CFind` | `OnCFind` |
| C-MOVE | `CMove` | `OnCMove` |
| C-GET | `CGet` | `OnCGet` |
| C-CANCEL | `CCancel` | — |
| N-EVENT-REPORT | `NEventReport` | `OnNEventReport` |
| N-GET | `NGet` | `OnNGet` |
| N-SET | `NSet` | `OnNSet` |
| N-ACTION | `NAction` | `OnNAction` |
| N-CREATE | `NCreate` | `OnNCreate` |
| N-DELETE | `NDelete` | `OnNDelete` |

## 本站相关页面 {#on-this-site}

- **[SCU — 发送](/zh/gonetdicom/scu)** —— 验证、存储、查询/取回、DIMSE-N、TLS、用户身份
- **[SCP — 提供服务](/zh/gonetdicom/scp)** —— 存储、查询、move 目的地、身份协商
- **[DICOMweb](/zh/gonetdicom/dicomweb)** —— 客户端，以及源服务器 MVP

## 日志 {#logging}

默认静默，等同于不去设 pynetdicom 的 `debug_logger`。`Config`/`Client` 上的 logger 优先于 context 里的：

```go
assoc, err := ae.Dial(ctx, ae.Config{AETitle: "MYSCU", Logger: logger}, addr, "ANY-SCP")

ctx = gonetdicom.WithLogger(ctx, logger) // shared with godicom.ReadFileContext etc.
```

在 `LevelDebug` 下，AE 会记录 PDU 收发和 DIMSE 命令摘要，属性键固定：`component`、`calling_ae`、`called_ae`、`pdu_type_name`、`command_name`、`pc_id`、`message_id`、`status`。

## 对着真实 PACS 测试 {#testing-against-a-real-pacs}

一个可选的浸泡测试，除非环境变量指明了 PACS，否则跳过：

```bash
GONETDICOM_PACS_ADDR=host:11112 GONETDICOM_PACS_AE=ANY-SCP \
  go test -tags=integration ./ae -run TestIntegrationCEchoPACS -v
```

## 仓库文档 {#repository-documents}

- [pkg.go.dev](https://pkg.go.dev/github.com/godicom-dev/gonetdicom) —— 完整 API 参考
- [CHANGELOG.md](https://github.com/godicom-dev/gonetdicom/blob/main/CHANGELOG.md)
- [TODO.md](https://github.com/godicom-dev/gonetdicom/blob/main/TODO.md) —— 推迟项与已知缺口
