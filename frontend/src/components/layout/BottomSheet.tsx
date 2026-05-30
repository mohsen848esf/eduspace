import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional title — appears next to the drag handle. */
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Tailwind classes appended to the panel. */
  panelClassName?: string;
  /**
   * Height of the sheet at its expanded snap point, as a viewport-height
   * percentage. Defaults to 100% (full-screen) so the sheet feels like
   * a dedicated mobile screen rather than a peek panel.
   */
  height?: number;
  /** Accessible label when no visible title is provided. */
  ariaLabel?: string;
}

/** Drag distance / sheet height ratio above which we dismiss. */
const DISMISS_RATIO = 0.25;
/** Pointer velocity (px/ms) above which we dismiss regardless of ratio. */
const DISMISS_VELOCITY = 0.5;

/**
 * Mobile-first bottom sheet built on @radix-ui/react-dialog.
 *
 * - Slides up from the bottom of the viewport.
 * - Drag the handle (or anywhere in the title strip) downward to dismiss.
 * - Backdrop tap or Escape key closes; focus is trapped inside while open.
 * - Body scroll is locked by Radix automatically.
 *
 * The sheet is intentionally simpler than a full multi-snap component —
 * one open height, one dismiss gesture. That covers the in-call alt
 * mode use case without dragging a 600-line library along.
 */
export default function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
  panelClassName,
  height = 100,
  ariaLabel,
}: BottomSheetProps) {
  const dragRef = useRef({ active: false, startY: 0, currentY: 0, startTime: 0 });
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Reset drag state every time the sheet reopens; no leftover offsets.
  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [open]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      dragRef.current = {
        active: true,
        startY: e.clientY,
        currentY: e.clientY,
        startTime: performance.now(),
      };
      try {
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      } catch {
        // iOS Safari occasionally throws when the element is mid-layout.
      }
      setIsDragging(true);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      const deltaY = e.clientY - drag.startY;
      drag.currentY = e.clientY;
      // Only move downward; upward drags are clamped to 0.
      setDragOffset(Math.max(0, deltaY));
    },
    [],
  );

  const handlePointerEnd = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      const deltaY = drag.currentY - drag.startY;
      const elapsed = Math.max(1, performance.now() - drag.startTime);
      const velocity = deltaY / elapsed;
      const sheet = (e.currentTarget as HTMLElement).parentElement;
      const panelHeight = sheet?.getBoundingClientRect().height ?? 1;
      const ratio = deltaY / panelHeight;

      drag.active = false;
      setIsDragging(false);

      try {
        (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      } catch {
        // Silently ignore.
      }

      if (ratio >= DISMISS_RATIO || velocity >= DISMISS_VELOCITY) {
        onOpenChange(false);
      } else {
        setDragOffset(0);
      }
    },
    [onOpenChange],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "transition-opacity duration-200",
            "data-[state=open]:opacity-100",
            "data-[state=closed]:opacity-0",
          )}
        />
        <DialogPrimitive.Content
          aria-label={ariaLabel}
          style={{
            height: `${height}vh`,
            transform: `translateY(${dragOffset}px)`,
            transition: isDragging ? "none" : "transform 220ms ease-out",
          }}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 flex flex-col",
            "bg-[var(--s1)] text-[var(--t1)]",
            "rounded-t-2xl border-t border-[var(--b)] shadow-2xl",
            // Slide-from-bottom on open / close.
            "data-[state=open]:animate-in data-[state=open]:duration-200 data-[state=open]:slide-in-from-bottom",
            "data-[state=closed]:animate-out data-[state=closed]:duration-150 data-[state=closed]:slide-out-to-bottom",
            "focus:outline-none",
            panelClassName,
          )}
        >
          {/* Drag handle strip — also acts as the title bar. */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            className="px-4 pt-2 pb-3 border-b border-[var(--b)] flex flex-col items-center gap-2 cursor-grab touch-none flex-shrink-0"
          >
            <span className="w-10 h-1.5 rounded-full bg-[var(--s4,#272735)] block" />
            {title && (
              <DialogPrimitive.Title className="text-sm font-semibold text-[var(--t1)] self-start">
                {title}
              </DialogPrimitive.Title>
            )}
          </div>

          {/* Body: scrollable. */}
          <div className="flex-1 overflow-y-auto p-3">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
