import projectConfig from "../../../../project.config.json";

const PRODUCT_NAME = projectConfig.product.name;

export type Locale = "en" | "zh";

export const translations = {
  en: {
    lang: "en",
    title: `${PRODUCT_NAME} — Start with clarity`,
    description: `${PRODUCT_NAME} is an open-source browser extension that provides web search and bookmark shortcuts on the new-tab page.`,
    shareImageAlt: `${PRODUCT_NAME} browser new-tab page`,
    homeLabel: `${PRODUCT_NAME} home`,
    navLabel: "Main navigation",
    nav: {
      features: "Features",
      demo: "Live Demo",
      openSource: "Open Source",
      download: "Get the extension",
      privacy: "Privacy",
    },
    hero: {
      badge: "FREE · AD-FREE · OPEN SOURCE",
      line1: "Open a new tab,",
      line2: "Start with clarity.",
      description: `${PRODUCT_NAME} uses your browser bookmarks as site shortcuts. Browse folders, search the web and your bookmarks, and organize them from the new-tab page.`,
      try: "Try it out",
      browserCta: {
        chrome: "Add to Chrome",
        edge: "Get from Edge Add-ons",
        choose: "Choose your browser",
        pending: "No installation link is available for this browser yet.",
      },
      benefits: ["Web search", "Bookmark folders", "Drag and drop"],
    },
    demo: {
      label: "DEMO",
      iframeTitle: `Interactive ${PRODUCT_NAME} demo`,
      tabTitle: "New Tab",
    },
    features: {
      label: "SITE SHORTCUTS",
      title1: "Open your",
      title2: "saved sites.",
      description: `${PRODUCT_NAME} displays site shortcuts from your browser bookmarks. Open folders, add or edit bookmarks, and drag items to reorder them.`,
      link: "Get the extension",
      search: {
        label: "SEARCH",
        title: "Search the web and your bookmarks.",
        description:
          "Type in the search box to search the web or find a matching bookmark. You can switch search engines for a single search and see suggestions as you type.",
        points: [
          "Search the web and your bookmarks together",
          "Switch search engines for a single search",
          "See suggestions as you type",
        ],
        imageAlt: "Search suggestions for the web and browser bookmarks",
        preview: {
          query: "b",
          engineHost: "bing.com",
          searchAction: "Search with Bing",
          groupLabel: "Bookmarks",
          bookmarks: [
            { name: "Bookmarks", host: "bookmarks.local", tone: "orange" },
            { name: "Blog", host: "blog.local", tone: "teal" },
            { name: "Behance", host: "behance.net", tone: "purple" },
          ],
        },
      },
      items: [
        [
          "Site shortcuts",
          "Use your browser bookmarks as shortcuts on the new-tab page.",
        ],
        [
          "Bookmark folders",
          "Browse folders and move or reorder items with drag and drop.",
        ],
        [
          "Web and bookmark search",
          "Search the web and your bookmarks from the same search box.",
        ],
      ],
    },
    source: {
      label: "OPEN SOURCE",
      title1: "Fully open source,",
      title2: "free to modify.",
      description: `${PRODUCT_NAME} is completely free and open source. You can review the code, suggest changes, and modify it to suit your needs.`,
      link: "View source code",
    },
    download: {
      label: "GET THE EXTENSION",
      title1: "Start your next new tab",
      title2: `with ${PRODUCT_NAME}.`,
      description: "Choose your browser and install the extension.",
      storeLabel: "Available for",
    },
    footerTagline: "An open-source extension for your new tab.",
    footerNote: "Open-source project.",
  },
  zh: {
    lang: "zh-CN",
    title: `${PRODUCT_NAME} — 简单又顺手的新标签页`,
    description: `${PRODUCT_NAME} 是一个开源浏览器扩展，在新标签页中提供网页搜索和来自浏览器书签的网站快捷入口。`,
    shareImageAlt: `${PRODUCT_NAME} 浏览器新标签页`,
    homeLabel: `${PRODUCT_NAME} 主页`,
    navLabel: "主导航",
    nav: {
      features: "特色",
      demo: "在线体验",
      openSource: "开源",
      download: "获取扩展",
      privacy: "隐私政策",
    },
    hero: {
      badge: "免费 · 无广告 · 开源",
      line1: "打开新标签，",
      line2: "简单又顺手。",
      description: `${PRODUCT_NAME} 使用现有的浏览器书签作为网站快捷入口。你可以在新标签页中浏览文件夹、搜索网页和书签，并整理书签内容。`,
      try: "先体验一下",
      browserCta: {
        chrome: "添加到 Chrome",
        edge: "添加到 Edge",
        choose: "选择你的浏览器",
        pending: "该浏览器暂未提供安装链接。",
      },
      benefits: ["网页搜索", "书签文件夹", "拖拽整理"],
    },
    demo: {
      label: "功能演示",
      iframeTitle: `${PRODUCT_NAME} 可交互产品演示`,
      tabTitle: "新标签页",
    },
    features: {
      label: "网站快捷入口",
      title1: "打开你的",
      title2: "常用网站。",
      description: `${PRODUCT_NAME} 显示来自浏览器书签的网站快捷入口。你可以打开文件夹、新增或编辑书签，也可以拖拽调整顺序。`,
      link: "获取扩展",
      search: {
        label: "搜索",
        title: "搜索网页和浏览器书签。",
        description:
          "在搜索框中输入内容，可以搜索网页或查找匹配的书签。你可以为当前搜索切换搜索引擎，并在输入时看到搜索建议。",
        points: [
          "同时搜索网页和浏览器书签",
          "为当前搜索切换搜索引擎",
          "输入内容时显示搜索建议",
        ],
        imageAlt: "网页和浏览器书签的搜索建议",
        preview: {
          query: "b",
          engineHost: "bing.com",
          searchAction: "使用 Bing 搜索",
          groupLabel: "浏览器书签",
          bookmarks: [
            { name: "书签", host: "bookmarks.local", tone: "orange" },
            { name: "博客", host: "blog.local", tone: "teal" },
            { name: "Behance", host: "behance.net", tone: "purple" },
          ],
        },
      },
      items: [
        ["网站快捷入口", "使用浏览器书签作为新标签页中的网站快捷入口。"],
        ["书签文件夹", "浏览文件夹，并通过拖拽移动或调整项目顺序。"],
        ["网页与书签搜索", "在同一个搜索框中搜索网页和浏览器书签。"],
      ],
    },
    source: {
      label: "开放源代码",
      title1: "完全开源，",
      title2: "可以自由修改。",
      description: `${PRODUCT_NAME} 完全免费并开放源代码。你可以查看代码、提出建议，也可以按自己的需要修改。`,
      link: "查看项目源码",
    },
    download: {
      label: "获取扩展",
      title1: "从下一次打开新标签页",
      title2: `开始使用 ${PRODUCT_NAME}。`,
      description: "选择你的浏览器并安装扩展。",
      storeLabel: "适用于",
    },
    footerTagline: "一个开源的浏览器新标签页扩展。",
    footerNote: "开源项目。",
  },
} as const;
