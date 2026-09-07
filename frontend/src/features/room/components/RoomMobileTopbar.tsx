import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";
import { ArrowLeft, Circle, SwitchCamera, Volume2, VolumeX, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useRoomStore } from "../store/roomStore";
import { useRoomLayoutStore } from "../store/roomLayoutStore";
import { useLobbyHost } from "../hooks/useLobbyHost";
import { LobbyPanel } from "./LobbyPanel";
import MobileAudioOutputSheet from "./MobileAudioOutputSheet";
import BottomSheet from "../../../components/layout/BottomSheet";
import RecordControls from "../../recordings/components/room/RecordControls";
import { useRoomRecording } from "../../recordings/hooks/useRoomRecording";
import { formatRecordingElapsed, useRecordingElapsed } from "../../recordings/hooks/useRecordingElapsed";

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
 const [recordingOpen, setRecordingOpen] = useState(false);
 const recording = useRoomRecording({ roomCode, isHost });
 const recordingState = recording.status.recording;
 const recordingLive = Boolean(recordingState && ["starting", "recording", "paused"].includes(recordingState.status));
 const recordingElapsed = useRecordingElapsed(recordingState);
 const lobby = useLobbyHost({ roomCode: roomCode || "", canModerate: isHost || isCoHost });
 useEffect(() => {
   const open = () => setLobbyOpen(true);
   window.addEventListener("eduspace:open-lobby", open);
   return () => window.removeEventListener("eduspace:open-lobby", open);
 }, []);
 useEffect(() => {
   const open = () => { setAudioOpen(false); setRecordingOpen(true); };
   window.addEventListener("eduspace:open-recording", open);
   return () => window.removeEventListener("eduspace:open-recording", open);
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
   setRecordingOpen(false);
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
     <button style={{ maxWidth: recordingLive ? "30vw" : "52vw" }} className="relative flex h-11 min-w-0 items-center gap-2 rounded-full bg-[var(--s1)] px-3 text-[var(--t1)]" onClick={() => setPanel("people")} aria-label={t("controls.people")}><Users size={21} className="shrink-0"/><span dir="auto" className="truncate text-xs font-semibold">{roomName || t("topbar.defaultRoomName")}</span>{lobby.count > 0 && <span className="absolute -top-1 end-0 rounded-full bg-[var(--red)] text-white px-1 text-[10px]">{lobby.count}</span>}</button>
   </div>
   <div className="flex shrink-0 items-center gap-1.5">
     {recordingLive && <button type="button" className="flex h-9 items-center gap-1 rounded-full bg-[var(--red)]/15 px-2 text-[var(--red)]" onClick={() => { setAudioOpen(false); setRecordingOpen(true); }} aria-label={t("controls.recording")}><Circle size={9} fill="currentColor" className={recordingState?.status === "recording" ? "animate-pulse" : ""}/><span className="force-ltr font-mono text-[11px] font-bold">{formatRecordingElapsed(recordingElapsed)}</span></button>}
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
   <BottomSheet open={recordingOpen} onOpenChange={setRecordingOpen} height={48} title={t("controls.recording")} ariaLabel={t("controls.recording")} panelClassName="font-[inherit] !rounded-t-[2rem]">
     <RecordControls roomCode={roomCode} canControl={recording.canControl} status={recording.status} isMutating={recording.isMutating} onStart={recording.start} onStop={recording.stop} onPause={recording.pause} onResume={recording.resume}/>
   </BottomSheet>
   <LobbyPanel placement="bottom" isOpen={lobbyOpen} onClose={() => setLobbyOpen(false)} requests={lobby.requests} admittingId={lobby.admittingId} denyingId={lobby.denyingId} isBatchAction={lobby.isBatchAction} onAdmit={lobby.admit} onDeny={lobby.deny} onAdmitAll={lobby.admitAll} onDenyAll={lobby.denyAll}/>
 </header>;
}
