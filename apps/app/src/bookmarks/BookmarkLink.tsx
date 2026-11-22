import { useRef, type ComponentPropsWithRef, type ReactNode } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import clsx from "clsx";
import { SiteIcon } from "../components/SiteIcon";
import { useBookmarksStore } from "./store";

export const BOOKMARK_NODE_SCALE_VARIABLE = "--node-scale";

export function scaledPixels(pixels: number) {
  return `calc(${pixels}px * var(${BOOKMARK_NODE_SCALE_VARIABLE}, 1))`;
}

export const bookmarkNodeClassName = clsx(
  "flex flex-col items-center gap-2 rounded-2xl text-center",
);

export const interactiveBookmarkNodeClassName = clsx(
  bookmarkNodeClassName,
  "group/bookmark outline-none transition focus-visible:ring-4 focus-visible:ring-white/70",
);

type BookmarkLinkProps = Omit<
  ComponentPropsWithRef<"a">,
  "children" | "href"
> & {
  bookmark: { id: string; title: string; url: string };
  compact?: boolean;
  icon?: ReactNode;
  labelHidden?: boolean;
};

/** Shared link presentation; sorting, editing and drop targets stay in the grid. */
export function BookmarkLink({
  bookmark,
  compact = false,
  icon,
  labelHidden = false,
  className,
  style,
  onClick,
  onAuxClick,
  ...props
}: BookmarkLinkProps) {
  const recordBookmarkClick = useBookmarksStore(
    (state) => state.recordBookmarkClick,
  );
  return (
    <a
      target="_parent"
      rel="noreferrer"
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && event.button === 0)
          recordBookmarkClick(bookmark.id);
      }}
      onAuxClick={(event) => {
        onAuxClick?.(event);
        if (!event.defaultPrevented && event.button === 1)
          recordBookmarkClick(bookmark.id);
      }}
      href={bookmark.url}
      className={clsx(interactiveBookmarkNodeClassName, className)}
      style={{ width: scaledPixels(compact ? 60 : 80), ...style }}
    >
      {icon ?? (
        <span className="transform-gpu transition-transform duration-200 group-hover/bookmark:-translate-y-1 group-focus-visible/bookmark:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none">
          <SiteIcon
            title={bookmark.title}
            url={bookmark.url}
            seed={bookmark.id}
            className="font-bold shadow-[0_6px_16px_rgba(15,23,42,0.2)]"
            style={{
              width: scaledPixels(compact ? 44 : 64),
              height: scaledPixels(compact ? 44 : 64),
              borderRadius: scaledPixels(compact ? 14 : 18),
              fontSize: scaledPixels(compact ? 20 : 24),
            }}
          />
        </span>
      )}
      <BookmarkLabel node={bookmark} hidden={labelHidden} compact={compact} />
    </a>
  );
}

export function BookmarkLabel({
  node,
  hidden = false,
  compact = false,
}: {
  node: { title: string };
  hidden?: boolean;
  compact?: boolean;
}) {
  const labelRef = useRef<HTMLSpanElement>(null);

  return (
    <span
      className={clsx(
        "flex w-full flex-col items-center",
        hidden && "invisible",
      )}
    >
      <Tooltip.Root
        disabled={hidden}
        disableHoverablePopup
        onOpenChange={(open, details) => {
          const label = labelRef.current;
          if (
            open &&
            label &&
            label.scrollHeight <= label.clientHeight &&
            label.scrollWidth <= label.clientWidth
          ) {
            details.cancel();
          }
        }}
      >
        <Tooltip.Trigger
          delay={600}
          render={
            <span
              ref={labelRef}
              className={clsx(
                "w-full text-white drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)]",
                compact
                  ? "truncate font-medium"
                  : "line-clamp-2 text-balance font-semibold",
              )}
              style={{
                minHeight: scaledPixels(compact ? 20 : 40),
                fontSize: scaledPixels(compact ? 11 : 12),
                lineHeight: scaledPixels(20),
              }}
            >
              {node.title}
            </span>
          }
        />
        <Tooltip.Portal>
          <Tooltip.Positioner
            sideOffset={6}
            className="z-[70] data-[anchor-hidden]:invisible"
          >
            <Tooltip.Popup className="max-w-[min(24rem,var(--available-width))] rounded-lg bg-slate-900/95 px-3 py-1.5 text-center text-sm text-white shadow-lg [overflow-wrap:anywhere]">
              {node.title}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </span>
  );
}
