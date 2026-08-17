import { type ReactionParticle } from "../../hooks/useReactions";
import { cn } from "../../../../lib/utils";

interface ReactionOverlayProps {
  particles: ReactionParticle[];
}

export default function ReactionOverlay({ particles }: ReactionOverlayProps) {
  if (!particles || particles.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40 select-none">
      {particles.map((p, idx) => (
        <div
          key={p.id}
          className="absolute bottom-20 flex flex-col items-center animate-reaction-float"
          style={{
            left: `${p.x}%`,
            animationDuration: `${p.speed}s`,
            transform: `scale(${p.scale}) rotate(${p.rotation}deg)`,
            ["--sway" as any]: `${p.swayAmount}px`,
          }}
        >
          {/* Floating Emoji */}
          <span
            className="text-4xl md:text-5xl filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] transform-gpu hover:scale-125 transition-transform"
            role="img"
            aria-label="reaction"
          >
            {p.emoji}
          </span>

          {/* Sender Badge (shown on lead particle) */}
          {idx % 3 === 0 && p.senderName && (
            <span
              className={cn(
                "mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white/90 shadow-md",
                "bg-black/60 backdrop-blur-md border border-white/10 animate-fade-out"
              )}
              style={{ animationDuration: `${p.speed * 0.8}s` }}
            >
              {p.senderName}
            </span>
          )}
        </div>
      ))}

      {/* Embedded CSS for seamless animation */}
      <style>{`
        @keyframes reactionFloat {
          0% {
            opacity: 0;
            transform: translateY(20px) translateX(0) scale(0.3);
          }
          15% {
            opacity: 1;
            transform: translateY(-40px) translateX(calc(var(--sway) * 0.3)) scale(1.1);
          }
          45% {
            opacity: 1;
            transform: translateY(-180px) translateX(calc(var(--sway) * -0.6)) scale(1.0);
          }
          75% {
            opacity: 0.85;
            transform: translateY(-380px) translateX(calc(var(--sway) * 0.8)) scale(0.95);
          }
          100% {
            opacity: 0;
            transform: translateY(-560px) translateX(calc(var(--sway) * -0.3)) scale(0.8);
          }
        }
        .animate-reaction-float {
          animation-name: reactionFloat;
          animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
          animation-fill-mode: forwards;
        }
        @keyframes fadeOutPill {
          0% { opacity: 0; transform: scale(0.7); }
          20% { opacity: 1; transform: scale(1); }
          70% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-30px); }
        }
        .animate-fade-out {
          animation-name: fadeOutPill;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
