import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";
import { Tooltip } from "../../../components/ui/Tooltip";
import { type Recording } from "../api/recordings.api";

interface RecordingCardProps {
  recording: Recording;
  onDelete?: (token: string) => void;
}

function formatDuration(seconds: number, t: (k: string, v?: any) => string) {
  if (seconds < 60) return t("card.durationShort", { seconds });
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return t("card.duration", { minutes: m, seconds: s });
}

export default function RecordingCard({ recording, onDelete }: RecordingCardProps) {
  const { t } = useTranslation("recordings");
  const navigate = useNavigate();

  const isOwner = recording.is_owner === true;
  const statusBadge = (() => {
    if (recording.status === "processing")
      return { text: t("card.processingBadge"), className: "bg-[var(--amber)]/15 text-[var(--amber)]" };
    if (recording.status === "failed")
      return { text: t("card.failedBadge"), className: "bg-[var(--red)]/15 text-[var(--red)]" };
    if (recording.is_published)
      return { text: t("card.publishedBadge"), className: "bg-[var(--green)]/15 text-[var(--green)]" };
    return { text: t("card.draftBadge"), className: "bg-[var(--s3)] text-[var(--t2)]" };
  })();

  const isPlayable =
    recording.status === "completed" || recording.status === "failed";

  const open = () => {
    if (isOwner) navigate(`/recordings/${recording.public_token}/edit`);
    else navigate(`/recordings/${recording.public_token}`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (window.confirm(t("card.deleteConfirm"))) {
      onDelete(recording.public_token);
    }
  };

  const startedAt = new Date(recording.started_at).toLocaleString();

  return (
    <div
      onClick={open}
      className={cn(
        "group flex flex-col bg-[var(--s2)] rounded-xl border border-[var(--b)] overflow-hidden",
        "hover:border-[var(--bh)] cursor-pointer transition-colors",
      )}
    >
      <div className="aspect-video bg-black flex items-center justify-center text-3xl text-[var(--t3)]">
        🎬
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--t1)] truncate">
              {recording.room_name || recording.room_code || recording.public_token}
            </div>
            <div className="text-[11px] text-[var(--t3)] truncate">
              {recording.owner_full_name
                ? t("card.by", { name: recording.owner_full_name })
                : startedAt}
            </div>
          </div>
          <span
            className={cn(
              "text-[9px] font-semibold px-1.5 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0",
              statusBadge.className,
            )}
          >
            {statusBadge.text}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-[var(--t3)]">
          <span>{startedAt}</span>
          <span className="font-mono force-ltr">
            {formatDuration(recording.duration_seconds, t)}
          </span>
        </div>
        {isPlayable && (
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/recordings/${recording.public_token}`);
              }}
              className="flex-1 h-7 rounded-md border-none cursor-pointer text-[11px] font-semibold bg-[var(--brand-soft)] text-[var(--brand-text)] hover:bg-[var(--brand)]/15 transition-colors"
            >
              {t("card.watch")}
            </button>
            {isOwner && (
              <>
                <Tooltip content={t("card.edit")}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/recordings/${recording.public_token}/edit`);
                    }}
                    className="w-7 h-7 rounded-md border-none cursor-pointer bg-[var(--s3)] text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s4)] flex items-center justify-center text-xs"
                  >
                    ✎
                  </button>
                </Tooltip>
                {onDelete && (
                  <Tooltip content={t("card.delete")}>
                    <button
                      onClick={handleDelete}
                      className="w-7 h-7 rounded-md border-none cursor-pointer bg-[var(--s3)] text-[var(--t2)] hover:text-[var(--red)] hover:bg-[var(--red)]/15 flex items-center justify-center text-xs"
                    >
                      ✕
                    </button>
                  </Tooltip>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
