import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import Button from "../../../components/ui/Button";
import Spinner from "../../../components/ui/Spinner";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Icons } from "../../../lib/constants/icons";
import { cn } from "../../../lib/utils";
import recordingsApi, { type Recording } from "../api/recordings.api";
import RecordingPlayer from "./RecordingPlayer";
import PublishModal from "./PublishModal";

function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export default function RecordingEditPage() {
  const { t } = useTranslation(["recordings", "common"]);
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();

  const [recording, setRecording] = useState<Recording | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [previewKey, setPreviewKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showPublish, setShowPublish] = useState(false);

  // Load
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setIsLoading(true);
    recordingsApi
      .detail(token)
      .then((data) => {
        if (cancelled) return;
        setRecording(data);
        setTrimStart(data.trim_start_seconds ?? 0);
        setTrimEnd(
          data.trim_end_seconds != null
            ? data.trim_end_seconds
            : data.duration_seconds,
        );
      })
      .catch(() => {
        toast.error(t("editor.notReady"));
        navigate("/recordings");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate, t]);

  const fullDuration = recording?.duration_seconds ?? 0;
  const trimmedDuration = useMemo(
    () => Math.max(0, trimEnd - trimStart),
    [trimStart, trimEnd],
  );

  const handleSave = async () => {
    if (!recording) return;
    setIsSaving(true);
    try {
      const next = await recordingsApi.finalize(recording.public_token, {
        trim_start_seconds: trimStart,
        trim_end_seconds: trimEnd >= fullDuration ? null : trimEnd,
      });
      setRecording(next);
      // Force RecordingPlayer to re-fetch with the trimmed file.
      setPreviewKey((k) => k + 1);
      toast.success(t("editor.saved"));
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t("editor.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnpublish = async () => {
    if (!recording) return;
    try {
      const next = await recordingsApi.unpublish(recording.public_token);
      setRecording(next);
      toast.success(t("editor.unpublished"));
    } catch {
      toast.error(t("editor.publishError"));
    }
  };

  const handleDelete = async () => {
    if (!recording) return;
    if (!window.confirm(t("card.deleteConfirm"))) return;
    try {
      await recordingsApi.remove(recording.public_token);
      navigate("/recordings");
    } catch {
      toast.error(t("editor.saveError"));
    }
  };

  const handlePublish = async (userIds: number[]) => {
    if (!recording) return;
    try {
      const next = await recordingsApi.publish(recording.public_token, userIds);
      setRecording(next);
      toast.success(t("editor.published"));
    } catch {
      toast.error(t("editor.publishError"));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--s0)]">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!recording) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--s0)] text-[var(--t1)]">
      {/* Topbar */}
      <header className="h-14 flex items-center justify-between px-5 bg-[var(--s1)] border-b border-[var(--b)]">
        <div className="flex items-center gap-3">
          <Tooltip content={t("editor.back")}>
            <button
              onClick={() => navigate("/recordings")}
              className="w-9 h-9 rounded-lg bg-transparent border-none cursor-pointer text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] flex items-center justify-center"
            >
              <span className="rtl-flip">{Icons.leave}</span>
            </button>
          </Tooltip>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {recording.room_name ||
                recording.room_code ||
                recording.public_token}
            </div>
            <div className="text-[11px] text-[var(--t3)]">
              {t("editor.title")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {recording.is_published ? (
            <Button variant="ghost" size="sm" onClick={handleUnpublish}>
              {t("editor.unpublish")}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowPublish(true)}>
              {t("editor.publish")}
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={handleDelete}>
            {t("editor.delete")}
          </Button>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-5xl mx-auto p-5 flex flex-col gap-5">
        <RecordingPlayer
          key={previewKey}
          token={recording.public_token}
          startSeconds={trimStart}
        />

        <div className="bg-[var(--s2)] rounded-xl border border-[var(--b)] p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-semibold">{t("editor.title")}</div>
            <div className="flex items-center gap-3 text-[11px] text-[var(--t3)] font-mono force-ltr">
              <span>
                {t("editor.originalDuration")}: {formatTimecode(fullDuration)}
              </span>
              <span>
                {t("editor.trimmedDuration")}:{" "}
                <span className="text-[var(--t1)]">
                  {formatTimecode(trimmedDuration)}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <TrimSlider
              label={t("editor.trimStart")}
              value={trimStart}
              max={Math.max(0, trimEnd - 1)}
              onChange={(v) => setTrimStart(Math.min(v, trimEnd - 1))}
            />
            <TrimSlider
              label={t("editor.trimEnd")}
              value={trimEnd}
              min={Math.min(trimStart + 1, fullDuration)}
              max={fullDuration}
              onChange={(v) => setTrimEnd(Math.max(v, trimStart + 1))}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewKey((k) => k + 1)}
            >
              {t("editor.preview")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              loading={isSaving}
              disabled={
                trimStart === (recording.trim_start_seconds ?? 0) &&
                (trimEnd === (recording.trim_end_seconds ?? fullDuration))
              }
            >
              {t("editor.save")}
            </Button>
          </div>
        </div>
      </main>

      <PublishModal
        open={showPublish}
        onClose={() => setShowPublish(false)}
        initialSelected={
          recording.shared_with?.map((s) => ({
            id: s.id,
            username: s.username,
            full_name: s.full_name,
          })) ?? []
        }
        onPublish={handlePublish}
      />
    </div>
  );
}

function TrimSlider({
  label,
  value,
  min = 0,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-semibold text-[var(--t3)] uppercase tracking-wider w-12 flex-shrink-0">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={cn(
          "flex-1 accent-[var(--brand)]",
          "h-1 rounded-full bg-[var(--s3)]",
        )}
      />
      <span className="text-[11px] font-mono text-[var(--t1)] w-12 text-end force-ltr">
        {value.toFixed(1)}s
      </span>
    </div>
  );
}
