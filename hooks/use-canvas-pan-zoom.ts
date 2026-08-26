"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";

export const MIN_SCALE = 8;
export const MAX_SCALE = 80;
export const DEFAULT_SCALE = 20;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

export function centeredOffset(
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number,
) {
  return {
    x: (viewportWidth - contentWidth) / 2,
    y: (viewportHeight - contentHeight) / 2,
  };
}

export function useCanvasPanZoom(
  viewportRef: RefObject<HTMLElement | null>,
  initialScale = DEFAULT_SCALE,
) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(initialScale);
  const scaleRef = useRef(initialScale);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const centerView = useCallback(
    (
      viewportWidth: number,
      viewportHeight: number,
      contentWidth: number,
      contentHeight: number,
    ) => {
      const current = scaleRef.current;
      setOffset(
        centeredOffset(
          viewportWidth,
          viewportHeight,
          contentWidth * current,
          contentHeight * current,
        ),
      );
    },
    [],
  );

  const zoomTo = useCallback((next: number, originX: number, originY: number) => {
    const clamped = clampScale(next);
    setScale((current) => {
      if (clamped === current) return current;
      setOffset((origin) => ({
        x: originX - ((originX - origin.x) / current) * clamped,
        y: originY - ((originY - origin.y) / current) * clamped,
      }));
      return clamped;
    });
  }, []);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const target = node;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = target.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
      setScale((current) => {
        const next = clampScale(current * factor);
        setOffset((origin) => ({
          x: px - ((px - origin.x) / current) * next,
          y: py - ((py - origin.y) / current) * next,
        }));
        return next;
      });
    }

    target.addEventListener("wheel", onWheel, { passive: false });
    return () => target.removeEventListener("wheel", onWheel);
  }, [viewportRef]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-edit]")) return;
      drag.current = {
        x: event.clientX,
        y: event.clientY,
        ox: offset.x,
        oy: offset.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [offset.x, offset.y],
  );

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (event.clientX - drag.current.x),
      y: drag.current.oy + (event.clientY - drag.current.y),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  return {
    offset,
    scale,
    zoomTo,
    centerView,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  };
}
