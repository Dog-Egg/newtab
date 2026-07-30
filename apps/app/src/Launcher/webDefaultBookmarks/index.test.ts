import { afterEach, describe, expect, it } from "vitest";
import i18n from "../../i18n";
import type { BrowserBookmarkNode } from "../bookmarkTree";
import {
  createWebDefaultBookmarkTree,
  localizeWebDefaultBookmarkTree,
} from ".";

function findNode(
  nodes: BrowserBookmarkNode[],
  id: string,
): BrowserBookmarkNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.type === "folder") {
      const child = findNode(node.children, id);
      if (child) return child;
    }
  }
  return null;
}

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("web default bookmark localization", () => {
  it("relocalizes stored default titles when the language changes", async () => {
    await i18n.changeLanguage("en");
    const tree = createWebDefaultBookmarkTree();

    await i18n.changeLanguage("zh-CN");
    const localizedTree = localizeWebDefaultBookmarkTree(tree);

    expect(findNode(localizedTree, "web-root-other")?.title).toBe("其他书签");
    expect(findNode(localizedTree, "folder-daily")?.title).toBe("日常");
  });

  it("preserves a title renamed by the user", async () => {
    await i18n.changeLanguage("en");
    const tree = createWebDefaultBookmarkTree();
    const other = findNode(tree, "web-root-other");
    if (other) other.title = "Projects";

    await i18n.changeLanguage("zh-CN");
    const localizedTree = localizeWebDefaultBookmarkTree(tree);

    expect(findNode(localizedTree, "web-root-other")?.title).toBe("Projects");
  });

  it("contains the supplied default bookmark hierarchy", () => {
    const tree = createWebDefaultBookmarkTree();
    const bookmarksBar = findNode(tree, "web-root-bar");
    const otherBookmarks = findNode(tree, "web-root-other");
    const mobileBookmarks = findNode(tree, "web-root-mobile");

    expect(bookmarksBar?.title).toBe("Bookmarks bar");
    expect(findNode(tree, "folder-daily")?.parentId).toBe("web-root-bar");
    expect(findNode(tree, "https://www.notion.so")?.parentId).toBe(
      "web-root-other",
    );
    expect(findNode(tree, "https://www.pinterest.com")?.parentId).toBe(
      "web-root-mobile",
    );
    expect(otherBookmarks?.title).toBe("Other bookmarks");
    expect(mobileBookmarks?.title).toBe("Mobile bookmarks");
    expect(findNode(tree, "https://calendar.google.com")?.title).toBe(
      "Google Calendar",
    );
    expect(findNode(tree, "folder-development")?.type).toBe("folder");
    expect(findNode(tree, "https://coolors.co")?.title).toBe("Coolors");
  });
});
