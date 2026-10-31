/**
 * Launcher 直接使用浏览器书签树。这里的 type 只用于应用内判别；
 * Chrome 仍然以是否存在 url 来区分书签和文件夹。
 */
export type BrowserBookmarkItem = {
  type: "item";
  id: string;
  title: string;
  url: string;
  parentId?: string;
  index?: number;
  unmodifiable?: "managed";
};

export type BrowserBookmarkFolder = {
  type: "folder";
  id: string;
  title: string;
  parentId?: string;
  index?: number;
  folderType?: "bookmarks-bar" | "other" | "mobile" | "managed";
  unmodifiable?: "managed";
  children: BrowserBookmarkNode[];
};

export type BrowserBookmarkNode = BrowserBookmarkItem | BrowserBookmarkFolder;

/** Chrome 的 getTree 通常返回一个无标题的虚拟根节点，UI 不需要展示它。 */
export function getBookmarkRoots(
  tree: BrowserBookmarkNode[],
): BrowserBookmarkFolder[] {
  const onlyNode = tree.length === 1 ? tree[0] : null;
  const roots =
    onlyNode?.type === "folder" && !onlyNode.title ? onlyNode.children : tree;
  return roots.filter(
    (node): node is BrowserBookmarkFolder => node.type === "folder",
  );
}

/** 按浏览器书签树的先序顺序收集全部可打开的书签。 */
export function flattenBookmarkItems(
  nodes: BrowserBookmarkNode[],
): BrowserBookmarkItem[] {
  const items: BrowserBookmarkItem[] = [];
  const pending = [...nodes].reverse();

  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;
    if (node.type === "item") {
      items.push(node);
      continue;
    }
    for (let index = node.children.length - 1; index >= 0; index--) {
      pending.push(node.children[index]);
    }
  }

  return items;
}

/** 返回从根目录到目标节点的完整路径，供面包屑和失效目录回退使用。 */
export function findBookmarkPath(
  nodes: BrowserBookmarkNode[],
  targetId: string,
): BrowserBookmarkNode[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [node];
    if (node.type === "item") continue;
    const childPath = findBookmarkPath(node.children, targetId);
    if (childPath) return [node, ...childPath];
  }
  return null;
}

export function findBookmarkFolder(
  nodes: BrowserBookmarkNode[],
  targetId: string,
): BrowserBookmarkFolder | null {
  const path = findBookmarkPath(nodes, targetId);
  const node = path?.[path.length - 1];
  return node?.type === "folder" ? node : null;
}
