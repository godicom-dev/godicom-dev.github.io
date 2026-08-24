# Logging

*godicom* uses the standard library's
[`log/slog`](https://pkg.go.dev/log/slog). By default it is **silent** — the
default logger discards everything, in the same spirit as leaving pydicom's
`config.debug()` off.

## Turning it on

Per call, which is what you usually want:

```go
h := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug})
logger := slog.New(h)

ds, err := godicom.ReadFile("ct.dcm", &godicom.ReadOptions{Logger: logger})
```

Through the context, for request-scoped logging shared with
[gonetdicom](/gonetdicom/):

```go
ctx := godicom.WithLogger(context.Background(), logger)
ds, err := godicom.ReadFileContext(ctx, "ct.dcm", nil)
```

Or process-wide:

```go
godicom.SetDefaultLogger(logger)
```

## Which logger wins

For any given call:

1. `ReadOptions.Logger` / `WriteOptions.Logger`, if set
2. otherwise the context logger, via `LoggerFromContext`
3. otherwise `DefaultLogger()`

| Function | |
|----------|--|
| `WithLogger(ctx, l)` | attach a logger to a context |
| `LoggerFromContext(ctx)` | read it back |
| `SetDefaultLogger(l)` | set the process-wide fallback |
| `DefaultLogger()` | read it |

## What the reader logs

At `LevelDebug` the reader emits the same events as pydicom's debugger: the
FMI/DICM preamble, a per-element header with a value preview (the first 20
bytes), deferred-value skips, and sequence item boundaries.

Records use fixed attribute keys, chosen to line up with pydicom's filereader
diagnostics so that a trace from either can be read the same way:

`component`, `offset`, `offset_hex`, `hex`, `tag`, `vr`, `len`,
`undefined_length`, `value_hex`, `value`, `transfer_syntax`

Because the keys are fixed, a JSON handler gives you a trace you can query:

```go
h := slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelDebug})
```

```bash
godicom show -debug suspect.dcm 2>&1 >/dev/null | grep '"tag":"(7FE0,0010)"'
```

## Logging versus diagnostics

These answer different questions and it is worth not confusing them:

- **Logging** is a trace of what the reader did. It is for you, at a terminal,
  when a file will not parse and you want to see how far it got.
- **[Diagnostics](/godicom/diagnostics)** are structured facts about anomalies,
  delivered to a callback, with a tag, an offset, and a sequence path. They are
  for your program — for deciding whether to accept a file, or for a report you
  hand to whoever operates the device that produced it.

If you find yourself parsing log lines to find out whether a file was truncated,
you want `OnDiagnostic` instead.

## The CLI shortcut

```bash
godicom show -debug file.dcm
```

attaches a text handler at `LevelDebug` for you. See [CLI](/godicom/cli).
