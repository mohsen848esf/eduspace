import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import { useRoomStore } from "../store/roomStore";
import toast from "react-hot-toast";

/**
 * Persistent hook that runs at the room shell level to ensure
 * all participants immediately receive presentation broadcast events
 * (start, page change, stop) over LiveKit data channel, and auto-open
 * the presentation stage for everyone in the call.
 */
export function usePresentationSync() {
  const room = useRoomContext();
  const {
    setActivePresentation,
    setIsPresentationMinimized,
    setPresentationCurrentPage,
  } = useRoomStore();

  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));

        if (data.type === "PRESENTATION_START") {
          if (data.document) {
            setActivePresentation(data.document);
            setIsPresentationMinimized(false);
            toast.success(
              `ارائه «${data.document.title}» توسط ${data.document.uploader_name || "ارائه‌دهنده"} آغاز شد.`,
              { icon: "📑", id: `presentation-${data.document.id}` }
            );
          }
        } else if (data.type === "PRESENTATION_PAGE_CHANGE") {
          if (data.currentPage) {
            setPresentationCurrentPage(data.currentPage);
          }
        } else if (data.type === "PRESENTATION_STOP") {
          setActivePresentation(null);
          setIsPresentationMinimized(false);
          toast("ارائه فایل به پایان رسید.", { icon: "ℹ️", id: "presentation-ended" });
        }
      } catch {
        /* ignore invalid data packets */
      }
    };

    room.on("dataReceived", handleData);
    return () => {
      room.off("dataReceived", handleData);
    };
  }, [
    room,
    setActivePresentation,
    setIsPresentationMinimized,
    setPresentationCurrentPage,
  ]);
}
