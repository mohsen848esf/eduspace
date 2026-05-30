import { cn } from "../../../lib/utils";

interface MobileSwipeDotsProps {
  count: number;
  active: number;
  /** Optional click handler that lets users jump by tapping a dot. */
  onSelect?: (index: number) => void;
  /** Aria label describing the swipe stage; defaults to a generic phrase. */
  ariaLabel?: string;
  /** Tailwind classes appended to the wrapper. */
  className?: string;
}

/**
 * Small pagination indicator shown above the in-call control bar on
 * mobile. Active dot is wider and brand-colored; the others are dim.
 *
 * Pure presentation — the parent (MobileSwipeStage) owns the actual
 * page index and just hands us the count + active.
 */
export default function MobileSwipeDots({
  count,
  active,
  onSelect,
  ariaLabel,
  className,
}: MobileSwipeDotsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel ?? "Pages"}
      className={cn(
        "flex items-center justify-center gap-1.5 py-2 flex-shrink-0 select-none",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => {
        const isActive = i === active;
        return (
          <button
            key={i}
            role="tab"
            aria-selected={isActive}
            aria-label={`Page ${i + 1}`}
            tabIndex={onSelect ? 0 : -1}
            onClick={() => onSelect?.(i)}
            className={cn(
              "h-1.5 rounded-full border-none cursor-pointer transition-all duration-200",
              isActive
                ? "w-5 bg-[var(--brand)]"
                : "w-1.5 bg-[var(--t3)] hover:bg-[var(--t2)]",
            )}
          />
        );
      })}
    </div>
  );
}
