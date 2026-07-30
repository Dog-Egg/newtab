import projectConfig from "../../../../project.config.json";

const PRODUCT_NAME = projectConfig.product.name;

export type Locale = "en" | "zh";

export const translations = {
  en: {
    lang: "en",
    title: `${PRODUCT_NAME} — An Open-Source New Tab for Browser Bookmarks`,
    description: `${PRODUCT_NAME} is an open-source browser extension for viewing, searching, and organizing browser bookmarks from the new-tab page.`,
    shareImageAlt: `${PRODUCT_NAME}, a visual new tab for your browser bookmarks`,
    homeLabel: `${PRODUCT_NAME} home`,
    navLabel: "Main navigation",
    nav: {
      features: "Features",
      demo: "Live Demo",
      openSource: "Open Source",
      download: "Get Extension",
      privacy: "Privacy",
    },
    hero: {
      badge: "FREE · AD-FREE · OPEN SOURCE",
      line1: "Manage browser bookmarks",
      line2: "from the new-tab page.",
      description: `${PRODUCT_NAME} reads the browser’s bookmark tree. You can browse folders, search bookmarks, and organize them directly from the new-tab page.`,
      try: "Open demo",
      browserCta: {
        chrome: "Add to Chrome",
        edge: "Get from Edge Add-ons",
        choose: "Choose your browser",
        pending: "The extension is coming soon. Stay tuned!",
      },
      benefits: ["Browser bookmarks", "Nested folders", "Drag and drop"],
    },
    demo: {
      label: "DEMO",
      iframeTitle: `Interactive ${PRODUCT_NAME} product demo`,
      tabTitle: "New Tab",
    },
    features: {
      label: "BOOKMARK MANAGEMENT",
      title1: "View and edit",
      title2: "browser bookmarks.",
      description: `${PRODUCT_NAME} displays the browser bookmark tree as folders and cards. Changes are written directly to the browser’s bookmark store.`,
      link: "Get the extension",
      search: {
        label: "SMART SEARCH",
        title: "One box. More ways to get there.",
        description:
          "Start typing to search the web, open a matching bookmark, or switch engines for just this search. Suggestions appear from the first character and stay within keyboard reach.",
        points: [
          "Bookmarks and search engines together",
          "Temporary search-engine switching",
          "Tab and arrow-key navigation",
        ],
        imageAlt:
          "Search suggestions showing a temporary search engine and matching bookmarks in one list",
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
          "Browser bookmarks",
          "NewTab reads and edits the bookmark tree provided by the browser.",
        ],
        [
          "Folder organization",
          "Reorder bookmarks, create nested folders, and move items across roots with drag and drop.",
        ],
        [
          "Bookmark and web search",
          "Search bookmarks alongside the web, switch search engines, and use keyboard navigation.",
        ],
      ],
    },
    source: {
      label: "OPEN SOURCE",
      title1: "Source code",
      title2: "is available on GitHub.",
      description: `${PRODUCT_NAME} is an open-source project. You can review the code, report issues, suggest changes, or modify it for your own use.`,
      link: "View source code",
    },
    download: {
      label: "INSTALL",
      title1: `Install ${PRODUCT_NAME}`,
      title2: "for your browser.",
      description: "Choose your browser and install the extension.",
      storeLabel: "Available for",
    },
    footerTagline: "An open-source new tab for browser bookmarks.",
    footerNote: "Open-source project.",
  },
  zh: {
    lang: "zh-CN",
    title: `${PRODUCT_NAME} — 在新标签页管理浏览器书签`,
    description: `${PRODUCT_NAME} 是一个开源浏览器扩展，用于在新标签页中浏览、搜索和整理浏览器书签。`,
    shareImageAlt: `${PRODUCT_NAME}，为浏览器书签设计的可视化新标签页`,
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
      line1: "在新标签页中",
      line2: "管理浏览器书签。",
      description: `${PRODUCT_NAME} 直接读取浏览器书签树。你可以在新标签页中浏览文件夹、搜索书签并完成整理。`,
      try: "打开演示",
      browserCta: {
        chrome: "添加到 Chrome",
        edge: "添加到 Edge",
        choose: "选择你的浏览器",
        pending: "插件正在上架中，敬请期待。",
      },
      benefits: ["浏览器书签", "多层文件夹", "拖拽整理"],
    },
    demo: {
      label: "功能演示",
      iframeTitle: `${PRODUCT_NAME} 可交互产品演示`,
      tabTitle: "新标签页",
    },
    features: {
      label: "书签管理",
      title1: "浏览并编辑",
      title2: "浏览器书签。",
      description: `${PRODUCT_NAME} 以文件夹和卡片的形式展示浏览器书签树，修改会直接写入浏览器书签。`,
      link: "获取扩展",
      search: {
        label: "增强搜索",
        title: "一个搜索框，多种到达方式。",
        description:
          "从第一个字符开始，搜索框会同时匹配浏览器书签和搜索引擎。你可以只为当前搜索临时切换引擎，并用键盘完成选择。",
        points: [
          "浏览器书签与搜索引擎同时匹配",
          "仅为当前搜索临时切换引擎",
          "支持 Tab 与上下键导航",
        ],
        imageAlt: "同一列表中展示临时搜索引擎与浏览器书签的搜索建议",
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
        ["浏览器书签", "读取并编辑浏览器提供的书签树。"],
        ["文件夹整理", "拖拽调整顺序、创建多层文件夹，并跨根目录移动书签。"],
        [
          "书签与网页搜索",
          "搜索网页时匹配全部书签，也可以切换搜索引擎并使用键盘操作。",
        ],
      ],
    },
    source: {
      label: "开放源代码",
      title1: "项目源代码",
      title2: "发布在 GitHub。",
      description: `${PRODUCT_NAME} 是一个开源项目。你可以查看代码、提交问题、提出修改建议，或按自己的需要进行修改。`,
      link: "查看项目源码",
    },
    download: {
      label: "安装",
      title1: `为浏览器安装`,
      title2: `${PRODUCT_NAME}。`,
      description: "选择你的浏览器并安装扩展。",
      storeLabel: "适用于",
    },
    footerTagline: "一个用于管理浏览器书签的开源新标签页扩展。",
    footerNote: "开源项目。",
  },
} as const;
