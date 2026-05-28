import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";
import toast from "react-hot-toast";

export type SidebarTab = "participants" | "chat" | "tools" | null;

export function useRoomControls(initialCamOn = true, initialMicOn = true) {
  const { t } = useTranslation("room");
  const { localParticipant } = useLocalParticipant();
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("participants");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMicOn, setIsMicOn] = useState(initialMicOn);
  const [isCamOn, setIsCamOn] = useState(initialCamOn);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const room = useRoomContext();

  // PTT state — track if space is held
  const pttActive = useRef(false);
  const micBeforePTT = useRef(false);
  // mute camera immediately if initialCamOn is false
  useEffect(() => {
    if (!localParticipant) return;
    if (!initialCamOn) {
      const camPub = localParticipant.getTrackPublication(Track.Source.Camera);
      if (camPub) {
        camPub.mute();
      } else {
        const handler = () => {
          const pub = localParticipant.getTrackPublication(Track.Source.Camera);
          if (pub) {
            pub.mute();
            localParticipant.off("trackPublished", handler);
          }
        };
        localParticipant.on("trackPublished", handler);
        return () => {
          localParticipant.off("trackPublished", handler);
        };
      }
    }
  }, [localParticipant]);
  const toggleMic = useCallback(async () => {
    if (!localParticipant) return;
    const newState = !isMicOn;
    await localParticipant.setMicrophoneEnabled(newState);
    setIsMicOn(newState);
  }, [localParticipant, isMicOn]);

  const toggleCam = useCallback(async () => {
    if (!localParticipant) return;
    const newState = !isCamOn;
    await localParticipant.setCameraEnabled(newState);
    setIsCamOn(newState);
  }, [localParticipant, isCamOn]);

  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;
    if (!isScreenSharing) {
      await localParticipant.setScreenShareEnabled(true, {
        audio: true,
        selfBrowserSurface: "include",
      });
    } else {
      await localParticipant.setScreenShareEnabled(false);
    }
    setIsScreenSharing((prev) => !prev);
  }, [localParticipant, isScreenSharing]);

  const toggleSidebar = useCallback((tab: SidebarTab) => {
    setSidebarTab((prev) => (prev === tab ? null : tab));
  }, []);

  const toggleSettings = useCallback(() => {
    setSettingsOpen((prev) => !prev);
  }, []);

  const togglePushToTalk = useCallback(() => {
    setIsPushToTalk((prev) => !prev);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.ctrlKey && e.code === "KeyD") {
        e.preventDefault();
        toggleMic();
        return;
      }

      if (e.ctrlKey && e.code === "KeyE") {
        e.preventDefault();
        toggleCam();
        return;
      }

      if (e.code === "Space" && isPushToTalk && !e.repeat) {
        e.preventDefault();
        if (!pttActive.current) {
          pttActive.current = true;
          micBeforePTT.current = isMicOn;
          if (!isMicOn && localParticipant) {
            await localParticipant.setMicrophoneEnabled(true);
            setIsMicOn(true);
          }
        }
        return;
      }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.code === "Space" && isPushToTalk && pttActive.current) {
        e.preventDefault();
        pttActive.current = false;
        if (!micBeforePTT.current && localParticipant) {
          await localParticipant.setMicrophoneEnabled(false);
          setIsMicOn(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [toggleMic, toggleCam, isPushToTalk, isMicOn, localParticipant]);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));

        if (data.type === "MUTE_AUDIO" && localParticipant) {
          localParticipant.setMicrophoneEnabled(false);
          setIsMicOn(false);
          toast(t("host.youWereMuted"), { icon: "🔇" });
        }

        if (data.type === "UNMUTE_AUDIO" && localParticipant) {
          localParticipant.setMicrophoneEnabled(true);
          setIsMicOn(true);
          toast(t("host.hostUnmuted"), { icon: "🎙" });
        }

        if (data.type === "MUTE_VIDEO" && localParticipant) {
          localParticipant.setCameraEnabled(false);
          setIsCamOn(false);
          toast(t("host.hostTurnedOffCamera"), { icon: "📵" });
        }
      } catch {
        /* swallow */
      }
    };

    room.on("dataReceived", handleData);
    return () => {
      room.off("dataReceived", handleData);
    };
  }, [room, localParticipant, t]);
  return {
    isMicOn,
    isCamOn,
    isScreenSharing,
    isPushToTalk,
    sidebarTab,
    settingsOpen,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    toggleSidebar,
    toggleSettings,
    togglePushToTalk,
    setIsCamOn,
  };
}
