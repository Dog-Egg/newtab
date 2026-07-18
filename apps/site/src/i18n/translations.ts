import projectConfig from "../../../../project.config.json";

const PRODUCT_NAME = projectConfig.product.name;

export type Locale = "en" | "zh";

export const translations = {
  en: {
    lang: "en",
    title: `${PRODUCT_NAME} — A better start for every new tab`,
    description: `${PRODUCT_NAME} is a free and open-source new tab extension that keeps search, favorite sites, and your digital routine within reach.`,
    homeLabel: `${PRODUCT_NAME} home`,
    navLabel: "Main navigation",
    nav: {
      features: "Features",
      demo: "Live Demo",
      openSource: "Open Source",
      download: "Download",
    },
    hero: {
      badge: "OPEN SOURCE · FREE · BUILT FOR EVERY OPEN",
      line1: "Open a new tab.",
      line2: "Start with clarity.",
      description: `${PRODUCT_NAME} is a lightweight, flexible new tab extension. Keep search, favorite sites, and your digital routine in one place that feels truly yours.`,
      try: "Try the live demo",
      chrome: "Add to Chrome",
      benefits: ["Free forever", "No sign-in", "Open source"],
    },
    demo: {
      iframeTitle: `Interactive ${PRODUCT_NAME} product demo`,
      tabTitle: "New Tab",
    },
    features: {
      title1: "Less distraction.",
      title2: "More direction.",
      description: `Every new tab is a small chance to begin again. ${PRODUCT_NAME} stays out of the way and keeps what matters exactly where you need it.`,
      link: "Find your version",
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
          "No account wall and no feature bloat. Open your browser and it is quietly ready.",
        ],
      ],
    },
    source: {
      title1: "Open code.",
      title2: "Your choices stay open too.",
      description: `${PRODUCT_NAME} is free and open source. Inspect every line, suggest improvements, or shape it into the new tab page you want.`,
      link: "View source code",
    },
    download: {
      title1: "Make your next new tab",
      title2: `a ${PRODUCT_NAME}.`,
      description: "Choose your browser and install in seconds.",
      storeLabel: "Available for",
    },
    footerTagline: "Turn every new tab into a better beginning.",
  },
  zh: {
    lang: "zh-CN",
    title: `${PRODUCT_NAME} — 打开新标签，也打开好状态`,
    description: `${PRODUCT_NAME} 是一款开源、免费的浏览器新标签页扩展，让常用网站、搜索与日常灵感回到触手可及的位置。`,
    homeLabel: `${PRODUCT_NAME} 主页`,
    navLabel: "主导航",
    nav: {
      features: "特色",
      demo: "在线体验",
      openSource: "开源",
      download: "立即下载",
    },
    hero: {
      badge: "开源 · 免费 · 为每一次打开",
      line1: "打开新标签，",
      line2: "也打开好状态。",
      description: `${PRODUCT_NAME} 是一个轻巧、自由的新标签页扩展。把搜索、常用网站和你的数字日常，收进一个真正属于你的起点。`,
      try: "先体验一下",
      chrome: "添加到 Chrome",
      benefits: ["永久免费", "无需登录", "开源透明"],
    },
    demo: {
      iframeTitle: `${PRODUCT_NAME} 可交互产品演示`,
      tabTitle: "新标签页",
    },
    features: {
      title1: "少一点打扰，",
      title2: "多一点抵达。",
      description: `每次新建标签，都是一次微小的重新开始。${PRODUCT_NAME} 不争夺注意力，只把真正有用的东西放在恰好的位置。`,
      link: "找到你的版本",
      items: [
        [
          "一眼就懂",
          "清晰的搜索与快捷入口，让每一次跳转都更快，不需要额外学习。",
        ],
        [
          "由你定义",
          "常用网站、搜索引擎与布局偏好，按你的习惯组织，而不是反过来。",
        ],
        [
          "轻得自然",
          "没有账户门槛，没有冗余功能。打开浏览器，它就安静地在那里。",
        ],
      ],
    },
    source: {
      title1: "代码公开，",
      title2: "选择权也属于你。",
      description: `${PRODUCT_NAME} 免费且开源。你可以查看每一行代码、提出建议，或者把它改造成自己喜欢的样子。`,
      link: "查看项目源码",
    },
    download: {
      title1: "下一次新建标签，",
      title2: `从 ${PRODUCT_NAME} 开始。`,
      description: "选择你的浏览器，几秒钟完成安装。",
      storeLabel: "下载适用于",
    },
    footerTagline: "把每一个新标签，变成更好的开始。",
  },
} as const;
