# DICOMweb

[`dicomweb`](https://pkg.go.dev/github.com/godicom-dev/gonetdicom/dicomweb) 包实现 PS3.18 的 HTTP 事务 —— WADO-RS 取回、STOW-RS 存储、QIDO-RS 检索 —— 另外还有一个供测试与演示用的小型源服务器。

```go
import "github.com/godicom-dev/gonetdicom/dicomweb"
```

## 客户端 {#the-client}

```go
client := &dicomweb.Client{BaseURL: "https://pacs.example/dicom-web"}
```

或者带上选项：

```go
client, err := dicomweb.NewClient("https://pacs.example/dicom-web",
	dicomweb.WithTimeout(30*time.Second),
	dicomweb.WithTLSConfig(&tls.Config{MinVersion: tls.VersionTLS12}),
	dicomweb.WithLogger(logger),
)
```

## STOW-RS —— 存储 {#stow-rs-store}

```go
_, err := client.StoreFiles(ctx, "", []*godicom.FileDataset{fd})
```

第二个参数是要存进去的 study UID；空表示由服务端从实例里自行判断。

## WADO-RS —— 取回 {#wado-rs-retrieve}

```go
raw, err := client.RetrieveInstance(ctx, studyUID, seriesUID, sopUID)
parts, err := client.RetrieveSeries(ctx, studyUID, seriesUID)
meta, err := client.RetrieveInstanceMetadata(ctx, studyUID, seriesUID, sopUID)
bulk, err := client.RetrieveBulkData(ctx, studyUID, seriesUID, sopUID)
```

渲染式取回，当你要的是一幅图像而不是一个数据集时 —— windowing 和编码都由服务端做：

```go
mt, img, err := client.RetrieveRenderedInstance(ctx, studyUID, seriesUID, sopUID,
	dicomweb.RenderOptions{
		MediaType: dicomweb.MediaTypeJPEG,
		Quality:   90,
	})
```

它把 media type 和字节一起返回，因为服务端是允许给你一个跟你要的不一样的东西的。

::: tip 渲染还是解码？
`RetrieveRenderedInstance` 让服务端干活，交给你 JPEG 或 PNG。取回实例再调
[`DisplayFrame`](/zh/godicom/pixel-data#display-ready-bytes) 则是让 godicom 在本地干，用你选定的 LUT。后者可复现，前者只要一个来回。
:::

## QIDO-RS —— 检索 {#qido-rs-search}

```go
matches, err := client.SearchStudies(ctx, url.Values{"PatientID": {"P001"}})
```

查询参数就是普通的 `url.Values`，所以整套 QIDO-RS 词汇 —— matching key、`includefield`、`limit`、`offset`、`fuzzymatching` —— 都能用，中间不隔着一层 builder API。

## 源服务器 {#the-origin-server}

一个 DICOMweb 源服务器 MVP，定位是测试与演示，不是 PACS：

```go
store := dicomweb.NewMemoryStore()
http.ListenAndServe(":8080", dicomweb.Handler(store, "/dicom-web"))
```

`Handler` 返回一个普通的 `http.Handler`，所以它能挂进你已有的任何路由；`NewMemoryStore` 把一切放在内存里 —— 这让它成为一个真正好用的测试替身，供那些要跟 DICOMweb 端点打交道的代码使用。

## 该用哪一个 {#which-one-to-use}

DIMSE 和 DICOMweb 用不同手段抵达同样的数据，而选择通常是由你必须对接的东西替你做的。大致如下：

| | DIMSE | DICOMweb |
|--|-------|----------|
| 传输 | TCP，端口 104 / 11112 / 2762 | HTTP(S) |
| 穿过防火墙或代理 | 麻烦 | 平常 |
| 取回单个实例 | C-GET 或 C-MOVE | 一次 `GET` |
| 推送 | C-STORE | STOW-RS |
| 检索 | C-FIND | QIDO-RS |
| 服务端渲染 | 无 | 有 |

DIMSE 那一侧见 [SCU](/zh/gonetdicom/scu) 和 [SCP](/zh/gonetdicom/scp)。
