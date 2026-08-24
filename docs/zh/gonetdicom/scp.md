# SCP — 提供服务

SCP 是接受关联的一方。你配置好愿意接受哪些 abstract syntax、由哪些 handler 来服务它们，然后把一个 listener 交给 `ae.Serve`。

```go
err := ae.Serve(ctx, ln, ae.ServerConfig{ /* … */ })
```

`ae.ListenAndServeTLS` 是 TLS 版本。

## 存储 SCP（C-STORE） {#storage-scp-c-store}

```go
package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"

	"github.com/godicom-dev/godicom"
	"github.com/godicom-dev/gonetdicom/ae"
	"github.com/godicom-dev/gonetdicom/status"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	ln, err := net.Listen("tcp", ":11112")
	if err != nil {
		log.Fatal(err)
	}

	err = ae.Serve(ctx, ln, ae.ServerConfig{
		AETitle:                  "STORESCP",
		AcceptedAbstractSyntaxes: ae.AllStorageSOPClasses,
		OnCStore: func(_ context.Context, req ae.StoreRequest) uint16 {
			if req.Data == nil || req.FileMeta == nil {
				return status.ProcessingFailure
			}
			fd := &godicom.FileDataset{Dataset: req.Data, FileMeta: req.FileMeta}
			err := fd.SaveAs(req.AffectedSOPInstanceUID+".dcm",
				&godicom.WriteOptions{EnforceFileFormat: true})
			if err != nil {
				return status.ProcessingFailure
			}
			return status.Success
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
```

有两点值得注意：

::: danger Serve 会一直阻塞到 ctx 被取消
不要把 SCU 示例里的 `context.WithTimeout` 拿来复用。十秒的超时会让服务器十秒后就关掉。通常你要的是 `signal.NotifyContext`。
:::

handler 在 `req.Data` 里收到一个解码好的 `*godicom.Dataset`，在 `req.FileMeta` 里收到 File Meta，所以写出一个合规的 Part 10 文件就是一次带 `EnforceFileFormat: true` 的 `SaveAs` —— 实例进来时所用的传输语法已经在 File Meta 里了。

## 接受的 abstract syntax {#accepted-abstract-syntaxes}

```go
AcceptedAbstractSyntaxes: ae.AllStorageSOPClasses  // every storage SOP Class
AcceptedAbstractSyntaxes: []string{"*"}            // anything the peer proposes
AcceptedAbstractSyntaxes: []string{string(uid.CTImageStorage)}
```

`"*"` 对测试用接收端很方便，对生产端则是个糟糕主意 —— 一个声称支持一切的 SCP，什么都会被发过来。

## Handler {#handlers}

| Handler | 服务 |
|---------|---------|
| `OnCStore` | C-STORE |
| `OnCFind` | C-FIND |
| `OnCMove` | C-MOVE |
| `OnCGet` | C-GET |
| `OnNEventReport` | N-EVENT-REPORT |
| `OnNGet` | N-GET |
| `OnNSet` | N-SET |
| `OnNAction` | N-ACTION |
| `OnNCreate` | N-CREATE |
| `OnNDelete` | N-DELETE |
| `OnUserIdentity` | 身份协商 |

每个都返回一个 DIMSE 状态 —— 用
[`status`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/status) 里的常量。

C-ECHO 不需要 handler，它已经替你答了。

## Move 目的地 SCP（C-MOVE） {#move-destination-scp-c-move}

C-MOVE 意味着*由你*再开一个关联到第三个 AE，并把实例发到那里。目的地按 AE title 指名，而你要声明自己知道怎么联系哪些 title：

```go
err := ae.Serve(ctx, moveLn, ae.ServerConfig{
	AETitle: "MOVESCP",
	AcceptedAbstractSyntaxes: []string{
		ae.PatientRootQueryRetrieveInformationModelMove,
	},
	MoveDestinations: map[string]ae.MoveDestination{
		"STORESCP": {Addr: "127.0.0.1:11112", MaxAssociations: 4},
	},
	OnCMove: func(_ context.Context, req ae.MoveRequest) ae.MovePlan {
		return ae.MovePlan{Stores: []ae.StoreRequest{{ /* … */ }}}
	},
})
```

`OnCMove` 返回一份计划而不是自己去发：你说明什么该存到哪里，gonetdicom 负责开关联并执行这些子操作。`MaxAssociations` 限制一个目的地最多能并行拿到几个关联。

## 用户身份 {#user-identity}

```go
err := ae.Serve(ctx, ln, ae.ServerConfig{
	AETitle: "IDSCP",
	OnUserIdentity: func(req pdu.UserIdentityRQ) (bool, []byte) {
		return string(req.PrimaryField) == "alice", nil
	},
})
```

返回 `false` 则拒绝该关联。那个 `[]byte` 是服务端响应字段，供带响应的身份类型使用。

`OnUserIdentity` 为 nil 时会接受关联并省掉任何 AC 响应项 —— 所以不设它不会误伤那些提议了身份的对端。

## 角色 {#roles}

一个同时也需要发送的 SCP —— 也就是 C-GET 提供方 —— 要协商 SCP/SCU 角色选择。`ae.BuildRole` 构造这些项；镜像的一侧见
[SCU 侧的角色选择](/zh/gonetdicom/scu#c-get)。
