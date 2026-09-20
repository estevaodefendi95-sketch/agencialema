import { useEffect, useRef, useState } from "react";

/**
 * Rastreia qual filho de um contêiner com scroll horizontal (scroll-snap)
 * está atualmente centralizado na tela — usado pro indicador de coluna
 * atual (chips/pontos) nas visões Cards/Kanban no mobile.
 */
export function useScrollSnapIndex<T extends HTMLElement>(itemCount: number) {
  const containerRef = useRef<T | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || itemCount === 0) return;

    const onScroll = () => {
      const children = Array.from(el.children) as HTMLElement[];
      if (children.length === 0) return;
      const center = el.scrollLeft + el.clientWidth / 2;
      let closest = 0;
      let closestDist = Infinity;
      children.forEach((child, i) => {
        const dist = Math.abs(child.offsetLeft + child.offsetWidth / 2 - center);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      setActiveIndex(closest);
    };

    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [itemCount]);

  const scrollToIndex = (i: number) => {
    const el = containerRef.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2, behavior: "smooth" });
  };

  return { containerRef, activeIndex, scrollToIndex };
}
