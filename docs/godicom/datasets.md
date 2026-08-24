# Datasets

A `Dataset` is a collection of `DataElement`s keyed by `Tag`. A `FileDataset`
wraps one with the things a Part 10 file carries around it — the preamble, the
File Meta Information, and the filename it came from:

```go
type FileDataset struct {
	*Dataset
	Filename  string
	Preamble  []byte
	FileMeta  *FileMetaDataset
	Timestamp string
}
```

Because `*Dataset` is embedded, every method below works on both.

## Reading

| Entry point | Source |
|-------------|--------|
| `ReadFile(filename, opts)` | a path |
| `Read(r, opts)` | any `io.Reader` |
| `ReadBytes(data, opts)` | a `[]byte` |
| `DecodeDataset(data, ts)` | dataset bytes with **no** File Meta, transfer syntax given |
| `DecodeDatasetEncoding(data, isImplicitVR, isLittleEndian)` | the same, encoding given directly |

Each has a `…Context` variant taking a `context.Context` first, for cancellation
and request-scoped logging: `ReadFileContext`, `ReadContext`, `ReadBytesContext`,
`DecodeDatasetContext`, `DecodeDatasetEncodingContext`.

Prefer a seekable source — an `*os.File` rather than a wrapped stream — so that
`StopBeforePixels`, `DeferSize` and `SpecificTags` can skip large values instead
of buffering them.

### ReadOptions

```go
type ReadOptions struct {
	DeferSize        uint32
	StopBeforePixels bool
	Force            bool
	SpecificTags     []Tag
	Logger           *slog.Logger
	OnDiagnostic     func(Diagnostic) error
}
```

- **`DeferSize`** — values larger than this many bytes are not read up front.
  The element is present, and its value is loaded on first access.
- **`StopBeforePixels`** — stop at *Pixel Data*. The fast path when you only
  want the header.
- **`Force`** — read a file that has no DICM prefix, the way pydicom's
  `force=True` does.
- **`SpecificTags`** — read only these tags (plus the group-length and File Meta
  elements needed to get there).
- **`Logger`** — see [Logging](/godicom/logging).
- **`OnDiagnostic`** — see [Diagnostics](/godicom/diagnostics).

### Deferred values

With `DeferSize` set, a large value is a promise rather than a buffer. Accessing
it through `Get` triggers the load; `LoadDeferred` does it explicitly:

```go
ds, err := godicom.ReadFile("ct.dcm", &godicom.ReadOptions{DeferSize: 1024})
if err != nil {
	log.Fatal(err)
}
// … later, when the pixels are actually needed:
if err := ds.LoadDeferred(tag.PixelData); err != nil {
	log.Fatal(err) // the file moved, or changed under us
}
```

`FileDataset.Timestamp` is the source file's modification time, and a deferred
load checks it — a file rewritten behind your back does not silently yield the
wrong bytes. If a deferred load fails after the read returned, it is reported
through `ReadOptions.OnDiagnostic`, which is why that hook must be safe to call
from wherever the dataset is used.

## Reading elements

Typed getters return the value and whether it was there:

```go
name, ok := ds.GetString(tag.PatientName)
rows, ok := ds.GetInt(tag.Rows)
thickness, ok := ds.GetFloat(tag.SliceThickness)
spacing, ok := ds.GetFloats(tag.PixelSpacing)
raw, ok := ds.GetBytes(tag.PixelData)
seq, ok := ds.GetSequence(tag.ReferencedImageSequence)
```

For VRs with their own semantics there are VR-typed getters that preserve them
rather than flattening to a Go primitive — `GetDA`, `GetTM`, `GetDT`, `GetIS`,
`GetDS`, `GetPN`:

```go
pn, ok := ds.GetPN(tag.PatientName) // PersonName: family, given, middle, prefix, suffix
da, ok := ds.GetDA(tag.StudyDate)
```

`StringValue`, `IntValue`, `FloatValue`, `BytesValue` and `SequenceValue` are
one-line aliases for the corresponding `Get*` — same behaviour, pick whichever
reads better where you are.

For the element itself, rather than its value: `Get`, `GetDataElement`,
`ElementByKeyword`, `Has`, `Len`.

## Writing elements

