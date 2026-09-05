import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";
import { ArrowLeft, SwitchCamera, Volume2, VolumeX, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useRoomStore } from "../store/roomStore";
import { useRoomLayoutStore } from "../store/roomLayoutStore";
import { useLobbyHost } from "../hooks/useLobbyHost";
import { LobbyPanel } from "./LobbyPanel";
import MobileAudioOutputSheet from "./MobileAudioOutputSheet";

export default function RoomMobileTopbar({ onLeave }: { onLeave: () => void }) {
 const { t } = useTranslation("room");
 const room = useRoomContext();
 const { localParticipant } = useLocalParticipant();
 const { roomCode, roomName, isHost, isCoHost } = useRoomStore();
 const setPanel = useRoomLayoutStore((s) => s.setActivePanel);
 const [lobbyOpen, setLobbyOpen] = useState(false);
 const [switching, setSwitching] = useState(false);
 const [audioOpen, setAudioOpen] = useState(false);
 const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
 const [selectedOutput, setSelectedOutput] = useState("");
 const [soundMuted, setSoundMuted] = useState(false);
 const lobby = useLobbyHost({ roomCode: roomCode || "", canModerate: isHost || isCoHost });
 useEffect(() => {
   const open = () => setLobbyOpen(true);
   window.addEventListener("eduspace:open-lobby", open);
   return () => window.removeEventListener("eduspace:open-lobby", open);
 }, []);
 useEffect(() => {
   const root = document.querySelector<HTMLElement>("[data-room-audio-root]");
   if (!root) return;
   const applyMutedState = () => {
     root.querySelectorAll("audio").forEach((audio) => { audio.muted = soundMuted; });
   };
   applyMutedState();
   const observer = new MutationObserver(applyMutedState);
   observer.observe(root, { childList: true, subtree: true });
   return () => {
     observer.disconnect();
     root.querySelectorAll("audio").forEach((audio) => { audio.muted = false; });
   };
 }, [soundMuted]);
 const swapCamera = async () => {
   if (switching) return;
   setSwitching(true);
   try {
     const camera = localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
     if (!camera) { toast(t("mobile.enableCamera")); return; }
     const facing = camera.mediaStreamTrack.getSettings().facingMode;
     await camera.restartTrack({ facingMode: facing === "environment" ? "user" : "environment", deviceId: undefined });
   } catch { toast.error(t("mobile.cameraFailed")); }
   finally { setSwitching(false); }
 };
 const chooseAudio = async () => {
   if (audioOpen) { setAudioOpen(false); return; }
   try {
     await room.startAudio();
     const devices = await navigator.mediaDevices.enumerateDevices();
     setOutputs(devices.filter((d) => d.kind === "audiooutput"));
     setSelectedOutput(room.getActiveDevice("audiooutput") || "default");
     setAudioOpen(true);
   } catch { toast.error(t("mobile.audioFailed")); }
 };
 const selectOutput = async (deviceId: string) => {
   try {
     await room.startAudio();
     if (canRoute) await room.switchActiveDevice("audiooutput", deviceId);
     setSelectedOutput(deviceId);
     setSoundMuted(false);
     setAudioOpen(false);
   } catch { toast.error(t("mobile.audioFailed")); }
 };
 useEffect(() => {
   if (!audioOpen) return;
   const refresh = async () => {
     const devices = await navigator.mediaDevices.enumerateDevices();
     setOutputs(devices.filter((device) => device.kind === "audiooutput"));
   };
   navigator.mediaDevices.addEventListener?.("devicechange", refresh);
   return () => navigator.mediaDevices.removeEventListener?.("devicechange", refresh);
 }, [audioOpen]);
 const canRoute = typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
 const button = "w-11 h-11 shrink-0 rounded-full bg-[var(--s2)] text-[var(--t1)] flex items-center justify-center";
 return <header dir="ltr" className="relative shrink-0 flex items-center justify-between gap-2 px-3 py-3 bg-[var(--s0)]">
   <div className="flex min-w-0 items-center gap-1.5">
     <button className={button} onClick={onLeave} aria-label={t("tooltips.leave")}><ArrowLeft size={22}/></button>
     <button className="relative min-w-0 max-w-[min(52vw,220px)] flex items-center gap-2 rounded-full px-3 h-11 bg-[var(--s1)] text-[var(--t1)]" onClick={() => setPanel("people")} aria-label={t("controls.people")}><Users size={21} className="shrink-0"/><span dir="auto" className="truncate text-xs font-semibold">{roomName || t("topbar.defaultRoomName")}</span>{lobby.count > 0 && <span className="absolute -top-1 end-0 rounded-full bg-[var(--red)] text-white px-1 text-[10px]">{lobby.count}</span>}</button>
   </div>
   <div className="flex shrink-0 items-center gap-1.5">
     <button className={button} onClick={() => void chooseAudio()} aria-label={t("mobile.audioOutput")} aria-expanded={audioOpen}>{soundMuted ? <VolumeX size={22} className="text-[var(--red)]" /> : <Volume2 size={22}/>}</button>
     <button className={button} onClick={() => void swapCamera()} disabled={switching} aria-label={t("mobile.swapCamera")}><SwitchCamera size={22}/></button>
   </div>
   <MobileAudioOutputSheet
     open={audioOpen}
     outputs={outputs}
     selectedDeviceId={selectedOutput}
     muted={soundMuted}
     canRoute={canRoute}
     onOpenChange={setAudioOpen}
     onSelect={(deviceId) => void selectOutput(deviceId)}
     onMute={() => { setSoundMuted(true); setAudioOpen(false); }}
   />
   <LobbyPanel placement="bottom" isOpen={lobbyOpen} onClose={() => setLobbyOpen(false)} requests={lobby.requests} admittingId={lobby.admittingId} denyingId={lobby.denyingId} isBatchAction={lobby.isBatchAction} onAdmit={lobby.admit} onDeny={lobby.deny} onAdmitAll={lobby.admitAll} onDenyAll={lobby.denyAll}/>
 </header>;
}
