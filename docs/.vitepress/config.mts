import { defineConfig, type DefaultTheme } from 'vitepress'

// This repository is godicom-dev.github.io — an organisation site, served from
// the domain root. Hence base: '/' and no repository-name prefix anywhere.
//
// English lives at the root and Chinese under /zh/. English was never put under
// /en/, so adding the Chinese locale moved no English URL and nothing had to be
// redirected.
//
// Every heading in docs/zh carries an explicit {#anchor} equal to the anchor the
// English heading generates, so a cross-page link like
// /zh/ecosystem#the-codecs-are-not-optional resolves without translating the
// fragment. `npm run check` enforces it: the two trees must have the same pages
// and the same anchor on every page.

const modulesEn: DefaultTheme.NavItemWithLink[] = [
  { text: 'godicom — datasets & pixel data', link: '/godicom/' },
  { text: 'gonetdicom — DIMSE & DICOMweb', link: '/gonetdicom/' },
  { text: 'goopenjpeg — JPEG 2000 / HTJ2K', link: '/goopenjpeg/' },
  { text: 'golibjpeg — JPEG / JPEG-LS', link: '/golibjpeg/' },
  { text: 'gorle — RLE Lossless', link: '/gorle/' },
]

const modulesZh: DefaultTheme.NavItemWithLink[] = [
  { text: 'godicom — 数据集与 Pixel Data', link: '/zh/godicom/' },
  { text: 'gonetdicom — DIMSE 与 DICOMweb', link: '/zh/gonetdicom/' },
  { text: 'goopenjpeg — JPEG 2000 / HTJ2K', link: '/zh/goopenjpeg/' },
  { text: 'golibjpeg — JPEG / JPEG-LS', link: '/zh/golibjpeg/' },
  { text: 'gorle — RLE Lossless', link: '/zh/gorle/' },
]

const reference: DefaultTheme.NavItemWithLink[] = [
  { text: 'pkg.go.dev', link: 'https://pkg.go.dev/github.com/godicom-dev/godicom' },
  { text: 'DICOM standard', link: 'https://www.dicomstandard.org/current' },
  { text: 'pydicom', link: 'https://pydicom.github.io/pydicom/stable/' },
]

// One collapsible group per module, so every module of the organisation has its
// own chapter and stays reachable from any page.
const sidebarEn: DefaultTheme.SidebarItem[] = [
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
  { text: 'goopenjpeg', collapsed: true, items: [{ text: 'Overview', link: '/goopenjpeg/' }] },
  { text: 'golibjpeg', collapsed: true, items: [{ text: 'Overview', link: '/golibjpeg/' }] },
  { text: 'gorle', collapsed: true, items: [{ text: 'Overview', link: '/gorle/' }] },
]

const sidebarZh: DefaultTheme.SidebarItem[] = [
  {
    text: '简介',
    items: [
      { text: 'godicom-dev 是什么', link: '/zh/' },
      { text: '快速开始', link: '/zh/guide/getting-started' },
      { text: '生态总览', link: '/zh/ecosystem' },
    ],
  },
  {
    text: 'godicom',
    collapsed: false,
    items: [
      { text: '概览', link: '/zh/godicom/' },
      { text: '数据集', link: '/zh/godicom/datasets' },
      { text: '诊断', link: '/zh/godicom/diagnostics' },
      { text: 'Pixel Data', link: '/zh/godicom/pixel-data' },
      { text: 'DICOM JSON', link: '/zh/godicom/json' },
      { text: '日志', link: '/zh/godicom/logging' },
      { text: '命令行工具', link: '/zh/godicom/cli' },
    ],
  },
  {
    text: 'gonetdicom',
    collapsed: true,
    items: [
      { text: '概览', link: '/zh/gonetdicom/' },
      { text: 'SCU — 发送', link: '/zh/gonetdicom/scu' },
      { text: 'SCP — 提供服务', link: '/zh/gonetdicom/scp' },
      { text: 'DICOMweb', link: '/zh/gonetdicom/dicomweb' },
    ],
  },
  { text: 'goopenjpeg', collapsed: true, items: [{ text: '概览', link: '/zh/goopenjpeg/' }] },
  { text: 'golibjpeg', collapsed: true, items: [{ text: '概览', link: '/zh/golibjpeg/' }] },
  { text: 'gorle', collapsed: true, items: [{ text: '概览', link: '/zh/gorle/' }] },
]

export default defineConfig({
  title: 'godicom',
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

  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      titleTemplate: ':title | godicom-dev',
      description: 'DICOM for Go — datasets, pixel data, networking, and codecs.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/getting-started' },
          { text: 'Ecosystem', link: '/ecosystem' },
          { text: 'Modules', items: modulesEn },
          { text: 'Reference', items: reference },
        ],
        sidebar: sidebarEn,
        editLink: {
          pattern: 'https://github.com/godicom-dev/godicom-dev.github.io/edit/main/docs/:path',
          text: 'Edit this page on GitHub',
        },
        footer: {
          message: 'Released under the MIT License.',
          copyright: 'godicom-dev',
        },
      },
    },

    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      titleTemplate: ':title | godicom-dev',
      description: 'Go 语言的 DICOM 实现 —— 数据集、Pixel Data、网络通信与编解码器。',
      themeConfig: {
        nav: [
          { text: '指南', link: '/zh/guide/getting-started' },
          { text: '生态', link: '/zh/ecosystem' },
          { text: '模块', items: modulesZh },
          { text: '参考', items: reference },
        ],
        sidebar: sidebarZh,
        editLink: {
          pattern: 'https://github.com/godicom-dev/godicom-dev.github.io/edit/main/docs/:path',
          text: '在 GitHub 上编辑此页',
        },
        footer: {
          message: '基于 MIT 许可证发布。',
          copyright: 'godicom-dev',
        },
        outline: { level: [2, 3], label: '本页目录' },
        docFooter: { prev: '上一页', next: '下一页' },
        lastUpdated: { text: '最后更新于' },
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        sidebarMenuLabel: '目录',
        returnToTopLabel: '回到顶部',
        langMenuLabel: '切换语言',
        notFound: {
          title: '页面不存在',
          quote: '这个地址下没有内容。',
          linkLabel: '回到首页',
          linkText: '回到首页',
        },
      },
    },
  },

  themeConfig: {
    search: {
      provider: 'local',
      options: {
        locales: {
          zh: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
              modal: {
                displayDetails: '显示详情',
                resetButtonTitle: '清除查询条件',
                backButtonTitle: '返回',
                noResultsText: '没有找到结果',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '回车',
                  navigateText: '切换',
                  navigateUpKeyAriaLabel: '上箭头',
                  navigateDownKeyAriaLabel: '下箭头',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'esc',
                },
              },
            },
          },
        },
      },
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/godicom-dev' }],

    outline: { level: [2, 3] },
  },
})