The setters take the VR from the data dictionary and reject a value the VR
cannot hold, at the call site:

```go
ds.SetString(tag.PatientID, "12345678")
ds.SetStrings(tag.ImageType, "DERIVED", "SECONDARY")
ds.SetInt(tag.Rows, 512)
ds.SetInts(tag.AcquisitionMatrix, 0, 256, 256, 0)
ds.SetFloat(tag.SliceThickness, 1.5)
ds.SetFloats(tag.PixelSpacing, 0.5, 0.5)
ds.SetBytes(tag.PixelData, raw)
ds.SetSequence(tag.ReferencedImageSequence, seq)
```

They all return an `error` — check it. `SetFloat(tag.EchoNumbers, 1.5)` fails,
because `EchoNumbers` is an `IS` and an `IS` holds no floating-point values.

There are VR-typed setters to match the VR-typed getters, for when you have the
VR's own type in hand rather than a Go primitive — `SetDA`, `SetTM`, `SetDT`,
`SetIS`, `SetDS`, `SetPN`:

```go
ds.SetPN(tag.PatientName, pn)
ds.SetDA(tag.StudyDate, da)
```

Two escape hatches, in increasing order of how much you are taking on yourself:

```go
// VR from the dictionary, value type NOT checked against it.
ds.SetValue(tag.PatientID, "12345678")

// VR supplied by you. For private tags and anything else the dictionary
// does not know. Note it returns nothing: there is no dictionary left to
// disagree with you.
ds.Set(godicom.NewDataElement(tag.New(0x0009, 0x0010), godicom.VRLO, "ACME"))
```

