import type {
  BrowserBookmarkFolder,
  BrowserBookmarkItem,
  BrowserBookmarkNode,
} from "./bookmarkTree";
import type { AppLocale } from "../i18n";

function createWebBookmarkFactory(locale: AppLocale) {
  const localize = (original: string, zh?: string) =>
    locale === "zh-CN" && zh ? zh : original;

  const item = (
    id: string,
    title: string,
    url: string,
    parentId: string,
    index: number,
    zh?: string,
  ): BrowserBookmarkItem => ({
    type: "item",
    id,
    title: localize(title, zh),
    url,
    parentId,
    index,
  });

  const folder = (
    id: string,
    title: string,
    parentId: string,
    index: number,
    children: BrowserBookmarkNode[],
    zh?: string,
    folderType?: BrowserBookmarkFolder["folderType"],
  ): BrowserBookmarkFolder => ({
    type: "folder",
    id,
    title: localize(title, zh),
    parentId,
    index,
    folderType,
    children,
  });

  return { item, folder };
}

/** Web 端用一棵真实的递归树演示浏览器书签结构。 */
export function createWebDefaultBookmarkTree(
  locale: AppLocale,
): BrowserBookmarkNode[] {
  const { item, folder } = createWebBookmarkFactory(locale);
  const barId = "web-root-bar";
  const otherId = "web-root-other";
  const mobileId = "web-root-mobile";
  const workId = "web-folder-work";
  const frontendId = "web-folder-frontend";
  const reactId = "web-folder-react";

  return [
    folder("web-root", "", "", 0, [
      folder(
        barId,
        "Bookmarks bar",
        "web-root",
        0,
        [
          folder(
            workId,
            "Work",
            barId,
            0,
            [
              folder(
                frontendId,
                "Frontend",
                workId,
                0,
                [
                  folder(
                    reactId,
                    "React ecosystem",
                    frontendId,
                    0,
                    [
                      item(
                        "web-react",
                        "React",
                        "https://react.dev",
                        reactId,
                        0,
                      ),
                      item(
                        "web-next",
                        "Next.js",
                        "https://nextjs.org",
                        reactId,
                        1,
                      ),
                      item("web-vite", "Vite", "https://vite.dev", reactId, 2),
                    ],
                    "React 生态",
                  ),
                  folder(
                    "web-folder-design",
                    "CSS & design",
                    frontendId,
                    1,
                    [
                      item(
                        "web-tailwind",
                        "Tailwind CSS",
                        "https://tailwindcss.com",
                        "web-folder-design",
                        0,
                      ),
                      item(
                        "web-figma",
                        "Figma",
                        "https://figma.com",
                        "web-folder-design",
                        1,
                      ),
                    ],
                    "CSS 与设计",
                  ),
                  item(
                    "web-github",
                    "GitHub",
                    "https://github.com",
                    frontendId,
                    2,
                  ),
                  item(
                    "web-mdn",
                    "MDN Web Docs",
                    "https://developer.mozilla.org",
                    frontendId,
                    3,
                  ),
                  item(
                    "web-typescript",
                    "TypeScript",
                    "https://www.typescriptlang.org",
                    frontendId,
                    4,
                  ),
                  folder(
                    "web-folder-reading",
                    "Read later",
                    frontendId,
                    5,
                    [],
                    "待读",
                  ),
                ],
                "前端资料",
              ),
            ],
            "工作",
          ),
          item("web-youtube", "YouTube", "https://youtube.com", barId, 1),
          item("web-gmail", "Gmail", "https://mail.google.com", barId, 2),
        ],
        "书签栏",
        "bookmarks-bar",
      ),
      folder(
        otherId,
        "Other bookmarks",
        "web-root",
        1,
        [
          item(
            "web-wikipedia",
            "Wikipedia",
            "https://wikipedia.org",
            otherId,
            0,
            "维基百科",
          ),
        ],
        "其他书签",
        "other",
      ),
      folder(
        mobileId,
        "Mobile bookmarks",
        "web-root",
        2,
        [],
        "移动设备书签",
        "mobile",
      ),
    ]),
  ];
}
