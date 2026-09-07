import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * localStorage key used to remember whether we've already shown the
 * one-time "drag down to dismiss" hint to the user. Cleared by the
 * user implicitly on first dismiss / first close.
 */
const HINT_STORAGE_KEY = "eduspace.bottomSheetHintSeen";

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

interface VisibleViewport {
  height: number;
  top: number;
}

function getVisibleViewport(): VisibleViewport {
  if (typeof window === "undefined") return { height: 0, top: 0 };
  const viewport = window.visualViewport;
  return {
    height: viewport?.height ?? window.innerHeight,
    top: viewport?.offsetTop ?? 0,
  };
}

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
  const [showHint, setShowHint] = useState(false);
  const [visibleViewport, setVisibleViewport] = useState(getVisibleViewport);
  const { t } = useTranslation("common");

  useEffect(() => {
    if (!open) return;

    const updateViewport = () => {
      const nextViewport = getVisibleViewport();
      setVisibleViewport((currentViewport) =>
        currentViewport.height === nextViewport.height && currentViewport.top === nextViewport.top
          ? currentViewport
          : nextViewport,
      );
    };

    updateViewport();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, [open]);

  // First-open tour hint — shows below the drag handle for ~5s the very
  // first time the user opens any BottomSheet on this device, then never
  // again (state is persisted in localStorage).
  useEffect(() => {
    if (!open) return;
    try {
      if (localStorage.getItem(HINT_STORAGE_KEY) === "1") return;
    } catch {
      // Privacy mode / disabled storage — fall through and show the hint.
    }
    const showTimeout = window.setTimeout(() => setShowHint(true), 0);
    const timeout = window.setTimeout(() => {
      setShowHint(false);
      try {
        localStorage.setItem(HINT_STORAGE_KEY, "1");
      } catch {
        // Ignore quota / disabled-storage errors.
      }
    }, 5000);
    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(timeout);
    };
  }, [open]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setDragOffset(0);
      setIsDragging(false);
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch") return;
      // First successful drag dismisses the hint and persists "seen".
      setShowHint(false);
      try {
        localStorage.setItem(HINT_STORAGE_KEY, "1");
      } catch {
        // ignore
      }
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
      if (e.pointerType === "touch") return;
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
      if (e.pointerType === "touch") return;
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
        handleOpenChange(false);
      } else {
        setDragOffset(0);
      }
    },
    [handleOpenChange],
  );

  const handleTouchStart = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    setShowHint(false);
    try {
      localStorage.setItem(HINT_STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures.
    }
    dragRef.current = {
      active: true,
      startY: touch.clientY,
      currentY: touch.clientY,
      startTime: performance.now(),
    };
    setIsDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!dragRef.current.active || !touch) return;
    e.preventDefault();
    dragRef.current.currentY = touch.clientY;
    setDragOffset(Math.max(0, touch.clientY - dragRef.current.startY));
  }, []);

  const handleTouchEnd = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    const touch = e.changedTouches[0];
    const endY = touch?.clientY ?? drag.currentY;
    const deltaY = endY - drag.startY;
    const elapsed = Math.max(1, performance.now() - drag.startTime);
    const panelHeight = e.currentTarget.parentElement?.getBoundingClientRect().height ?? 1;
    drag.active = false;
    setIsDragging(false);
    if (deltaY / panelHeight >= DISMISS_RATIO || deltaY / elapsed >= DISMISS_VELOCITY) {
      handleOpenChange(false);
    } else {
      setDragOffset(0);
    }
  }, [handleOpenChange]);

  const heightRatio = Math.min(100, Math.max(1, height)) / 100;
  const sheetHeight = visibleViewport.height * heightRatio;
  const sheetTop = visibleViewport.top + visibleViewport.height - sheetHeight;
  const isFullScreen = heightRatio >= 0.95;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
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
          aria-describedby={undefined}
          style={{
            height: `${sheetHeight}px`,
            top: `${sheetTop}px`,
            transform: `translateY(${dragOffset}px)`,
            transition: isDragging ? "none" : "transform 220ms ease-out",
          }}
          className={cn(
            "fixed left-0 right-0 z-50 flex flex-col",
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
            data-testid="bottom-sheet-drag-handle"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className={cn(
              "relative px-4 pb-3 border-b border-[var(--b)] flex flex-col items-center gap-2 cursor-grab touch-none overscroll-contain flex-shrink-0",
              isFullScreen ? "pt-[max(0.5rem,env(safe-area-inset-top))]" : "pt-2",
            )}
          >
            <span className="w-10 h-1.5 rounded-full bg-[var(--s4,#272735)] block" />
            <DialogPrimitive.Close
              aria-label={t("actions.close")}
              className={cn(
                "absolute end-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--s3)] text-[var(--t1)] transition-colors hover:bg-[var(--s4)] active:scale-95",
                isFullScreen ? "top-[max(0.5rem,env(safe-area-inset-top))]" : "top-2",
              )}
              onPointerDown={(event) => event.stopPropagation()}
              onTouchStart={(event) => event.stopPropagation()}
            >
              <X size={20} />
            </DialogPrimitive.Close>
            {title && (
              <DialogPrimitive.Title className="text-sm font-semibold text-[var(--t1)] self-start">
                {title}
              </DialogPrimitive.Title>
            )}
            {showHint && (
              <span
                className={cn(
                  "self-center text-[11px] text-[var(--t3)]",
                  "flex items-center gap-1",
                  "animate-pulse",
                )}
                role="status"
              >
                <span aria-hidden>↓</span>
                {t("bottomSheet.dragHint", {
                  defaultValue: "Drag down to close",
                })}
              </span>
            )}
          </div>

          {/* Body: scrollable. */}
          <div className="flex-1 overflow-y-auto p-3">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
