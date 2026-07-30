import i18n from "../../i18n";
import type { BrowserBookmarkNode } from "../bookmarkTree";
import {
  defaultBookmarks,
  type DefaultBookmarkNode,
  type DefaultBookmarkTitleKey,
} from "./data";
import { en } from "./en";
import { zhCN } from "./zh-CN";

const namespace = "webDefaultBookmarks";

const titleKeysByNodeId = new Map<string, DefaultBookmarkTitleKey>([
  ["web-root-bar", "bookmarksBar"],
  ["web-root-other", "otherBookmarks"],
  ["web-root-mobile", "mobileBookmarks"],
  ...defaultBookmarks.flatMap((root) => collectFolderTitleKeys(root.children)),
] as [string, DefaultBookmarkTitleKey][]);

i18n.addResourceBundle("en", namespace, en);
i18n.addResourceBundle("zh-CN", namespace, zhCN);

function collectFolderTitleKeys(
  nodes: DefaultBookmarkNode[],
): [string, DefaultBookmarkTitleKey][] {
  return nodes.flatMap((node) =>
    node.type === "folder"
      ? [[node.id, node.titleKey], ...collectFolderTitleKeys(node.children)]
      : [],
  );
}

function createNodes(
  nodes: DefaultBookmarkNode[],
  parentId: string,
): BrowserBookmarkNode[] {
  const t = i18n.getFixedT(null, namespace);

  return nodes.map((node, index) =>
    node.type === "item"
      ? {
          ...node,
          parentId,
          index,
        }
      : {
          type: "folder",
          id: node.id,
          title: t(node.titleKey),
          parentId,
          index,
          children: createNodes(node.children, node.id),
        },
  );
}

/**
 * 已写入 sessionStorage 的默认节点仍保留上次生成的标题。语言切换时只更新
 * 仍使用内置标题的节点；用户手动重命名后的标题保持不变。
 */
export function localizeWebDefaultBookmarkTree(
  nodes: BrowserBookmarkNode[],
): BrowserBookmarkNode[] {
  const t = i18n.getFixedT(null, namespace);

  return nodes.map((node) => {
    const titleKey = titleKeysByNodeId.get(node.id);
    const usesDefaultTitle =
      titleKey !== undefined &&
      (node.title === en[titleKey] || node.title === zhCN[titleKey]);
    const localizedNode = usesDefaultTitle
      ? { ...node, title: t(titleKey) }
      : node;

    return localizedNode.type === "folder"
      ? {
          ...localizedNode,
          children: localizeWebDefaultBookmarkTree(localizedNode.children),
        }
      : localizedNode;
  });
}

/** Web 端用一棵真实的递归树演示浏览器书签结构。 */
export function createWebDefaultBookmarkTree(): BrowserBookmarkNode[] {
  const t = i18n.getFixedT(null, namespace);
  const rootId = "web-root";
  const roots = [
    {
      id: "web-root-bar",
      titleKey: "bookmarksBar",
      folderType: "bookmarks-bar",
      source: defaultBookmarks[0],
    },
    {
      id: "web-root-other",
      titleKey: "otherBookmarks",
      folderType: "other",
      source: defaultBookmarks[1],
    },
    {
      id: "web-root-mobile",
      titleKey: "mobileBookmarks",
      folderType: "mobile",
      source: defaultBookmarks[2],
    },
  ] as const;

  return [
    {
      type: "folder",
      id: rootId,
      title: "",
      parentId: "",
      index: 0,
      children: roots.map((root, index) => ({
        type: "folder",
        id: root.id,
        title: t(root.titleKey),
        parentId: rootId,
        index,
        folderType: root.folderType,
        children: createNodes(root.source.children, root.id),
      })),
    },
  ];
}
