import { useCallback, useEffect, useRef, useState } from "react";
import { Film, Play, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import type { Room } from "livekit-client";
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/Modal";
import { getApiErrorData, getApiErrorMessage, getApiErrorStatus } from "@/lib/api/errors";
import { sharedMediaApi } from "../api/shared-media.api";
import { resumeMultipartUpload } from "../lib/multipartUpload";
import { resumeProgressiveUpload } from "../lib/progressiveUpload";
import { encodePlaybackInvalidation } from "../lib/realtime";
import type { MediaAsset } from "../schemas/shared-media.schema";
import { useSharedPlaybackStore } from "../store/sharedPlaybackStore";

const MAX_UPLOAD_BYTES = 10 * 1024 ** 3;
const ACCEPTED_TYPES: Record<string, string[]> = {
  mp4: ["video/mp4"],
  webm: ["video/webm"],
  mov: ["video/quicktime"],
  mkv: ["video/x-matroska", "application/octet-stream"],
};
const PROCESSING = new Set(["uploading", "uploaded", "inspecting", "probing", "processing"]);
const UPLOAD_DRAFT_KEY = "eduspace:shared-media-upload:v1";

interface UploadDraft {
  assetToken: string;
  uploadToken: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  mode?: "multipart" | "progressive";
}

const readUploadDraft = (): UploadDraft | null => {
  try {
    const value = JSON.parse(localStorage.getItem(UPLOAD_DRAFT_KEY) || "null") as UploadDraft | null;
    return value?.assetToken && value.uploadToken ? value : null;
  } catch {
    return null;
  }
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: Room;
  roomCode: string;
}

const formatBytes = (bytes: number) =>
  `${(bytes / 1024 ** 2).toFixed(bytes >= 1024 ** 3 ? 0 : 1)} MB`;

type Translate = (key: string, fallback: string) => string;

const RENDITION_READY_STATUSES = new Set(["playable", "ready"]);

// "progressive" is the temporary play-while-uploading stream, an
// implementation detail — not a quality choice worth surfacing here.
const renditionDisplayName = (label: string, t: Translate) =>
  label === "source" ? t("sharedMedia.qualityOriginal", "کیفیت اصلی") : label;

const renditionStatusText = (status: string, t: Translate) => {
  if (RENDITION_READY_STATUSES.has(status)) return t("sharedMedia.renditionReady", "آماده");
  if (status === "failed") return t("sharedMedia.renditionFailed", "ناموفق");
  return t("sharedMedia.renditionPreparing", "در حال آماده‌سازی");
};

const renditionSummary = (asset: MediaAsset, t: Translate) =>
  (asset.renditions ?? [])
    .filter((rendition) => rendition.label !== "progressive")
    .map((rendition) => `${renditionDisplayName(rendition.label, t)}: ${renditionStatusText(rendition.status, t)}`)
    .join(" · ");

export function SharedMediaLibraryModal({ open, onOpenChange, room, roomCode }: Props) {
  const { t } = useTranslation("room");
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [startingToken, setStartingToken] = useState<string | null>(null);
  const [deletingToken, setDeletingToken] = useState<string | null>(null);
  const activePlayback = useSharedPlaybackStore((state) => (
    state.roomCode === roomCode ? state.playback : null
  ));
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await sharedMediaApi.listAssets();
      setAssets(result.results);
      return result.results;
    } catch {
      toast.error(t("sharedMedia.libraryLoadFailed", "دریافت کتابخانه مدیا ناموفق بود."));
      return null;
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const poll = async () => {
      const freshAssets = await refresh();
      if (!disposed) {
        const hasProcessingAsset = freshAssets?.some((asset) => PROCESSING.has(asset.status));
        timer = setTimeout(poll, hasProcessingAsset ? 2_000 : 10_000);
      }
    };
    void poll();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    void sharedMediaApi.getSnapshot(roomCode).then((snapshot) => {
      if (disposed) return;
      useSharedPlaybackStore.getState().applySnapshot(roomCode, snapshot);
    }).catch(() => {
      // The room sync hook remains the fallback source of truth.
    });
    return () => {
      disposed = true;
    };
  }, [open, roomCode]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleFile = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const allowed = ACCEPTED_TYPES[extension];
    const contentType = file.type || (extension === "mkv" ? "application/octet-stream" : "");
    if (!allowed?.includes(contentType) || file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      toast.error(t("sharedMedia.invalidFile", "فقط ویدئوی MP4، WebM، MOV یا MKV تا سقف ۱۰ گیگابایت مجاز است."));
      return;
    }
    setUploading(true);
    setProgress(0);
    setUploadNotice(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      type UploadTarget = {
        assetToken: string;
        uploadToken: string;
        uploadMode: "multipart" | "progressive";
      };

      const startFreshUpload = async (): Promise<UploadTarget> => {
        const asset = await sharedMediaApi.createAsset({
          title: file.name.replace(/\.[^/.]+$/, ""),
          original_filename: file.name,
        });
        const capability = extension === "mp4"
          ? await sharedMediaApi.getProgressiveUploadCapability().catch(() => null)
          : null;
        const uploadMode: "multipart" | "progressive" =
          capability?.play_while_uploading ? "progressive" : "multipart";
        const upload = uploadMode === "progressive"
          ? await sharedMediaApi.initiateProgressiveUpload(asset.public_token, {
              size_bytes: file.size,
              content_type: contentType,
            })
          : await sharedMediaApi.initiateUpload(asset.public_token, {
              size_bytes: file.size,
              content_type: contentType,
            });
        const target: UploadTarget = {
          assetToken: asset.public_token,
          uploadToken: upload.public_token,
          uploadMode,
        };
        localStorage.setItem(UPLOAD_DRAFT_KEY, JSON.stringify({
          assetToken: target.assetToken,
          uploadToken: target.uploadToken,
          fileName: file.name,
          fileSize: file.size,
          contentType,
          mode: target.uploadMode,
        } satisfies UploadDraft));
        return target;
      };

      const runUpload = (target: UploadTarget) =>
        target.uploadMode === "progressive"
          ? resumeProgressiveUpload({
              assetToken: target.assetToken,
              uploadToken: target.uploadToken,
              file,
              signal: controller.signal,
              onProgress: (uploadedBytes, totalBytes) =>
                setProgress(Math.round((uploadedBytes / totalBytes) * 100)),
              onChunkCommitted: () => void refresh(),
              onState: (upload) => {
                if (upload.compatibility === "ineligible") {
                  setUploadNotice(t(
                    "sharedMedia.progressiveFallback",
                    "ساختار این فایل برای پخش حین آپلود مناسب نیست؛ پس از تکمیل آپلود آماده پخش می‌شود.",
                  ));
                } else if (upload.status === "ingesting") {
                  setUploadNotice(t(
                    "sharedMedia.progressiveIngesting",
                    "هم‌زمان با آپلود، بخش‌های قابل پخش در حال آماده‌شدن هستند.",
                  ));
                }
              },
            })
          : resumeMultipartUpload({
              assetToken: target.assetToken,
              uploadToken: target.uploadToken,
              file,
              signal: controller.signal,
              onProgress: ({ uploadedBytes, totalBytes }) =>
                setProgress(Math.round((uploadedBytes / totalBytes) * 100)),
            });

      const draft = readUploadDraft();
      const canResume = Boolean(
        draft?.fileName === file.name && draft.fileSize === file.size && draft.contentType === contentType,
      );
      let target: UploadTarget = canResume && draft
        ? { assetToken: draft.assetToken, uploadToken: draft.uploadToken, uploadMode: draft.mode || "multipart" }
        : await startFreshUpload();

      try {
        await runUpload(target);
      } catch (error) {
        if (!canResume || getApiErrorStatus(error) !== 404) throw error;
        // The resumed session no longer exists server-side (expired, deleted,
        // or saved from a stale/different environment) — start over instead
        // of surfacing a fatal error for something the user can't fix.
        localStorage.removeItem(UPLOAD_DRAFT_KEY);
        setProgress(0);
        target = await startFreshUpload();
        await runUpload(target);
      }

      localStorage.removeItem(UPLOAD_DRAFT_KEY);
      toast.success(t("sharedMedia.uploadComplete", "آپلود کامل شد؛ ویدئو در حال آماده‌سازی است."));
      await refresh();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error(getApiErrorMessage(error, t("sharedMedia.uploadFailed", "آپلود ویدئو ناموفق بود.")));
      }
    } finally {
      abortRef.current = null;
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const deleteAsset = async (asset: MediaAsset) => {
    if (!window.confirm(t("sharedMedia.deleteConfirm", "این ویدئو از کتابخانه حذف شود؟"))) return;
    setDeletingToken(asset.public_token);
    try {
      await sharedMediaApi.deleteAsset(asset.public_token);
      setAssets((current) => current.filter((item) => item.public_token !== asset.public_token));
      toast.success(t("sharedMedia.deleted", "ویدئو از کتابخانه حذف شد."));
    } catch {
      toast.error(t("sharedMedia.deleteFailed", "حذف ویدئو ناموفق بود؛ پخش فعال را ابتدا پایان دهید."));
    } finally {
      setDeletingToken(null);
    }
  };

  const startPlayback = async (asset: MediaAsset) => {
    setStartingToken(asset.public_token);
    try {
      // Reconcile before opening so a stale modal cannot turn a reconnect
      // into a generic 400. A room has one authoritative playback session.
      const snapshot = await sharedMediaApi.getSnapshot(roomCode).catch(() => null);
      const active = snapshot?.playback;
      if (snapshot) useSharedPlaybackStore.getState().applySnapshot(roomCode, snapshot);
      if (active) {
        if (active.asset.public_token === asset.public_token) {
          toast.success(t("sharedMedia.alreadyPlaying", "این ویدئو در همین جلسه در حال پخش است."));
          onOpenChange(false);
        } else {
          toast.error(t("sharedMedia.activePlayback", {
            title: active.asset.title,
            defaultValue: "«{{title}}» در این جلسه در حال پخش است؛ ابتدا پایان پخش برای همه را بزنید.",
          }));
        }
        return;
      }
      const history = await sharedMediaApi.getHistory(asset.public_token);
      const previous = history.results.find((item) => item.ended_at !== null);
      const playback = await sharedMediaApi.openPlayback(roomCode, {
        asset_public_token: asset.public_token,
        resumed_from_id: previous?.id || null,
      });
      useSharedPlaybackStore.getState().applyPlayback(roomCode, playback);
      await room.localParticipant.publishData(
        encodePlaybackInvalidation({
          v: 1,
          type: "SHARED_PLAYBACK_INVALIDATED",
          room_code: roomCode,
          playback_id: playback.id,
          version: playback.version,
          emitted_at: playback.server_now,
        }),
        { reliable: true },
      ).catch(() => undefined);
      onOpenChange(false);
    } catch (error) {
      const payload = getApiErrorData(error);
      if (payload?.code === "ACTIVE_SHARED_PLAYBACK") {
        const snapshot = await sharedMediaApi.getSnapshot(roomCode).catch(() => null);
        if (snapshot) useSharedPlaybackStore.getState().applySnapshot(roomCode, snapshot);
        toast.error(t("sharedMedia.activePlaybackGeneric", "در این جلسه یک پخش فعال وجود دارد؛ ابتدا پایان پخش برای همه را بزنید."));
      } else {
        toast.error(getApiErrorMessage(error, t("sharedMedia.startFailed", "شروع پخش مشترک ناموفق بود.")));
      }
    } finally {
      setStartingToken(null);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} panelClassName="max-w-2xl max-h-[85vh] overflow-hidden">
      <ModalHeader>
        <div>
          <ModalTitle>{t("sharedMedia.libraryTitle", "سینمای آنلاین")}</ModalTitle>
          <ModalDescription>{t("sharedMedia.libraryDescription", "ویدئو را یک‌بار آپلود کنید و در جلسه‌های بعد ادامه دهید.")}</ModalDescription>
        </div>
        <button type="button" onClick={() => onOpenChange(false)} className="grid size-11 place-items-center rounded-lg text-[var(--t2)] hover:bg-[var(--s3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]" aria-label={t("sharedMedia.close", "بستن")}><X size={20} /></button>
      </ModalHeader>
      <ModalBody className="max-h-[calc(85vh-80px)] overflow-y-auto">
        <input ref={inputRef} type="file" className="sr-only" accept=".mp4,.webm,.mov,.mkv,video/mp4,video/webm,video/quicktime,video/x-matroska" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} />
        <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--brand)] bg-[var(--brand)]/10 px-4 font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/15 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]">
          <Upload size={20} />
          {uploading ? t("sharedMedia.uploading", { progress, defaultValue: "در حال آپلود… {{progress}}٪" }) : t("sharedMedia.chooseVideo", "انتخاب و آپلود ویدئو")}
        </button>
        {uploading && <div className="h-2 overflow-hidden rounded-full bg-[var(--s4)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full bg-[var(--brand)] transition-[width]" style={{ width: `${progress}%` }} /></div>}
        {uploading && uploadNotice && (
          <p className="rounded-lg bg-[var(--s2)] px-3 py-2 text-xs leading-5 text-[var(--t2)]" role="status">
            {uploadNotice}
          </p>
        )}

        {activePlayback && (
          <p className="rounded-lg border border-amber-300/30 bg-amber-950/30 px-3 py-2 text-xs leading-5 text-amber-100" role="status">
            {t("sharedMedia.activePlayback", {
              title: activePlayback.asset.title,
              defaultValue: "«{{title}}» در این جلسه در حال پخش است؛ برای انتخاب ویدئوی دیگر ابتدا پایان پخش برای همه را بزنید.",
            })}
          </p>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("sharedMedia.yourLibrary", "کتابخانه شما")}</h3>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="grid size-11 place-items-center rounded-lg text-[var(--t2)] hover:bg-[var(--s3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]" aria-label={t("sharedMedia.refresh", "به‌روزرسانی")}><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button>
        </div>
        {!loading && assets.length === 0 ? (
          <div className="grid min-h-32 place-items-center rounded-xl border border-[var(--b)] text-center text-sm text-[var(--t3)]"><div><Film className="mx-auto mb-2" /><p>{t("sharedMedia.emptyLibrary", "هنوز ویدئویی در کتابخانه ندارید.")}</p></div></div>
        ) : (
          <div className="space-y-2">
            {assets.map((asset) => {
              const summary = asset.status === "ready" ? "" : renditionSummary(asset, t);
              return (
                <article key={asset.public_token} className="flex items-center gap-3 rounded-xl border border-[var(--b)] bg-[var(--s3)] p-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[var(--brand)]/10 text-[var(--brand)]"><Film size={20} /></div>
                  <div className="min-w-0 flex-1 text-start">
                    <h4 className="truncate text-sm font-semibold">{asset.title}</h4>
                    <p className="mt-1 text-xs text-[var(--t3)]"><span>{t(`sharedMedia.assetState.${asset.status}`, asset.status)}</span><span className="mx-1">·</span><span dir="ltr">{formatBytes(asset.size_bytes)}</span></p>
                    {summary && <p className="mt-1 text-xs text-[var(--t3)]">{summary}</p>}
                    {asset.failure_code && <p className="mt-1 text-xs text-[var(--red)]">{asset.failure_code}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={!asset.can_start_playback || startingToken !== null || (!!activePlayback && activePlayback.asset.public_token !== asset.public_token)} onClick={() => void startPlayback(asset)} className="flex min-h-11 items-center gap-2 rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"><Play size={16} />{t("sharedMedia.start", "شروع")}</button>
                    <button type="button" disabled={deletingToken !== null} onClick={() => void deleteAsset(asset)} className="grid size-11 place-items-center rounded-lg text-[var(--red)] hover:bg-[var(--red)]/10 disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--red)]" aria-label={t("sharedMedia.delete", "حذف ویدئو")}><Trash2 size={18} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
