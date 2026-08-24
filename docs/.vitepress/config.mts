import { defineConfig } from 'vitepress'

// This repository is godicom-dev.github.io — an organisation site, served from
// the domain root. Hence base: '/' and no repository-name prefix anywhere.
//
// English lives at the root rather than under /en/. That is deliberate: a
// Chinese locale can be added later as locales.zh without moving a single
// English URL, so nothing here has to be redirected when it arrives.
export default defineConfig({
  title: 'godicom',
  titleTemplate: ':title | godicom-dev',
  description: 'DICOM for Go — datasets, pixel data, networking, and codecs.',
  lang: 'en-US',
  base: '/',
  lastUpdated: true,

  // A broken link is a documentation bug, so fail the build on one rather than
  // shipping it.
  ignoreDeadLinks: false,

  head: [
    ['meta', { name: 'theme-color', content: '#007d9c' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'godicom-dev' }],
  ],

  themeConfig: {
    search: { provider: 'local' },

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Ecosystem', link: '/ecosystem' },
      {
        text: 'Modules',
        items: [
          { text: 'godicom — datasets & pixel data', link: '/godicom/' },
          { text: 'gonetdicom — DIMSE & DICOMweb', link: '/gonetdicom/' },
          { text: 'goopenjpeg — JPEG 2000 / HTJ2K', link: '/goopenjpeg/' },
          { text: 'golibjpeg — JPEG / JPEG-LS', link: '/golibjpeg/' },
          { text: 'gorle — RLE Lossless', link: '/gorle/' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'pkg.go.dev', link: 'https://pkg.go.dev/github.com/godicom-dev/godicom' },
          { text: 'DICOM standard', link: 'https://www.dicomstandard.org/current' },
          { text: 'pydicom', link: 'https://pydicom.github.io/pydicom/stable/' },
        ],
      },
    ],

    // One collapsible group per module, so every module of the organisation has
    // its own chapter and stays reachable from any page.
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is godicom-dev?', link: '/' },
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'The ecosystem', link: '/ecosystem' },
        ],
      },
      {
        text: 'godicom',
        collapsed: false,
        items: [
          { text: 'Overview', link: '/godicom/' },
          { text: 'Datasets', link: '/godicom/datasets' },
          { text: 'Diagnostics', link: '/godicom/diagnostics' },
          { text: 'Pixel Data', link: '/godicom/pixel-data' },
          { text: 'DICOM JSON', link: '/godicom/json' },
          { text: 'Logging', link: '/godicom/logging' },
          { text: 'CLI', link: '/godicom/cli' },
        ],
      },
      {
        text: 'gonetdicom',
        collapsed: true,
        items: [
          { text: 'Overview', link: '/gonetdicom/' },
          { text: 'SCU — sending', link: '/gonetdicom/scu' },
          { text: 'SCP — serving', link: '/gonetdicom/scp' },
          { text: 'DICOMweb', link: '/gonetdicom/dicomweb' },
        ],
      },
      {
        text: 'goopenjpeg',
        collapsed: true,
        items: [{ text: 'Overview', link: '/goopenjpeg/' }],
      },
      {
        text: 'golibjpeg',
        collapsed: true,
        items: [{ text: 'Overview', link: '/golibjpeg/' }],
      },
      {
        text: 'gorle',
        collapsed: true,
        items: [{ text: 'Overview', link: '/gorle/' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/godicom-dev' }],

    editLink: {
      pattern: 'https://github.com/godicom-dev/godicom-dev.github.io/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    outline: { level: [2, 3] },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'godicom-dev',
    },
  },
})
