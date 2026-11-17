import { useLayoutEffect, useRef } from "react";
import { BOOKMARK_NODE_SCALE_VARIABLE } from "../components/BookmarkLink";
import { useSettingsStore } from "../store/settings";

export function useBookmarkNodeScale(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!enabled) return;

    const applyScale = (nodeScale: number) => {
      ref.current?.style.setProperty(
        BOOKMARK_NODE_SCALE_VARIABLE,
        String(nodeScale),
      );
    };

    applyScale(useSettingsStore.getState().nodeScale);
    return useSettingsStore.subscribe((state, previousState) => {
      if (state.nodeScale !== previousState.nodeScale) {
        applyScale(state.nodeScale);
      }
    });
  }, [enabled]);

  return ref;
}
