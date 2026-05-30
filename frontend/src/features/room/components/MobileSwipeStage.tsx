import {
  Children,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../../lib/utils";

interface MobileSwipeStageProps {
  /** Index of the currently displayed page; controlled by the parent. */
  activeIndex: number;
  /** Called when the page should change (drag, key, dot tap). */
  onActiveIndexChange: (next: number) => void;
  /**
   * The pages to render. Each child becomes a full-viewport-width slide.
   * Number of pages is derived from Children.count.
   */
  children: React.ReactNode;
  /** Tailwind classes applied to the outer viewport. */
  className?: string;
  /** Optional aria-label for the swipe region. */
  ariaLabel?: string;
}

/** Drag distance / viewport-width ratio above which we advance pages. */
const SWIPE_RATIO_THRESHOLD = 0.3;
/** Pointer velocity (px/ms) above which we advance regardless of ratio. */
const SWIPE_VELOCITY_THRESHOLD = 0.4;
/** Minimum horizontal pixels before we hijack the gesture from the page. */
const HIJACK_THRESHOLD_PX = 6;
/** Snap animation duration. */
const SNAP_TRANSITION_MS = 220;

interface DragState {
  active: boolean;
  /** Have we crossed the hijack threshold and started owning the gesture? */
  captured: boolean;
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  pointerId: number | null;
}

const NO_DRAG: DragState = {
  active: false,
  captured: false,
  startX: 0,
  startY: 0,
  startTime: 0,
  currentX: 0,
  pointerId: null,
};

/**
 * Touch/mouse-driven horizontal pager for the mobile in-call layout.
 *
 * Each child becomes a full-viewport-width slide. The user moves between
 * pages by:
 *   - horizontal drag (touch or mouse)
 *   - tapping the dots (handled by parent)
 *   - pressing Left/Right when the stage has keyboard focus
 *
 * RTL handling:
 *   The visual track translates by `-activeIndex * width` in LTR. In RTL
 *   we translate by `+activeIndex * width` (positive) so the same logical
 *   "next" page sits to the start side of the viewport. Drag delta is
 *   inverted in RTL so a rightward drag advances.
 *
 * The component is fully controlled — `activeIndex` and
 * `onActiveIndexChange` come from the parent (MobileSwipeShell wires
 * them to the room layout store).
 */
export default function MobileSwipeStage({
  activeIndex,
  onActiveIndexChange,
  children,
  className,
  ariaLabel,
}: MobileSwipeStageProps) {
  const count = Children.count(children);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({ ...NO_DRAG });
  // Live drag offset for the current frame — drives the inline transform
  // while the user's finger is down; reset to 0 once the snap completes.
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const isRtl =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("dir") === "rtl"
      : false;
  const directionSign = isRtl ? 1 : -1;

  const respectsReducedMotion = useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const widthRef = useRef(0);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      widthRef.current = el?.clientWidth ?? 0;
      return;
    }
    const ro = new ResizeObserver(() => {
      widthRef.current = el.clientWidth;
    });
    ro.observe(el);
    widthRef.current = el.clientWidth;
    return () => ro.disconnect();
  }, []);

  const clamp = useCallback(
    (n: number) => Math.max(0, Math.min(count - 1, n)),
    [count],
  );

  // Compute the track's offset in pixels for the *settled* state. Drag
  // delta layers on top via the transform string built below.
  const settledOffsetPx = activeIndex * widthRef.current * directionSign;

  // Translate is settled offset + (negative-of-direction × drag delta in
  // RTL, plain in LTR). Easier to think of as: the track follows your
  // finger; if you drag start->end (positive deltaX in LTR), the track
  // translates positive too, revealing the previous page.
  const translatePx = settledOffsetPx + dragOffsetPx;

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    // Only primary button / touch / pen.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragRef.current = {
      active: true,
      captured: false,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      currentX: e.clientX,
      pointerId: e.pointerId,
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) return;

      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;

      if (!drag.captured) {
        // We only steal the gesture once horizontal travel beats the
        // threshold AND beats vertical travel — otherwise it's a vertical
        // scroll inside one of the panels (chat list, participants).
        if (Math.abs(deltaX) > HIJACK_THRESHOLD_PX && Math.abs(deltaX) > Math.abs(deltaY)) {
          drag.captured = true;
          setIsDragging(true);
          // Capture the pointer so move/up keep firing even if the
          // pointer leaves the element.
          try {
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          } catch {
            // iOS Safari sometimes throws when the element is mid-layout.
            // The event listeners on the document will still pick events up.
          }
        } else if (Math.abs(deltaY) > HIJACK_THRESHOLD_PX) {
          // Clearly a vertical scroll — bow out for the rest of the gesture.
          drag.active = false;
          return;
        } else {
          return;
        }
      }

      drag.currentX = e.clientX;

      // Prevent overscroll past the first/last page: when at the edge,
      // dampen the offset so the user feels resistance.
      let raw = deltaX;
      if (
        (activeIndex === 0 && directionSign === -1 && raw > 0) ||
        (activeIndex === 0 && directionSign === 1 && raw < 0) ||
        (activeIndex === count - 1 && directionSign === -1 && raw < 0) ||
        (activeIndex === count - 1 && directionSign === 1 && raw > 0)
      ) {
        raw = raw / 3;
      }

      setDragOffsetPx(raw);
    },
    [activeIndex, count, directionSign],
  );

  const settle = useCallback(
    (nextIndex: number) => {
      const target = clamp(nextIndex);
      // Reset drag offset; the activeIndex change drives the rest of
      // the translation through settledOffsetPx.
      setDragOffsetPx(0);
      setIsDragging(false);
      if (target !== activeIndex) {
        onActiveIndexChange(target);
      }
    },
    [activeIndex, clamp, onActiveIndexChange],
  );

  const handlePointerEnd = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) {
        dragRef.current = { ...NO_DRAG };
        return;
      }
      const deltaX = (drag.captured ? drag.currentX : drag.startX) - drag.startX;
      const elapsed = Math.max(1, performance.now() - drag.startTime);
      const velocity = Math.abs(deltaX) / elapsed;
      const width = widthRef.current || 1;
      // Direction-aware: in LTR a leftward drag (deltaX < 0) advances;
      // in RTL a rightward drag (deltaX > 0) advances.
      const advanceSign = -directionSign;
      const advanced = deltaX * advanceSign > 0;

      let next = activeIndex;
      const ratio = Math.abs(deltaX) / width;
      if (
        ratio >= SWIPE_RATIO_THRESHOLD ||
        velocity >= SWIPE_VELOCITY_THRESHOLD
      ) {
        next = activeIndex + (advanced ? 1 : -1);
      }

      try {
        (e.currentTarget as Element).releasePointerCapture?.(
          drag.pointerId ?? e.pointerId,
        );
      } catch {
        // Silently ignore — see comment in pointer-down for why.
      }
      dragRef.current = { ...NO_DRAG };
      settle(next);
    },
    [activeIndex, directionSign, settle],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      // Direction-aware: ArrowRight advances in LTR, retreats in RTL.
      const advanceKey = isRtl ? "ArrowLeft" : "ArrowRight";
      const delta = e.key === advanceKey ? 1 : -1;
      onActiveIndexChange(clamp(activeIndex + delta));
    },
    [activeIndex, clamp, isRtl, onActiveIndexChange],
  );

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label={ariaLabel ?? "Swipe pages"}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      // touch-pan-y lets the browser keep handling vertical scrolls inside
      // panels; only horizontal moves reach our pointer handlers.
      className={cn(
        "flex-1 overflow-hidden touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
        className,
      )}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          transform: `translate3d(${translatePx}px, 0, 0)`,
          transition:
            isDragging || respectsReducedMotion
              ? "none"
              : `transform ${SNAP_TRANSITION_MS}ms ease-out`,
        }}
        className="flex h-full"
      >
        {Children.map(children, (child, idx) => (
          <div
            key={idx}
            aria-hidden={idx !== activeIndex}
            className="w-full h-full shrink-0 overflow-hidden"
            style={{ width: "100%" }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
