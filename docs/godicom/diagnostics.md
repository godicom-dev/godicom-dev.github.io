# Diagnostics

By default a read keeps whatever it parsed before the file stopped making sense.
That is what most DICOM tooling does, and it is also how a damaged file comes to
look healthy. `Diagnostic` is how godicom tells you instead.

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

One type covers both directions — the same struct is delivered to
`ReadOptions.OnDiagnostic` and `WriteOptions.OnDiagnostic`.

## The hook

```go
ds, err := godicom.ReadFile("truncated.dcm", &godicom.ReadOptions{
	OnDiagnostic: func(d godicom.Diagnostic) error {
		log.Printf("%s", d)
		return nil // keep parsing
	},
})
```

`Diagnostic` implements `error`, so returning it rejects the file:

```go
opts := &godicom.ReadOptions{
	OnDiagnostic: func(d godicom.Diagnostic) error { return d },
}
```

Return `nil` and you get the old, lenient behaviour with a record of what was
wrong. Return the diagnostic and you get a strict parser. There is no mode enum:
whether you set the hook, and what you return from it, is the setting.

## What gets reported

| Kind | Meaning |
|------|---------|
| `truncated_header` | The stream ends inside a data element header, so the element and everything after it cannot be parsed. |
| `truncated_value` | An element declares more value bytes than the stream holds. Either the file is cut short or the length field is wrong; the reader cannot tell which. |
| `truncated_item` | The stream ends inside a sequence item header. |
| `deferred_value_unreadable` | An element parsed as deferred could not be loaded when its value was finally requested. |
| `vr_mismatch` | An explicit-VR element carries a VR the data dictionary cannot reconcile with its tag. |
| `invalid_value` | A value handed to the **writer** cannot be spelled the way its VR requires. |

### Length anomalies

`Need` and `Have` are the byte counts the encoding called for and the byte counts
actually available. Both are zero when the anomaly is not about a length.

```go
reread, err := godicom.ReadBytes(data[:len(data)-4], &godicom.ReadOptions{
	OnDiagnostic: func(d godicom.Diagnostic) error {
		fmt.Printf("%s at %s: need %d, have %d\n", d.Kind, d.Tag, d.Need, d.Have)
		return nil
	},
})
// truncated_value at (0010,0010): need 8, have 4
```

The element is not in the result — `GetString` on it reports absent — but you
know exactly which one went missing and by how much.

### A VR the dictionary disagrees with

`vr_mismatch` is the one anomaly that changes nothing about the parse. godicom
keeps the VR the file gave it, because what the file says is what the file
means. `VR` holds the VR the file actually carried (the one godicom went on to
use) and `ExpectedVR` holds the one the dictionary gives the tag.

`ExpectedVR` is empty for every other kind — and also for a tag the dictionary
has no entry for, because an unrecognised or private tag has no expectation to
fall short of.

It is reported because it is usually the first useful thing to know when a real
device refuses your files.

### Deferred values that never arrive

A deferred load can fail long after `ReadFile` returned — the file moved, or was
rewritten. `deferred_value_unreadable` is reported at that moment, through the
hook you gave the original read. So the hook must be safe to call from wherever
the dataset gets used, not just from the read.

The tag stays visible to `SortedTags` and `Elements` while `Get` reports it as
absent.

## Where the anomaly was

`Offset` is the byte offset in the dataset being parsed. For a Deflated transfer
syntax it is an offset into the *inflated* bytes, not the file. It is zero for a
diagnostic raised while writing, which has no source to point into.

`Path` names the enclosing sequences, outermost first:

```go
type PathStep struct {
	Tag  Tag
	Item int // zero-based; -1 when the sequence was entered but no item was
}
```

It renders as `(0008,1140)[1] > (0008,1110)[1]`. PS3.5 gives sequence items an
ordinal position and nothing else to name them by, so without the index two
items of the same sequence produce diagnostics that read identically — which is
no help when one item of forty is the malformed one.

`Item` is `-1` when the sequence has been entered but no item has: the item
header itself was unreadable, or the anomaly concerns the sequence rather than
any one of its items. The subscript is dropped from the rendering in that case.

`Path` is nil for an anomaly in the top-level dataset.

## Values a strict receiver would reject

`WriteOptions.OnDiagnostic` is the same hook on the way out. It reports values
the writer would otherwise encode silently even though godicom's own reader
raises a diagnostic on the result — an `IS` outside `[-2^31, 2^31)`, a `DS`
longer than the 16 bytes PS3.5 allows, a fractional value in an `IS`:

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

Returning `nil` writes the value as it stands, so nothing an existing caller
writes changes; returning the diagnostic fails the write. That is the three-way
choice pydicom spells `IGNORE` / `WARN` / `RAISE` in
`config.settings.writing_validation_mode`, without needing a mode enum.

### Why the setters cannot do this alone

The dictionary-VR setters reject at the call site whatever they can see on their
own. `SetFloat(tag.EchoNumbers, 1.5)` fails immediately, because `EchoNumbers`
is an `IS` and an `IS` holds no floating-point values.

The hook is for what a setter cannot judge:

- a value in range for its Go type but not for its VR — `3000000000` is a fine
  Go `int`, and not a fine `IS`
- an element built directly with `Set(NewDataElement(tag, vr, value))`, where you
  supplied the VR and the dictionary was never consulted
- a value set through `SetValue`, which takes the VR from the dictionary but does
  not check the value against it

### What is never offered

Two things deliberately do not reach the write hook:

1. **Values written straight from the bytes they were read as.** Re-encoding is
   skipped for them, and the read that produced them already had its own chance
   to report.
2. **Writes through `WriteDataset` and `EncodeDataset`**, which take no
   `*WriteOptions` and so can carry no hook.

## Compile-checked examples

The read and write hooks are exercised by `ExampleReadOptions` and
`ExampleWriteOptions` in godicom's
[`example_test.go`](https://github.com/godicom-dev/godicom/blob/main/example_test.go).
They build their Part 10 bytes in memory, so they need no fixture, and `go test`
checks their output — including the exact diagnostic text quoted above.
