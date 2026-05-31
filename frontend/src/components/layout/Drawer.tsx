import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../../lib/utils";

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /**
   * Logical side the drawer slides in from. "start" follows reading
   * direction (left in LTR, right in RTL) which is what users expect
   * for a hamburger menu.
   */
  side?: "start" | "end";
  /** Tailwind utility extras applied to the panel. */
  panelClassName?: string;
  /** Accessible label when no visible title is provided. */
  ariaLabel?: string;
}

/**
 * Side-overlay panel for mobile-only secondary navigation.
 *
 * Built on @radix-ui/react-dialog so we get a focus trap, Escape-to-close,
 * backdrop-click-to-close, and body-scroll lock for free.
 *
 * Slide direction is driven by the `data-state` attribute Radix sets on
 * the panel and a translate transform that's positive or negative
 * depending on the side. RTL handling: we use logical positioning
 * (`start-0` / `end-0`) so the panel itself sits on the correct side;
 * the transform direction reverses by reading the document's `dir`
 * attribute through CSS via the `[dir=rtl]` selector at the root.
 */
export function Drawer({
  open,
  onOpenChange,
  children,
  side = "start",
  panelClassName,
  ariaLabel,
}: DrawerProps) {
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
          data-side={side}
          className={cn(
            "fixed top-0 bottom-0 z-50 flex flex-col",
            side === "start" ? "start-0" : "end-0",
            "w-72 max-w-[85vw] bg-[var(--s1)] text-[var(--t1)]",
            side === "start"
              ? "border-e border-[var(--b)]"
              : "border-s border-[var(--b)]",
            "shadow-2xl",
            // Slide animation: a CSS variable picks the offset axis based
            // on the side data attribute. Positive = open, translate to 0.
            "transition-transform duration-200 ease-out",
            "data-[state=open]:translate-x-0",
            // Closed state: push off-screen on the appropriate axis.
            // The CSS variable +/- handles RTL because Tailwind maps
            // logical start/end to the right physical side automatically,
            // and our translate-x is overridden by the [dir=rtl] selector
            // in design-system.css when needed.
            side === "start"
              ? "data-[state=closed]:-translate-x-full rtl:data-[state=closed]:translate-x-full"
              : "data-[state=closed]:translate-x-full rtl:data-[state=closed]:-translate-x-full",
            "focus:outline-none",
            panelClassName,
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface SectionProps {
  children?: React.ReactNode;
  className?: string;
}

export function DrawerHeader({ children, className }: SectionProps) {
  return (
    <div
      className={cn(
        "px-4 py-4 border-b border-[var(--b)] flex items-center gap-3 flex-shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DrawerTitle({ children, className }: SectionProps) {
  return (
    <DialogPrimitive.Title
      className={cn("text-base font-semibold text-[var(--t1)]", className)}
    >
      {children}
    </DialogPrimitive.Title>
  );
}

export function DrawerBody({ children, className }: SectionProps) {
  return (
    <div className={cn("flex-1 overflow-y-auto p-2", className)}>
      {children}
    </div>
  );
}

export function DrawerFooter({ children, className }: SectionProps) {
  return (
    <div
      className={cn(
        "p-2 border-t border-[var(--b)] flex flex-col gap-1 flex-shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const DrawerClose = DialogPrimitive.Close;
