import { BookmarkLink } from "./BookmarkLink";

// UI fixture only: replace with ranked bookmarks when click tracking is added.
const demoBookmarks = [
  { id: "dock-demo-github", title: "GitHub", url: "https://github.com/" },
  { id: "dock-demo-chatgpt", title: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "dock-demo-figma", title: "Figma", url: "https://www.figma.com/" },
  { id: "dock-demo-notion", title: "Notion", url: "https://www.notion.so/" },
  { id: "dock-demo-linear", title: "Linear", url: "https://linear.app/" },
  {
    id: "dock-demo-youtube",
    title: "YouTube",
    url: "https://www.youtube.com/",
  },
];

export function BookmarkDock() {
  return (
    <nav className="shrink-0 px-3 pb-6 pt-3 sm:px-6 sm:pb-8">
      <ul className="mx-auto grid w-fit max-w-6xl grid-cols-3 justify-center gap-x-3 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-5">
        {demoBookmarks.map((bookmark) => (
          <li key={bookmark.id} className="shrink-0">
            <BookmarkLink bookmark={bookmark} compact />
          </li>
        ))}
      </ul>
    </nav>
  );
}
