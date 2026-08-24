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
npm run build   # fails on a dead internal link
npm run check   # build, then check links, fragments and the en/zh mirror
npm run serve   # preview the built site
```

`ignoreDeadLinks` is off in
[`docs/.vitepress/config.mts`](docs/.vitepress/config.mts), so `npm run build`
also checks every internal link. Run `npm run check` before opening a PR — it
adds what the build does not cover: that every `#fragment` exists, and that the
two languages stay in step.

## Layout

The site is bilingual. English is served from the root and Simplified Chinese
from `/zh/`; English was never placed under `/en/`, so adding the second locale
moved no URL.

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
  zh/                      # the same tree, translated
  .vitepress/config.mts    # locales, nav, sidebar — one section per module
scripts/check-i18n.cjs     # link, fragment and mirror check over the build output
```

Every module of the organisation gets its own sidebar section, in both languages.
When a module is added, add a directory under `docs/`, the mirror under
`docs/zh/`, and a group in each `sidebar` array.

### Translating

Two rules keep the pair usable:

- **Every page exists in both trees.** VitePress's language switcher links to the
  mirrored path, so a missing translation is a 404 rather than a gap.
- **Every heading in `docs/zh` carries an explicit `{#anchor}`** equal to the
  anchor its English counterpart generates — `## 生态总览 {#the-ecosystem}`. That
  way a cross-page link keeps one fragment in both languages, and the outline and
  deep links do not drift apart.

Prose is translated; code, identifiers, comments inside samples, and shell
commands are not.

`npm run check` fails on a violation of either rule, so neither depends on
anyone remembering it.

## What this site is, and is not

It is a guide: what each module is for, how the pieces fit, and runnable
examples. It is not generated API reference —
[pkg.go.dev](https://pkg.go.dev/github.com/godicom-dev/godicom) is authoritative
for signatures, and wins wherever the two disagree.

## Contributing

Prose is British-English and plain. Code samples should compile against the
released versions of the modules they use; if you change one, check it. Changing
a page under `docs/` means changing its `docs/zh/` counterpart in the same commit.
Each page has an "Edit this page on GitHub" link at the bottom that lands on the
right file.

## Licence

MIT.
