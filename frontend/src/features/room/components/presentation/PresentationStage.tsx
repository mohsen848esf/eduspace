import React, { useState, useEffect, useCallback } from "react";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { useRoomStore } from "../../store/roomStore";
import { roomApi } from "../../api/room.api";
import { Tooltip } from "../../../../components/ui/Tooltip";
import { cn } from "../../../../lib/utils";
import toast from "react-hot-toast";
import { Minus, Maximize2, Minimize2, ExternalLink } from "lucide-react";

export const PresentationStage: React.FC = () => {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const {
    roomCode,
    activePresentation,
    setActivePresentation,
    setIsPresentationMinimized,
    setPresentationCurrentPage,
    isHost,
    isCoHost,
  } = useRoomStore();

  const [zoom, setZoom] = useState<number>(100);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const stageContainerRef = React.useRef<HTMLDivElement>(null);

  const canModerate = isHost || isCoHost;
  const isPresenter =
    canModerate ||
    (activePresentation?.uploader_name &&
      (localParticipant?.name === activePresentation.uploader_name ||
        localParticipant?.identity === activePresentation.uploader_name));

  // Sync page updates over LiveKit data channel
  const handlePageChange = useCallback(
    async (newPage: number) => {
      if (!activePresentation || !roomCode) return;
      const targetPage = Math.max(1, Math.min(activePresentation.total_pages, newPage));
      if (targetPage === activePresentation.current_page) return;

      setPresentationCurrentPage(targetPage);

      try {
        await roomApi.setPresentationPage(roomCode, activePresentation.id, targetPage);

        // Broadcast page change to all participants
        if (room?.localParticipant) {
          const encoder = new TextEncoder();
          const data = encoder.encode(
            JSON.stringify({
              type: "PRESENTATION_PAGE_CHANGE",
              docId: activePresentation.id,
              currentPage: targetPage,
            }),
          );
          await room.localParticipant.publishData(data, { reliable: true });
        }
      } catch (err) {
        console.error("Failed to sync presentation page", err);
      }
    },
    [activePresentation, roomCode, room, setPresentationCurrentPage],
  );

  // Minimize presentation
  const handleMinimize = useCallback(() => {
    setIsPresentationMinimized(true);
    toast("ارائه فایل کوچک شد. از منوی ابزارها می‌توانید آن را مجدداً باز کنید.", {
      icon: "🗕",
    });
  }, [setIsPresentationMinimized]);

  // Stop presentation
  const handleStopPresentation = useCallback(async () => {
    if (!roomCode || !activePresentation) return;
    try {
      await roomApi.setActivePresentation(roomCode, activePresentation.id, false);
      setActivePresentation(null);

      // Broadcast presentation stopped
      if (room?.localParticipant) {
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "PRESENTATION_STOP",
            docId: activePresentation.id,
          }),
        );
        await room.localParticipant.publishData(data, { reliable: true });
      }
      toast("ارائه فایل به پایان رسید.", { icon: "ℹ️" });
    } catch (err) {
      console.error("Failed to stop presentation", err);
    }
  }, [roomCode, activePresentation, room, setActivePresentation]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!stageContainerRef.current) return;
    if (!document.fullscreenElement) {
      stageContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  // Keyboard navigation for presenter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPresenter || !activePresentation) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        handlePageChange(activePresentation.current_page + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        handlePageChange(activePresentation.current_page - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPresenter, activePresentation, handlePageChange]);

  if (!activePresentation) return null;

  const isPdf = activePresentation.file_type === "pdf";
  const isImage = activePresentation.file_type === "image";

  return (
    <div
      ref={stageContainerRef}
      className={cn(
        "relative flex flex-col flex-1 w-full h-full bg-slate-950/95 overflow-hidden select-none",
        isFullscreen && "fixed inset-0 z-50",
      )}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-900/90 backdrop-blur-md border-b border-white/10 text-white z-20 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0">
            {isPdf ? "📄" : isImage ? "🖼️" : "📊"}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold truncate text-slate-100">
              {activePresentation.title}
            </span>
            <span className="text-[10px] text-slate-400 truncate">
              ارائه‌دهنده: {activePresentation.uploader_name}
            </span>
          </div>
        </div>

        {/* Zoom & Screen Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Zoom controls */}
          <div className="flex items-center bg-white/5 rounded-xl border border-white/10 px-1 py-0.5 text-xs">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 20))}
              className="px-2 py-1 hover:text-indigo-400 cursor-pointer font-bold border-none bg-transparent text-white"
              title="بزرگنمایی کمتر"
            >
              -
            </button>
            <span className="px-1 text-[11px] text-gray-300 font-mono">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 20))}
              className="px-2 py-1 hover:text-indigo-400 cursor-pointer font-bold border-none bg-transparent text-white"
              title="بزرگنمایی بیشتر"
            >
              +
            </button>
          </div>

          {/* Open in new tab link */}
          <Tooltip content="مشاهده فایل در برگه جدید">
            <a
              href={activePresentation.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors flex items-center justify-center text-xs"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </Tooltip>

          {/* Fullscreen Button */}
          <Tooltip content={isFullscreen ? "خروج از تمام صفحه" : "تمام صفحه"}>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 cursor-pointer transition-colors flex items-center justify-center"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </Tooltip>

          {/* Minimize Button */}
          <Tooltip content="کوچک‌نمایی و بستن از روی صفحه (ارائه برای دیگران فعال می‌ماند)">
            <button
              type="button"
              onClick={handleMinimize}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 cursor-pointer transition-colors flex items-center justify-center"
            >
              <Minus className="w-4 h-4" />
            </button>
          </Tooltip>

          {/* Stop Presentation (Presenter or Moderator only) */}
          {(isPresenter || canModerate) && (
            <button
              type="button"
              onClick={handleStopPresentation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-md shadow-rose-950/40 border-none"
            >
              <span>بستن ارائه</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Presentation Viewport */}
      <div className="relative flex-1 flex items-center justify-center overflow-auto p-2 sm:p-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        {isPdf ? (
          <div
            className="flex items-center justify-center transition-transform duration-150 ease-out w-full h-full"
            style={{ transform: `scale(${zoom / 100})` }}
          >
            <iframe
              src={`${activePresentation.file_url}#page=${activePresentation.current_page}&toolbar=0&navpanes=0`}
              title={activePresentation.title}
              className="w-full max-w-[1200px] h-[78vh] rounded-2xl shadow-2xl border border-white/10 bg-white"
            />
          </div>
        ) : (
          <div
            className="flex items-center justify-center transition-transform duration-150 ease-out max-w-full max-h-full"
            style={{ transform: `scale(${zoom / 100})` }}
          >
            <img
              src={activePresentation.file_url}
              alt={activePresentation.title}
              className="max-w-[90vw] max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
          </div>
        )}
      </div>

      {/* Bottom Presenter Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-900/90 backdrop-blur-md border-t border-white/10 text-white z-20">
        {/* Page / Slide indicator */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-300 font-medium">
            صفحه {activePresentation.current_page} از {activePresentation.total_pages}
          </span>
        </div>

        {/* Navigation Buttons (Enabled for presenter / moderators) */}
        {isPresenter ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={activePresentation.current_page <= 1}
              onClick={() => handlePageChange(activePresentation.current_page - 1)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <span>صفحه قبل</span>
            </button>

            <button
              type="button"
              disabled={activePresentation.current_page >= activePresentation.total_pages}
              onClick={() => handlePageChange(activePresentation.current_page + 1)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:pointer-events-none text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-indigo-900/40 active:scale-95"
            >
              <span>صفحه بعد</span>
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">
            در حال همگام‌سازی خودکار اسلایدها با ارائه‌دهنده...
          </span>
        )}
      </div>
    </div>
  );
};

export default PresentationStage;
