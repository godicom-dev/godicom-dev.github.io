# CLI

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

## show

```bash
godicom show ct.dcm
```

Prints the filename, the File Meta Information, the transfer syntax, the element
count, and every top-level element.

| Flag | Effect |
|------|--------|
| `-no-meta` | skip the File Meta section |
| `-top` | with `-t`, do not recurse into sequences |
| `-t <tag>` | show only elements with this tag — keyword or hex, repeatable |
| `-tag <tag>` | alias for `-t` |
| `-debug` | emit reader debug logs to stderr |

`-t` takes whatever `godicom.ParseTag` accepts, so a keyword and a hex tag are
interchangeable:

```bash
godicom show -t PatientName -t 00100020 ct.dcm
godicom show -t ReferencedImageSequence ct.dcm        # recurses by default
godicom show -t ReferencedImageSequence -top ct.dcm   # top level only
```

With `-t` the output ends with a count of matching elements rather than the total.

### Debugging a file that will not read

```bash
godicom show -debug suspect.dcm
```

`-debug` attaches a `slog` text handler at `LevelDebug` to the read, so you get
the per-element header trace on stderr while the dataset goes to stdout — which
means you can redirect them apart:

```bash
godicom show -debug suspect.dcm > dataset.txt 2> trace.log
```

See [Logging](/godicom/logging) for what the trace contains.

## readcopy

```bash
godicom readcopy in.dcm out.dcm
```

Reads, writes, and reads the result back, reporting the element count at each
step:

```
Read 148 elements from in.dcm
Written to out.dcm
Re-read 148 elements from out.dcm
```

It exits non-zero if the count changed, which makes it usable as a round-trip
check in a script — a cheap way to find out whether godicom can hold on to
everything in a file from a particular device.
