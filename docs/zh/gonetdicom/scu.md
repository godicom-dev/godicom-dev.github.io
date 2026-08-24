# SCU — 发送

SCU 是发起关联的一方。`ae.Dial` 协商好关联并交回一个 `*ae.Association`；每个 DIMSE 服务都是它上面的一个方法。

```go
import "github.com/godicom-dev/gonetdicom/ae"

assoc, err := ae.Dial(ctx, cfg, "pacs.example:11112", "ANY-SCP")
```

最后一个参数是*被叫* AE title —— 你在跟谁说话。你自己的那个是 `cfg.AETitle`。

## 验证（C-ECHO） {#verification-c-echo}

全部内容就这些，也是对一个新对端该试的第一件事：

```go
package main

import (
	"context"
	"log"
	"time"

	"github.com/godicom-dev/gonetdicom/ae"
)

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

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
}
```

`Release` 是有序关闭，`Abort` 是强行中断。defer 一个 `Abort` 再在正常路径上调 `Release`，意味着 panic 或提前返回也仍然会把关联拆掉。

## 存储（C-STORE） {#storage-c-store}

你必须提议一个覆盖你要发的内容的 presentation context —— 以 SOP Class 作为 abstract syntax，加上至少一个传输语法：

```go
cfg := ae.Config{
	AETitle: "STORESCU",
	PresentationContexts: []ae.PresentationContext{{
		ID:               1,
		AbstractSyntax:   "1.2.840.10008.5.1.4.1.1.7", // Secondary Capture
		TransferSyntaxes: []string{"1.2.840.10008.1.2"},
	}},
}
assoc, err := ae.Dial(ctx, cfg, "pacs.example:11112", "ANY-SCP")
if err != nil {
	log.Fatal(err)
}
defer assoc.Abort()

res, err := assoc.CStore(ctx, ae.StoreRequest{
	AffectedSOPClassUID:    "1.2.840.10008.5.1.4.1.1.7",
	AffectedSOPInstanceUID: "1.2.3.4.5",
	Data:                   ds, // a godicom Dataset, or pre-encoded bytes
})
```

`AffectedSOPInstanceUID` 是可选的 —— 它可以来自数据集的 `SOPInstanceUID`，或者当你要生成一个时来自 `ae.NewInstanceUID()`。

## 查询与取回 {#query-and-retrieve}

### C-FIND {#c-find}

```go
matches, err := assoc.CFind(ctx, ae.FindRequest{
	QueryModel:     ae.PatientRootQueryRetrieveInformationModelFind,
	IdentifierData: query, // a Dataset holding the matching and return keys
})
```

### C-MOVE {#c-move}

对端把实例发给*第三个* AE，用 title 指名。那个 AE 必须是对端已经知道怎么联系的：

```go
matches, err := assoc.CMove(ctx, ae.MoveRequest{
	QueryModel:      ae.PatientRootQueryRetrieveInformationModelMove,
	MoveDestination: "STORESCP",
	IdentifierData:  query,
})
```

### C-GET {#c-get}

对端在*同一个*关联上把实例发回来，这意味着在此期间你的 SCU 必须充当 C-STORE SCP：

```go
matches, err := assoc.CGet(ctx, ae.GetRequest{
	QueryModel:     ae.PatientRootQueryRetrieveInformationModelGet,
	IdentifierData: query,
	OnCStore: func(_ context.Context, req ae.StoreRequest) uint16 {
		_ = req.Data // a decoded Dataset
		return status.Success
	},
})
```

::: warning 实践中角色选择不是可选项
面对真实 PACS，C-GET 还需要提议 SCP/SCU Role Selection，让对端愿意向请求方发 C-STORE：

```go
cfg := ae.Config{
	AETitle:              "GETSCU",
	PresentationContexts: []ae.PresentationContext{ /* Get model + storage SOP Class */ },
	RoleSelections: []pdu.RoleSelection{
		ae.BuildRole(string(uid.CTImageStorage), false, true), // requestor as SCP
	},
}
```

不加它，很多实现会把关联协商下来，然后就是什么也不发。
:::

### 取消 {#cancelling}

```go
err := assoc.CCancel(ctx, msgID, 0, ae.PatientRootQueryRetrieveInformationModelFind)
```

对尚未完成的 C-FIND、C-MOVE 或 C-GET 有效，并且可以在那个调用还阻塞着的时候从另一个 goroutine 安全调用。第三个参数是 presentation context ID；传 `0`，第四个参数 —— 查询模型的 abstract syntax —— 会替你把它解析出来。

## DIMSE-N 与 Storage Commitment {#dimse-n-and-storage-commitment}

```go
res, err := assoc.NAction(ctx, ae.ActionRequest{
	RequestedSOPClassUID:    ae.StorageCommitmentPushModelSOPClass,
	RequestedSOPInstanceUID: ae.StorageCommitmentPushModelSOPInstance,
	ActionTypeID:            dimse.StorageCommitmentActionTypeRequest,
	ActionInformationData:   info,
	OnNEventReport: func(_ context.Context, req ae.EventReportRequest) uint16 {
		return status.Success
	},
})
```

commitment 的结果可能在同一个关联上回来 —— 由上面的 `OnNEventReport` 处理 —— 也可能稍后在一个新关联上回来。后一种情况见 `EventReportRequest.AsyncDestination`。

`NGet`、`NSet`、`NCreate`、`NDelete` 和 `NEventReport` 在同一个关联上都可用。

## TLS 与超时 {#tls-and-timeouts}

```go
assoc, err := ae.Dial(ctx, ae.Config{
	AETitle:     "MYSCU",
	IdleTimeout: 30 * time.Second,
	TLS:         &tls.Config{ServerName: "pacs.example", MinVersion: tls.VersionTLS12},
	Logger:      logger,
}, "pacs.example:2762", "ANY-SCP")
```

2762 是注册的 DICOM-TLS 端口，就像 11112 是注册的明文端口。

## 用户身份协商 {#user-identity-negotiation}

```go
assoc, err := ae.Dial(ctx, ae.Config{
	AETitle:      "IDSCU",
	UserIdentity: ae.UsernamePasscodeIdentity("alice", "secret", false),
}, addr, "IDSCP")
```

最后那个参数表示要求对端给出肯定响应。另一端见
[SCP — 提供服务](/zh/gonetdicom/scp#user-identity)。

## 状态码 {#status-codes}

DIMSE 状态是 `uint16` 值，含义随服务而变。请用
[`status`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/status) 里的具名常量而不是字面量 —— `status.Success`、`status.ProcessingFailure` 等等。