Values a setter cannot judge — in range for their Go type but not for their VR —
are caught on the way out instead, by
[`WriteOptions.OnDiagnostic`](/godicom/diagnostics#values-a-strict-receiver-would-reject).

Removing: `Delete`, `Pop`, `Clear`, `RemovePrivateTags`.

## Sequences

A `Sequence` is a list of `*Dataset` items:

```go
item := godicom.NewDataset()
if err := item.SetString(tag.CodeValue, "T-A0100"); err != nil {
	log.Fatal(err)
}
if err := item.SetString(tag.CodingSchemeDesignator, "SRT"); err != nil {
	log.Fatal(err)
}

seq := godicom.NewSequence([]*godicom.Dataset{item})
seq.Append(anotherItem)

if err := ds.SetSequence(tag.AnatomicRegionSequence, seq); err != nil {
	log.Fatal(err)
}
```

Reading back:

```go
if seq, ok := ds.GetSequence(tag.AnatomicRegionSequence); ok {
	for _, item := range seq.Items() {
		code, _ := item.GetString(tag.CodeValue)
		fmt.Println(code)
	}
}
```

`Len`, `Get(i)`, `IsEmpty` and `Items` are the whole surface.

## Private tags

```go
block := ds.PrivateBlock(0x0009, "ACME MEDICAL")
ds.RemovePrivateTags()
```

## Walking a dataset

| Method | Order and depth |
|--------|-----------------|
| `Iter()` | top-level elements, tag order |
| `IterAll()` | every element, recursing into sequences (pydicom's `iterall`) |
| `Walk(fn, recursive)` | callback per element in tag order (pydicom's `walk`) |
| `SortedTags()` | the tags, sorted |
| `Elements()` | the underlying `map[Tag]*DataElement` |
| `GroupDataset(group)` | a new `Dataset` of one group only |

Whole-dataset operations: `Clone`, `Equal`, `Update`, `String`, `Top`,
`FormattedLines`.

## Tags and UIDs

Tags come from the `tag` package as constants, and there are four ways to get one
at runtime:

```go
t := tag.New(0x0010, 0x0010)             // group and element
t, err := tag.Parse("(0010,0010)")       // also "0010,0010" and "00100010"
t = tag.MustParse("(0010,0010)")         // panics instead, for package vars
t, ok := tag.ByKeyword("PatientName")    // from the dictionary keyword
```

`tag.FromKeyword` is the error-returning form of `ByKeyword`, and `tag.Keyword`
goes the other way. At the root, `godicom.ParseTag` accepts any of the string
forms *or* a group/element pair, which is what the CLI's `-t` flag uses;
`godicom.TagFromKeyword` is the keyword lookup.

`Tag` also answers the questions you would otherwise write yourself:
`Group`, `Element`, `IsPrivate`, `IsPrivateCreator`, `PrivateCreator`, and
`JSONKey` for the DICOM JSON Model.

For UIDs, `uid.UID` carries the dictionary with it, so branching on a transfer
syntax needs no table of your own. `FileDataset.TransferSyntaxUID` reads it out of
the File Meta for you:

```go
ts, ok := fd.TransferSyntaxUID()
if ok && ts.IsEncapsulated() {
	// compressed frames, in items
}
fmt.Println(ts.Name(), ts.IsCompressed(), ts.IsDeflated(),
	ts.IsImplicitVR(), ts.IsLittleEndian())
```

`IsTransferSyntax`, `IsRetired`, `IsPrivate`, `IsValid`, `Keyword`, `Type` and
`ExtraInfo` round it out, and `uid.Lookup` resolves a keyword to a UID.

Generating one:

```go
u, err := uid.GenerateUID()                            // the godicom root
u, err = uid.GenerateUID(uid.WithPrefix("1.2.3.4."))   // your own org root
u, err = uid.GenerateUID(uid.WithUUIDPrefix())         // 2.25.<uuid>, PS3.5 B.2
```

`uid.MustGenerateUID` panics rather than returning an error, and
`uid.WithEntropy` mixes in your own strings for reproducible generation.

## Writing

| Entry point | Produces |
|-------------|----------|
| `WriteFile(filename, ds *Dataset, opts)` | a Part 10 file, File Meta derived from the dataset |
| `FileDataset.SaveAs(filename, opts)` / `Dataset.SaveAs(filename, opts)` | the same, method form |
| `Write(w, fd *FileDataset, opts)` / `FileDataset.Write(w, opts)` | Part 10 bytes to an `io.Writer` |
| `EncodeFile(fd *FileDataset, opts)` / `FileDataset.EncodeFile(opts)` | Part 10 bytes in memory |
| `WriteDataset(w, ds *Dataset, ts)` / `EncodeDataset(ds, ts)` | dataset bytes, no preamble or File Meta |
| `Dataset.Encode(ts)` / `Dataset.EncodeEncoding(implicit, littleEndian)` | the same, method form |

The `*FileDataset` entry points are the ones that carry a preamble and an
existing File Meta through; `WriteFile` takes a bare `*Dataset` and derives the
File Meta, which is why it pairs with `EnforceFileFormat`.

### WriteOptions

```go
type WriteOptions struct {
	ImplicitVR        *bool
	LittleEndian      *bool
	EnforceFileFormat bool
	Logger            *slog.Logger
	OnDiagnostic      func(Diagnostic) error
}
```

`ImplicitVR` and `LittleEndian` are pointers so that "leave it as it was" is
distinguishable from "make it explicit little endian". Left nil, a dataset read
from a file is written back in the encoding it arrived in.

`EnforceFileFormat` requires a conformant Part 10 result and fills the File Meta
in from the dataset. It is what you want when you are creating a file rather
than round-tripping one — and it will tell you what is missing:

```
required File Meta Information elements are missing or empty:
[(0002,0002) MediaStorageSOPClassUID (0002,0003) MediaStorageSOPInstanceUID]
```

which means the dataset needs `SOPClassUID` and `SOPInstanceUID` set.

::: warning
`WriteDataset` and `EncodeDataset` take no `*WriteOptions`, so they can carry no
diagnostic hook. If you want write diagnostics, use a path that takes options.
:::

## Dataset bytes with no File Meta

What a DIMSE message or a multipart DICOMweb payload carries:

```go
data, err := ds.Encode(uid.ExplicitVRLittleEndian)
parsed, err := godicom.DecodeDataset(data, uid.ExplicitVRLittleEndian)
```

## Encoding of a re-read dataset

`SetOriginalEncoding` and `SetWriteEncoding` set the encoding explicitly;
`IsOriginalEncoding` reports whether a dataset would be written back exactly as
it was read. Values that have not been touched are written from the bytes they
were read as, which is both faster and lossless — and the reason such values are
never offered to the write diagnostic hook.
