import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { ParticipantEvent, Track, type Participant } from "livekit-client";
import toast from "react-hot-toast";
import client from "../../../lib/api/client";
import { useRoomStore } from "../store/roomStore";
import { createAudioContext } from "@/lib/browser/audioContext";
import { isModeratorIdentity } from "../lib/roomPermissions";

/** Minimum milliseconds between two permission requests of the same type */
const PERMISSION_REQUEST_COOLDOWN_MS = 15_000;

function playChime() {
  try {
    const audioCtx = createAudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
    gain2.gain.setValueAtTime(0, audioCtx.currentTime);
    gain2.gain.setValueAtTime(0.3, audioCtx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.25);
    osc2.start(audioCtx.currentTime + 0.1);
    osc2.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    console.error(e);
  }
}

export type SidebarTab = "participants" | "chat" | "tools" | null;

export function useRoomControls(initialCamOn = true, initialMicOn = true) {
  const { t } = useTranslation("room");
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMicOn = isMicrophoneEnabled ?? initialMicOn;
  const isCamOn = isCameraEnabled ?? initialCamOn;
  const isScreenSharing = isScreenShareEnabled;
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const room = useRoomContext();
  const { roomCode } = useRoomStore();
  const [handRaised, setHandRaised] = useState(false);

  // Synchronize handRaised with local participant metadata
  useEffect(() => {
    if (!localParticipant) return;
    const updateHandState = () => {
      if (localParticipant.metadata) {
        try {
          const meta = JSON.parse(localParticipant.metadata);
          setHandRaised(!!meta.handRaised);
        } catch {
          setHandRaised(false);
        }
      } else {
        setHandRaised(false);
      }
    };

    updateHandState();
    localParticipant.on(ParticipantEvent.ParticipantMetadataChanged, updateHandState);
    return () => {
      localParticipant.off(ParticipantEvent.ParticipantMetadataChanged, updateHandState);
    };
  }, [localParticipant]);

  const toggleHandRaise = useCallback(async () => {
    if (!roomCode) return;
    const nextState = !handRaised;
    setHandRaised(nextState);
    try {
      await client.post(`/rooms/${roomCode}/raise-hand/`, {
        raised: nextState,
      });
    } catch {
      setHandRaised(handRaised);
      toast.error(t("handRaise.failed"));
    }
  }, [roomCode, handRaised, t]);

  // Listen to remote participant metadata changes (Raise Hand notification)
  useEffect(() => {
    if (!room || !localParticipant) return;

    const handleParticipantMetadataChanged = (
      metadata: string | undefined,
      participant: Participant,
    ) => {
      if (participant.identity === localParticipant.identity) return;
      if (!metadata) return;
      try {
        const meta = JSON.parse(metadata);
        if (meta.handRaised) {
          playChime();
          const name = participant.name || participant.identity;
          toast(t("handRaise.toastRaised", { name }), { icon: "✋" });
        }
      } catch {
        // ignore
      }
    };

    room.on("participantMetadataChanged", handleParticipantMetadataChanged);
    return () => {
      room.off("participantMetadataChanged", handleParticipantMetadataChanged);
    };
  }, [room, localParticipant, t]);

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
  }, [localParticipant, initialCamOn]);

  const isHost = useRoomStore((s) => s.isHost);
  const isCoHost = useRoomStore((s) => s.isCoHost);
  const canUseMicrophone = useRoomStore((s) => s.canUseMicrophone);
  const canUseCamera = useRoomStore((s) => s.canUseCamera);
  const canShareScreen = useRoomStore((s) => s.canShareScreen);
  const canModerate = isHost || isCoHost;

  // Cooldown tracking per permission type to prevent spam requests
  const lastPermissionRequestRef = useRef<Record<string, number>>({
    microphone: 0,
    camera: 0,
    screen_share: 0,
  });

  const toggleMic = useCallback(async () => {
    if (!localParticipant) return;
    const newState = !isMicOn;

    // KEY FIX: isBlocked now ONLY checks canUseMicrophone.
    // When lockMicrophone=true and host hasn't granted individual permission → canUseMicrophone=false → blocked.
    // When lockMicrophone=true but host granted individual permission → canUseMicrophone=true → NOT blocked.
    const isBlocked = !canModerate && !canUseMicrophone;
    if (newState && isBlocked) {
      // Cooldown: only send a new request if the previous one was > 15s ago
      const now = Date.now();
      const lastRequest = lastPermissionRequestRef.current.microphone;
      if (now - lastRequest < PERMISSION_REQUEST_COOLDOWN_MS) {
        toast("درخواست میکروفون قبلاً ارسال شد. لطفاً منتظر پاسخ برگزارکننده باشید.", { icon: "⏳" });
        return;
      }
      lastPermissionRequestRef.current.microphone = now;

      toast("میکروفون توسط برگزارکننده قفل است. درخواست مجوز ارسال شد.", { icon: "🔒" });
      const encoder = new TextEncoder();
      const data = encoder.encode(
        JSON.stringify({
          type: "PERMISSION_REQUEST",
          id: `${localParticipant.identity}-microphone-${now}`,
          identity: localParticipant.identity,
          displayName: localParticipant.name || localParticipant.identity,
          permission: "microphone",
          timestamp: now,
        }),
      );
      await room.localParticipant.publishData(data, { reliable: true });
      return;
    }

    await localParticipant.setMicrophoneEnabled(newState);
  }, [localParticipant, isMicOn, canModerate, canUseMicrophone, room]);

  const toggleCam = useCallback(async () => {
    if (!localParticipant) return;
    const newState = !isCamOn;

    // KEY FIX: same as toggleMic — only check canUseCamera
    const isBlocked = !canModerate && !canUseCamera;
    if (newState && isBlocked) {
      const now = Date.now();
      const lastRequest = lastPermissionRequestRef.current.camera;
      if (now - lastRequest < PERMISSION_REQUEST_COOLDOWN_MS) {
        toast("درخواست دوربین قبلاً ارسال شد. لطفاً منتظر پاسخ برگزارکننده باشید.", { icon: "⏳" });
        return;
      }
      lastPermissionRequestRef.current.camera = now;

      toast("دوربین توسط برگزارکننده قفل است. درخواست مجوز ارسال شد.", { icon: "🔒" });
      const encoder = new TextEncoder();
      const data = encoder.encode(
        JSON.stringify({
          type: "PERMISSION_REQUEST",
          id: `${localParticipant.identity}-camera-${now}`,
          identity: localParticipant.identity,
          displayName: localParticipant.name || localParticipant.identity,
          permission: "camera",
          timestamp: now,
        }),
      );
      await room.localParticipant.publishData(data, { reliable: true });
      return;
    }

    await localParticipant.setCameraEnabled(newState);
  }, [localParticipant, isCamOn, canModerate, canUseCamera, room]);

  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;

    if (!isScreenSharing) {
      // KEY FIX: only check canShareScreen (not lockScreenShare)
      const isBlocked = !canModerate && !canShareScreen;
      if (isBlocked) {
        const now = Date.now();
        const lastRequest = lastPermissionRequestRef.current.screen_share;
        if (now - lastRequest < PERMISSION_REQUEST_COOLDOWN_MS) {
          toast("درخواست اشتراک صفحه قبلاً ارسال شد. لطفاً منتظر پاسخ برگزارکننده باشید.", { icon: "⏳" });
          return;
        }
        lastPermissionRequestRef.current.screen_share = now;

        toast("اشتراک صفحه توسط برگزارکننده قفل است. درخواست مجوز ارسال شد.", { icon: "🔒" });
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "PERMISSION_REQUEST",
            id: `${localParticipant.identity}-screen_share-${now}`,
            identity: localParticipant.identity,
            displayName: localParticipant.name || localParticipant.identity,
            permission: "screen_share",
            timestamp: now,
          }),
        );
        await room.localParticipant.publishData(data, { reliable: true });
        return;
      }

      await localParticipant.setScreenShareEnabled(true, {
        audio: true,
        selfBrowserSurface: "include",
      });
    } else {
      await localParticipant.setScreenShareEnabled(false);
    }
  }, [localParticipant, isScreenSharing, canModerate, canShareScreen, room]);

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
    const handleData = (payload: Uint8Array, sender?: Participant) => {
      try {
        if (!isModeratorIdentity(sender?.identity)) return;
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));

        if (data.type === "MUTE_AUDIO" && localParticipant) {
          localParticipant.setMicrophoneEnabled(false);
          toast(t("host.youWereMuted"), { icon: "🔇" });
        }

        if (data.type === "UNMUTE_AUDIO" && localParticipant) {
          localParticipant.setMicrophoneEnabled(true);
          toast(t("host.hostUnmuted"), { icon: "🎙" });
        }

        if (data.type === "MUTE_VIDEO" && localParticipant) {
          localParticipant.setCameraEnabled(false);
          toast(t("host.hostTurnedOffCamera"), { icon: "📵" });
        }

        // Settings and roles are reconciled from REST by useRoomPermissionSync.
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
    handRaised,
    toggleHandRaise,
  };
}
