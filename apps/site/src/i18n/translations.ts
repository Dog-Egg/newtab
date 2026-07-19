import projectConfig from "../../../../project.config.json";

const PRODUCT_NAME = projectConfig.product.name;

export type Locale = "en" | "zh";

export const translations = {
  en: {
    lang: "en",
    title: `${PRODUCT_NAME} — A better start for every new tab`,
    description: `${PRODUCT_NAME} is a free, ad-free, and open-source new tab extension with customizable shortcuts and smarter search. No sign-in is required, and your preferences stay in your browser.`,
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
      line1: "Open a new tab.",
      line2: "Start with clarity.",
      description: `${PRODUCT_NAME} is a simple, customizable new tab extension. Keep favorite sites close, search without detours, and shape the page around the way you work.`,
      try: "Try the live demo",
      browserCta: {
        chrome: "Add to Chrome",
        edge: "Get from Edge Add-ons",
        choose: "Choose your browser",
        pending: "The extension is coming soon. Stay tuned!",
      },
      benefits: ["No sign-in", "Local-first", "Open source"],
    },
    demo: {
      label: "LIVE DEMO",
      iframeTitle: `Interactive ${PRODUCT_NAME} product demo`,
      tabTitle: "New Tab",
    },
    features: {
      label: `WHY ${PRODUCT_NAME.toUpperCase()}`,
      title1: "Less distraction.",
      title2: "More direction.",
      description: `Every new tab is a small chance to begin again. ${PRODUCT_NAME} keeps search, shortcuts, and personal preferences clear and close at hand without getting in your way.`,
      link: "Get the extension",
      spotlight: {
        label: "SMART SEARCH",
        title: "One box. More ways to get there.",
        description:
          "Start typing to search the web, open a saved shortcut, or switch engines for just this search. Suggestions appear from the first character and stay within keyboard reach.",
        points: [
          "Shortcuts and search engines together",
          "Temporary search-engine switching",
          "Tab and arrow-key navigation",
        ],
        imageAlt:
          "Search suggestions showing a temporary search engine and saved shortcuts in one list",
        preview: {
          query: "b",
          engineHost: "bing.com",
          searchAction: "Search with Bing",
          groupLabel: "Shortcuts",
          shortcuts: [
            { name: "Bookmarks", host: "bookmarks.local", tone: "orange" },
            { name: "Blog", host: "blog.local", tone: "teal" },
            { name: "Behance", host: "behance.net", tone: "purple" },
          ],
        },
      },
      items: [
        [
          "Clear at a glance",
          "Search and shortcuts that feel instantly familiar, with nothing extra to learn.",
        ],
        [
          "Made for you",
          "Arrange favorite sites, search engines, and layout preferences around the way you work.",
        ],
        [
          "Naturally lightweight",
          "No sign-in and no ads. Your shortcuts and preferences stay in your browser.",
        ],
      ],
    },
    source: {
      label: "OPEN SOURCE",
      title1: "Open source.",
      title2: "Free to adapt.",
      description: `${PRODUCT_NAME} is completely free and open source. You can inspect the code, suggest improvements, or adapt it to your needs.`,
      link: "View source code",
    },
    download: {
      label: "GET THE EXTENSION",
      title1: "Start your next new tab",
      title2: `with ${PRODUCT_NAME}.`,
      description: "Choose your browser and install the extension.",
      storeLabel: "Available for",
    },
    footerTagline: "Turn every new tab into a better beginning.",
    footerNote: "Open source with care.",
  },
  zh: {
    lang: "zh-CN",
    title: `${PRODUCT_NAME} — 打开新标签，简单又顺手`,
    description: `${PRODUCT_NAME} 是一款免费、无广告、开源的新标签页扩展，支持自定义快捷方式和更灵活的搜索。无需登录，偏好设置保存在浏览器本地。`,
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
      description: `${PRODUCT_NAME} 是一个简单、可自定义的新标签页扩展。常用网站触手可及，搜索一步到位，页面也可以按你的习惯安排。`,
      try: "先体验一下",
      browserCta: {
        chrome: "添加到 Chrome",
        edge: "添加到 Edge",
        choose: "选择你的浏览器",
        pending: "插件正在上架中，敬请期待。",
      },
      benefits: ["无需登录", "数据本地保存", "开放源代码"],
    },
    demo: {
      label: "在线体验",
      iframeTitle: `${PRODUCT_NAME} 可交互产品演示`,
      tabTitle: "新标签页",
    },
    features: {
      label: `为什么选择 ${PRODUCT_NAME}`,
      title1: "少一点打扰，",
      title2: "多一点专注。",
      description: `每次打开新标签页，都能快速找到需要的内容。${PRODUCT_NAME} 把搜索、快捷入口和个性化设置放在清晰、顺手的位置。`,
      link: "获取扩展",
      spotlight: {
        label: "增强搜索",
        title: "一个搜索框，多种到达方式。",
        description:
          "从第一个字符开始，搜索框会同时匹配快捷方式和搜索引擎。你可以只为当前搜索临时切换引擎，并用键盘完成选择。",
        points: [
          "快捷方式与搜索引擎同时匹配",
          "仅为当前搜索临时切换引擎",
          "支持 Tab 与上下键导航",
        ],
        imageAlt: "同一列表中展示临时搜索引擎与快捷方式的搜索建议",
        preview: {
          query: "b",
          engineHost: "bing.com",
          searchAction: "使用 Bing 搜索",
          groupLabel: "快捷方式",
          shortcuts: [
            { name: "书签", host: "bookmarks.local", tone: "orange" },
            { name: "博客", host: "blog.local", tone: "teal" },
            { name: "Behance", host: "behance.net", tone: "purple" },
          ],
        },
      },
      items: [
        ["一眼就懂", "搜索和快捷入口清晰直观，无需额外学习。"],
        ["由你定义", "可以按自己的习惯设置常用网站、搜索引擎和页面布局。"],
        [
          "简单直接",
          "无需登录，没有广告。快捷方式和偏好设置保存在浏览器本地。",
        ],
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
      title1: "下一次打开新标签页，",
      title2: `从 ${PRODUCT_NAME} 开始。`,
      description: "选择你的浏览器并安装扩展。",
      storeLabel: "适用于",
    },
    footerTagline: "把每一个新标签，变成更好的开始。",
    footerNote: "免费、无广告、开放源代码。",
  },
} as const;
