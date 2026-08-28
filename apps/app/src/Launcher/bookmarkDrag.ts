type SortablePosition = {
  initialIndex: number;
  index: number;
};

/**
 * dnd-kit 会把排序后的最终位置保存在 source.index 上。结束瞬间即使没有
 * drop target，这个位置仍然有效，不能因为 target 为空而丢弃浏览器同步。
 */
export function getBookmarkReorderDestination(
  source: SortablePosition,
  parentId: string,
): { parentId: string; index: number } | null {
  if (source.index === source.initialIndex) return null;
  return { parentId, index: source.index };
}
