/**
 * 旧 Launcher 的兼容边界。
 *
 * 当前页面只以浏览器书签为数据源；这里的导出仅供 Extension 执行一次性迁移，
 * 便于迁移下线时直接删除整个目录。
 */
export {
  BOOKMARK_TREE_MIGRATION_KEY,
  collectLegacyBookmarksToExport,
  LEGACY_LAUNCHER_MIGRATION_LOCK,
  migrateLegacyLauncherOnce,
  normalizeStoredExtensionLauncher,
} from "./migration";
export { LAUNCHER_STORAGE_KEY, type LegacyLauncherCategory } from "./schema";
