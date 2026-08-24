# godicom-dev.github.io

Documentation site for the [godicom-dev](https://github.com/godicom-dev)
organisation — DICOM for Go. Built with [VitePress](https://vitepress.dev) and
deployed to GitHub Pages by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on every push to
`main`.

Published at <https://godicom-dev.github.io>.

## Local development

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # what CI runs; fails on a dead internal link
npm run serve   # preview the built site
```

`ignoreDeadLinks` is off in
[`docs/.vitepress/config.mts`](docs/.vitepress/config.mts), so `npm run build`
also checks every internal link. Run it before opening a PR.

## Layout

```
docs/
  index.md                 # home
  ecosystem.md             # how the modules fit together
  guide/getting-started.md
  godicom/                 # datasets, diagnostics, pixel data, JSON, logging, CLI
  gonetdicom/              # DIMSE SCU/SCP, DICOMweb
  goopenjpeg/              # JPEG 2000, HTJ2K
  golibjpeg/               # JPEG, JPEG-LS
  gorle/                   # RLE Lossless
  .vitepress/config.mts    # nav, sidebar, one section per module
```

Every module of the organisation gets its own sidebar section. When a module is
added, add a directory under `docs/` and a group in the `sidebar` array.

## What this site is, and is not

It is a guide: what each module is for, how the pieces fit, and runnable
examples. It is not generated API reference —
[pkg.go.dev](https://pkg.go.dev/github.com/godicom-dev/godicom) is authoritative
for signatures, and wins wherever the two disagree.

## Contributing

Prose is British-English and plain. Code samples should compile against the
released versions of the modules they use; if you change one, check it. Each page
has an "Edit this page on GitHub" link at the bottom that lands on the right
file.

## Licence

MIT.
