import { useEffect, useRef } from "react";
import { cn } from "../../../../lib/utils";

interface ReactionsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

const REACTION_EMOJIS = [
  { emoji: "💖", label: "Heart" },
  { emoji: "👍", label: "Thumbs Up" },
  { emoji: "🎉", label: "Party" },
  { emoji: "👏", label: "Clap" },
  { emoji: "😂", label: "Laugh" },
  { emoji: "😮", label: "Surprised" },
  { emoji: "😢", label: "Sad" },
  { emoji: "🤔", label: "Thinking" },
  { emoji: "👎", label: "Thumbs Down" },
  { emoji: "🚀", label: "Rocket" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "💯", label: "100" },
];

export default function ReactionsPopover({
  isOpen,
  onClose,
  onSelectEmoji,
}: ReactionsPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) && !(e.target as Element).closest('[data-room-popup="reactions"], button[aria-expanded]')
      ) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 select-none",
        "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 p-1.5 md:p-2 rounded-full backdrop-blur-2xl shadow-2xl border",
          "bg-[var(--s2)]/95 border-[var(--b)] text-[var(--t1)]",
          "max-w-[calc(100vw-1.5rem)] overflow-x-auto scrollbar-none touch-pan-x"
        )}
        style={{
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.3), 0 0 20px rgba(37,99,235,0.15)",
        }}
      >
        {REACTION_EMOJIS.map(({ emoji, label }) => (
          <button
            key={emoji}
            type="button"
            title={label}
            onClick={() => {
              onSelectEmoji(emoji);
            }}
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-2xl",
              "border-none bg-transparent cursor-pointer transition-all duration-150 transform-gpu",
              "hover:scale-135 hover:-translate-y-1 hover:bg-[var(--s3)] active:scale-90",
              "focus:outline-hidden"
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
