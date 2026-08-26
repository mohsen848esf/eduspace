import React, { useState, useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useRoomStore } from "../../store/roomStore";
import { roomApi } from "../../api/room.api";
import type { PresentationDocument } from "../../schemas/room.schema";
import toast from "react-hot-toast";
import axios from "axios";

interface PresentationUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestPermission?: () => void;
}

export const PresentationUploadModal: React.FC<PresentationUploadModalProps> = ({
  isOpen,
  onClose,
  onRequestPermission,
}) => {
  const room = useRoomContext();
  const {
    roomCode,
    isHost,
    isCoHost,
    lockDocumentPresentation,
    canUploadPresentation,
    isGuest,
    guestAccessToken,
    presentationsList,
    setPresentationsList,
    setActivePresentation,
  } = useRoomStore();

  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canModerate = isHost || isCoHost;
  const hasMutationCredential = !isGuest || Boolean(guestAccessToken);
  const isAllowedToUpload =
    hasMutationCredential &&
    (canModerate || !lockDocumentPresentation || canUploadPresentation);

  // Load existing room presentations
  useEffect(() => {
    if (!isOpen || !roomCode) return;
    roomApi
      .listPresentations(roomCode)
      .then((res) => {
        setPresentationsList(res.presentations || []);
      })
      .catch((err) => {
        console.error("Failed to load presentations", err);
      });
  }, [isOpen, roomCode, setPresentationsList]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!docTitle) {
        setDocTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !roomCode || !isAllowedToUpload) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("title", docTitle.trim() || selectedFile.name);

    try {
      const newDoc = await roomApi.uploadPresentation(
        roomCode,
        formData,
        guestAccessToken,
      );
      setPresentationsList([newDoc, ...presentationsList]);
      setSelectedFile(null);
      setDocTitle("");
      toast.success("فایل با موفقیت بارگذاری شد.");
    } catch (err: unknown) {
      console.error("Upload failed", err);
      const message = axios.isAxiosError<{ error?: string }>(err)
        ? err.response?.data?.error
        : undefined;
      toast.error(message || "خطا در بارگذاری فایل.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartPresenting = async (doc: PresentationDocument) => {
    if (!roomCode) return;
    try {
      const activeDoc = await roomApi.setActivePresentation(
        roomCode,
        doc.id,
        true,
        guestAccessToken,
      );
      const castDoc = activeDoc as PresentationDocument;
      setActivePresentation(castDoc);

      // Broadcast to room
      if (room?.localParticipant) {
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "PRESENTATION_START",
            document: castDoc,
          }),
        );
        await room.localParticipant.publishData(data, { reliable: true });
      }

      toast.success(`ارائه ${doc.title} روی استیج آغاز شد.`);
      onClose();
    } catch (err) {
      console.error("Failed to start presentation", err);
      toast.error("خطا در شروع ارائه.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-[var(--s2)] border border-[var(--b)] rounded-3xl p-6 text-[var(--t1)] shadow-2xl space-y-5 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--b)] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📑</span>
            <div>
              <h3 className="text-sm font-bold text-[var(--t1)]">
                اشتراک و ارائه فایل و اسلاید
              </h3>
              <p className="text-[11px] text-[var(--t3)]">
                بارگذاری اسناد PDF، تصاویر و اسلایدها برای نمایش به همه اعضای جلسه
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-[var(--t3)] hover:text-[var(--t1)] hover:bg-[var(--s3)] transition-colors cursor-pointer border-none bg-transparent"
          >
            ✕
          </button>
        </div>

        {/* Lock Warning for Regular Members */}
        {!isAllowedToUpload ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-300 font-bold text-xs">
              <span>🔒</span>
              <span>امکان بارگذاری و ارائه فایل توسط برگزارکننده قفل است</span>
            </div>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-200/80 leading-relaxed">
              برای ارائه اسلاید یا فایل در این جلسه، باید ابتدا از برگزارکننده یا همیاران جلسه اجازه بگیرید.
            </p>
            {onRequestPermission && (
              <button
                type="button"
                onClick={() => {
                  onRequestPermission();
                  onClose();
                }}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-900/30 cursor-pointer active:scale-95 border-none"
              >
                ارسال درخواست اجازه ارائه به میزبان
              </button>
            )}
          </div>
        ) : (
          /* Upload Dropzone */
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--b)] hover:border-[var(--brand)] bg-[var(--s1)] hover:bg-[var(--s3)] rounded-2xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.ppt,.pptx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <span className="text-3xl">📤</span>
              <span className="text-xs font-bold text-[var(--brand)]">
                {selectedFile ? selectedFile.name : "انتخاب فایل PDF، تصویر یا اسلاید"}
              </span>
              <span className="text-[10px] text-[var(--t3)]">
                فرمت‌های مجاز: PDF, PNG, JPG, WebP, PPTX (حداکثر ۵۰ مگابایت)
              </span>
            </div>

            {selectedFile && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="عنوان ارائه..."
                  className="flex-1 bg-[var(--s1)] border border-[var(--b)] rounded-xl px-3 py-2 text-xs text-[var(--t1)] placeholder-[var(--t3)] focus:outline-none focus:border-[var(--brand)]"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleUpload}
                  className="px-4 py-2 bg-[var(--brand)] hover:bg-[var(--brand-h)] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-[var(--brand)]/30 border-none"
                >
                  {isUploading ? "در حال بارگذاری..." : "بارگذاری فایل"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Existing Uploaded Presentations List */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-[var(--t2)] block">
            فایل‌های آماده ارائه در این اتاق:
          </span>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-none">
            {presentationsList.length === 0 ? (
              <p className="text-[11px] text-[var(--t3)] text-center py-4 bg-[var(--s1)] rounded-2xl border border-[var(--b)]">
                هنوز فایلی در این جلسه بارگذاری نشده است.
              </p>
            ) : (
              presentationsList.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-[var(--s1)] hover:bg-[var(--s3)] rounded-2xl border border-[var(--b)] transition-all gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg">
                      {doc.file_type === "pdf" ? "📄" : doc.file_type === "image" ? "🖼️" : "📊"}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-[var(--t1)] truncate">
                        {doc.title}
                      </span>
                      <span className="text-[10px] text-[var(--t3)]">
                        {doc.uploader_name}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartPresenting(doc)}
                    className="flex-shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 border-none"
                  >
                    شروع ارائه
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresentationUploadModal;
