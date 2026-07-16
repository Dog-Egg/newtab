import { useCallback, useEffect, useState, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";

type EmblaApi = NonNullable<ReturnType<typeof useEmblaCarousel>[1]>;

export function Slider<T extends { id: string }>({
  items,
  activeId,
  onSelect,
  renderItem,
}: {
  items: T[];
  activeId: string;
  onSelect: (id: string) => void;
  renderItem: (item: T) => ReactNode;
}) {
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );
  const [initialIndex] = useState(activeIndex);
  const [viewportRef, emblaApi] = useEmblaCarousel(
    {
      align: "start",
      containScroll: false,
      loop: false,
      startIndex: initialIndex,
      watchDrag: (_api, event) => {
        const target = event.target;
        return !(
          target instanceof HTMLElement && target.closest("a, button, input")
        );
      },
    },
    [WheelGesturesPlugin({ forceWheelAxis: "x" })],
  );

  const syncSelectedSlide = useCallback(
    (api: EmblaApi) => {
      const selected = items[api.selectedScrollSnap()];
      if (selected && selected.id !== activeId) onSelect(selected.id);
    },
    [activeId, items, onSelect],
  );

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", syncSelectedSlide);
    return () => {
      emblaApi.off("select", syncSelectedSlide);
    };
  }, [emblaApi, syncSelectedSlide]);

  useEffect(() => {
    if (!emblaApi || emblaApi.selectedScrollSnap() === activeIndex) return;
    emblaApi.scrollTo(activeIndex);
  }, [activeIndex, emblaApi]);

  return (
    <div ref={viewportRef} className="h-full overflow-hidden">
      <div className="flex h-full touch-pan-y">
        {items.map((item) => (
          // 每个 Category 必须拥有独立的垂直滚动容器。若由 Slider 外层统一滚动，
          // 从较高页面切到较矮页面时会沿用同一个 scrollTop，导致内容从顶部溢出。
          // 同时将轨道和 slide 固定为视口高度，避免轨道被最高的页面撑开。
          <div
            key={item.id}
            className="h-full min-w-0 flex-[0_0_100%] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
