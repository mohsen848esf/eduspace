import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Spinner from "../../../components/ui/Spinner";
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";
import recordingsApi, {
  type RecordingViewer,
} from "../api/recordings.api";

interface RecordingViewersPanelProps {
  open: boolean;
  recordingToken: string;
  durationSeconds: number;
  onClose: () => void;
}

function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Host-only watch analytics modal.
 * Lists every non-owner viewer with a progress bar showing the
 * furthest point they reached, plus session count and last-watched.
 */
export default function RecordingViewersPanel({
  open,
  recordingToken,
  durationSeconds,
  onClose,
}: RecordingViewersPanelProps) {
  const { t } = useTranslation(["recordings", "common"]);
  const [items, setItems] = useState<RecordingViewer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    recordingsApi
      .getViews(recordingToken)
      .then((data) => {
        if (cancelled) return;
        setItems(data.results);
      })
      .catch(() => {
        if (cancelled) return;
        setError("error");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, recordingToken]);

  return (
    <Modal
      open={open}
      onOpenChange={(v) => (v ? null : onClose())}
      panelClassName="max-w-lg"
    >
      <ModalHeader>
        <div>
          <ModalTitle>{t("recordings:viewers.title")}</ModalTitle>
          <ModalDescription>
            {t("recordings:viewers.subtitle")}
          </ModalDescription>
        </div>
      </ModalHeader>

      <ModalBody className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="py-10 flex justify-center">
            <Spinner size="md" />
          </div>
        ) : error ? (
          <p className="text-xs text-[var(--red)] text-center py-6">
            {t("recordings:viewers.errorLoading")}
          </p>
        ) : items.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-2 text-[var(--t3)]">
            <span className="text-2xl">👀</span>
            <span className="text-xs">{t("recordings:viewers.empty")}</span>
            <span className="text-[11px] text-center max-w-xs">
              {t("recordings:viewers.emptyHint")}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((v) => {
              const completionPct = Math.round(v.completion_ratio * 100);
              return (
                <div
                  key={v.user_id}
                  className="flex flex-col gap-2 px-3 py-2.5 rounded-xl bg-[var(--s3)] border border-[var(--b)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--t1)] truncate">
                        {v.full_name || v.username}
                      </div>
                      <div className="text-[10px] text-[var(--t3)] truncate">
                        @{v.username}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--t2)] force-ltr flex-shrink-0">
                      {formatRelative(v.last_watched_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className="flex-1 h-1.5 rounded-full bg-[var(--s4)] overflow-hidden"
                      role="progressbar"
                      aria-valuenow={completionPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t("recordings:viewers.progressLabel", {
                        percent: completionPct,
                      })}
                    >
                      <div
                        className={cn(
                          "h-full transition-all",
                          completionPct >= 90
                            ? "bg-[var(--green)]"
                            : "bg-[var(--brand)]",
                        )}
                        style={{ width: `${Math.max(2, completionPct)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[var(--t2)] force-ltr w-10 text-end">
                      {completionPct}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[var(--t3)] font-mono force-ltr">
                    <span>
                      {t("recordings:viewers.furthest")}:{" "}
                      <span className="text-[var(--t2)]">
                        {formatTimecode(v.furthest_position_seconds)}
                      </span>
                      {durationSeconds > 0 && (
                        <span className="text-[var(--t3)]">
                          {" "}
                          / {formatTimecode(durationSeconds)}
                        </span>
                      )}
                    </span>
                    <span>
                      {t("recordings:viewers.sessions", {
                        count: v.view_count,
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("recordings:viewers.close")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
