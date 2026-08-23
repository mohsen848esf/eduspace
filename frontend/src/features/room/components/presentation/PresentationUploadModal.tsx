import React, { useState, useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useRoomStore } from "../../store/roomStore";
import { roomApi } from "../../api/room.api";
import type { PresentationDocument } from "../../schemas/room.schema";
import toast from "react-hot-toast";

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
    presentationsList,
    setPresentationsList,
    setActivePresentation,
  } = useRoomStore();

  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canModerate = isHost || isCoHost;
  const isAllowedToUpload = canModerate || !lockDocumentPresentation || canUploadPresentation;

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
      const newDoc = await roomApi.uploadPresentation(roomCode, formData);
      setPresentationsList([newDoc, ...presentationsList]);
      setSelectedFile(null);
      setDocTitle("");
      toast.success("فایل با موفقیت بارگذاری شد.");
    } catch (err: any) {
      console.error("Upload failed", err);
      toast.error(err?.response?.data?.error || "خطا در بارگذاری فایل.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartPresenting = async (doc: PresentationDocument) => {
    if (!roomCode) return;
    try {
      const activeDoc = await roomApi.setActivePresentation(roomCode, doc.id, true);
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
        className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-6 text-white shadow-2xl space-y-5 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📑</span>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                اشتراک و ارائه فایل و اسلاید
              </h3>
              <p className="text-[11px] text-slate-400">
                بارگذاری اسناد PDF، تصاویر و اسلایدها برای نمایش به همه اعضای جلسه
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Lock Warning for Regular Members */}
        {!isAllowedToUpload ? (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3 text-center">
            <div className="flex items-center justify-center gap-2 text-amber-300 font-bold text-xs">
              <span>🔒</span>
              <span>امکان بارگذاری و ارائه فایل توسط برگزارکننده قفل است</span>
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              برای ارائه اسلاید یا فایل در این جلسه، باید ابتدا از برگزارکننده یا همیاران جلسه اجازه بگیرید.
            </p>
            {onRequestPermission && (
              <button
                type="button"
                onClick={() => {
                  onRequestPermission();
                  onClose();
                }}
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-amber-900/30 cursor-pointer active:scale-95"
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
              className="border-2 border-dashed border-white/20 hover:border-indigo-400/60 bg-white/5 hover:bg-white/10 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.svg,.ppt,.pptx"
                className="hidden"
                onChange={handleFileSelect}
              />
              <span className="text-3xl">📤</span>
              <span className="text-xs font-bold text-indigo-300">
                {selectedFile ? selectedFile.name : "انتخاب فایل PDF، تصویر یا اسلاید"}
              </span>
              <span className="text-[10px] text-slate-400">
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
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleUpload}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-900/40"
                >
                  {isUploading ? "در حال بارگذاری..." : "بارگذاری فایل"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Existing Uploaded Presentations List */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-300 block">
            فایل‌های آماده ارائه در این اتاق:
          </span>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {presentationsList.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-4 bg-white/5 rounded-2xl border border-white/5">
                هنوز فایلی در این جلسه بارگذاری نشده است.
              </p>
            ) : (
              presentationsList.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg">
                      {doc.file_type === "pdf" ? "📄" : doc.file_type === "image" ? "🖼️" : "📊"}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-white truncate">
                        {doc.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {doc.uploader_name}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartPresenting(doc)}
                    className="flex-shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-950/40 active:scale-95"
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
