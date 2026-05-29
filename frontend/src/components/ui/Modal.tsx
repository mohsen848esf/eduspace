import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "../../lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /**
   * Tailwind classes appended to the panel. Use to control width,
   * padding, max-height, etc. Defaults to a comfortable centered card.
   */
  panelClassName?: string;
  /**
   * Whether clicking the backdrop / pressing Escape closes the modal.
   * Off by default for destructive dialogs that require an explicit choice.
   */
  dismissable?: boolean;
}

/**
 * Smooth, animated modal shell built on @radix-ui/react-dialog.
 * Handles backdrop, focus trap, escape-to-close, and reduced-motion automatically.
 *
 * Pair with <ModalHeader>, <ModalBody>, <ModalFooter> for layout, or use
 * <ConfirmModal> for the common 2-button case.
 */
export function Modal({
  open,
  onOpenChange,
  children,
  panelClassName,
  dismissable = true,
}: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
          onClick={(e) => {
            if (!dismissable) e.preventDefault();
          }}
        />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => {
            if (!dismissable) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (!dismissable) e.preventDefault();
          }}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "bg-[var(--s2)] text-[var(--t1)] rounded-2xl border border-[var(--b)] shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
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

export function ModalHeader({ children, className }: SectionProps) {
  return (
    <div
      className={cn(
        "px-5 py-4 border-b border-[var(--b)] flex items-start justify-between gap-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ModalTitle({ children, className }: SectionProps) {
  return (
    <DialogPrimitive.Title
      className={cn("text-sm font-semibold text-[var(--t1)]", className)}
    >
      {children}
    </DialogPrimitive.Title>
  );
}

export function ModalDescription({ children, className }: SectionProps) {
  return (
    <DialogPrimitive.Description
      className={cn("text-xs text-[var(--t3)] mt-0.5", className)}
    >
      {children}
    </DialogPrimitive.Description>
  );
}

export function ModalBody({ children, className }: SectionProps) {
  return (
    <div className={cn("px-5 py-4 flex flex-col gap-3", className)}>
      {children}
    </div>
  );
}

export function ModalFooter({ children, className }: SectionProps) {
  return (
    <div
      className={cn(
        "px-5 py-3 border-t border-[var(--b)] flex items-center justify-end gap-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const ModalClose = DialogPrimitive.Close;
