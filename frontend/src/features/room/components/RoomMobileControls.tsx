import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoreVertical, Smile, UserPlus, Info, LogOut, Circle, Shield, LayoutGrid } from "lucide-react";
import { Icons } from "../../../lib/constants/icons";
import { useRoomLayoutStore, type LayoutMode } from "../store/roomLayoutStore";
import { useRoomWhiteboard } from "../hooks/useRoomWhiteboard";
import { useRoomStore } from "../store/roomStore";
import ReactionsPopover from "./reactions/ReactionsPopover";
import InviteModal from "./InviteModal";
import RecordControls from "../../recordings/components/room/RecordControls";
import { useRoomRecording } from "../../recordings/hooks/useRoomRecording";
import ChatUnreadBadge from "./ChatUnreadBadge";
type PanelId = "people" | "chat" | "tools";
interface Props {
 isMicOn: boolean; isCamOn: boolean; isScreenSharing: boolean; layout?: LayoutMode; settingsOpen: boolean;
 activePanel: PanelId | null; onPanelClick: (panel: PanelId) => void; onToggleMic: () => void; onToggleCam: () => void;
 onToggleScreenShare: () => void; onLayoutChange?: (l: LayoutMode) => void; onToggleSettings: () => void; onLeave: () => void;
 handRaised: boolean; onToggleHandRaise?: () => void; onSendReaction?: (emoji: string) => void;
}
export default function RoomMobileControls(p: Props) {
 const { t } = useTranslation("room");
 const [invite, setInvite] = useState(false);
 const [recordMenu, setRecordMenu] = useState(false);
 const [info, setInfo] = useState(false);
 const [more, setMore] = useState(false);
 const [reactions, setReactions] = useState(false);
 const ref = useRef<HTMLDivElement>(null);
 const state = useRoomStore();
 const recording = useRoomRecording({ roomCode: state.roomCode, isHost: state.isHost });
 const board = useRoomWhiteboard();
 const adjust = useRoomLayoutStore((s) => s.setAdjustViewOpen);
 useEffect(() => {
   const close = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setMore(false); };
   const key = (event: KeyboardEvent) => { if (event.key === "Escape") setMore(false); };
   document.addEventListener("pointerdown", close); document.addEventListener("keydown", key);
   return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", key); };
 }, []);
 const actions = [
   ...(recording.canControl ? [{ label: t("controls.start"), icon: <Circle size={21} className="text-[var(--red)]"/>, run: () => setRecordMenu(true) }] : []),
   { label: t("controls.chat"), icon: <span className="relative">{Icons.chat}<ChatUnreadBadge /></span>, run: () => p.onPanelClick("chat") },
   { label: t("controls.people"), icon: Icons.people, run: () => p.onPanelClick("people") },
   { label: t("controls.tools"), icon: Icons.tools, run: () => p.onPanelClick("tools") },
   { label: t("controls.reactions"), icon: <Smile size={20}/>, run: () => setReactions((v) => !v) },
   { label: t("mobile.invite"), icon: <UserPlus size={21}/>, run: () => setInvite(true) },
   ...(state.isHost || state.isCoHost || !state.lockScreenShare || state.canShareScreen || p.isScreenSharing ? [{ label: t("tooltips.screenShare"), icon: Icons.screenShare, run: p.onToggleScreenShare }] : []),
   { label: t("controls.settings"), icon: Icons.settings, run: p.onToggleSettings },
   { label: t("layout.adjustView"), icon: <LayoutGrid size={21}/>, run: () => adjust(true) },
   ...(state.isHost || state.isCoHost ? [{ label: t("lobby.hostPanelTitle"), icon: <Shield size={21}/>, run: () => window.dispatchEvent(new Event("eduspace:open-lobby")) }] : []),
   { label: t("topbar.info"), icon: <Info size={21}/>, run: () => setInfo(true) },
   { label: t("tooltips.leave"), icon: <LogOut size={21} className="text-[var(--red)]"/>, run: p.onLeave },
 ];
 const button = "relative w-12 h-12 shrink-0 rounded-full flex items-center justify-center border border-[var(--b)] bg-[var(--s3)] text-[var(--t1)]";
 return <div ref={ref} className="relative z-50 shrink-0 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] bg-[var(--s0)]">
   {board.whiteboard.isActive && board.whiteboard.isMinimized && <button className="mb-2 text-sm text-[var(--brand)]" onClick={board.restoreWhiteboard}>{t("whiteboard.viewActiveBoard")}</button>}
   <ReactionsPopover isOpen={reactions} onClose={() => setReactions(false)} onSelectEmoji={(emoji) => p.onSendReaction?.(emoji)} />
   {more && <div role="menu" className="absolute bottom-full mb-2 inset-x-3 max-h-[min(70dvh,640px)] overflow-y-auto rounded-[2rem] border border-[var(--b)] bg-[color-mix(in_srgb,var(--s2)_96%,transparent)] backdrop-blur-2xl p-4 shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom-2"><div className="w-12 h-1 rounded-full bg-[var(--t3)]/40 mx-auto mb-3" />{actions.map((action) => <button key={action.label} role="menuitem" className="flex items-center gap-3 w-full min-h-14 px-2 border-b border-[var(--b)] last:border-0 text-start hover:bg-[var(--s3)]" onClick={() => { setMore(false); action.run(); }}><span className="w-10 h-10 rounded-full bg-[var(--s0)]/50 flex items-center justify-center shrink-0">{action.icon}</span><span className="text-sm">{action.label}</span></button>)}</div>}
   {invite && <InviteModal onClose={() => setInvite(false)} />}
   {(recordMenu || info) && <><div className="fixed inset-0 z-40" onClick={() => { setRecordMenu(false); setInfo(false); }}/><div role="dialog" className="absolute bottom-full mb-3 inset-x-3 rounded-3xl border border-[var(--b)] bg-[var(--s2)] p-5 z-50">
     <button className="absolute top-2 end-3 w-9 h-9" aria-label={t("mobile.close")} onClick={() => { setRecordMenu(false); setInfo(false); }}>×</button>
     {recordMenu ? <RecordControls placement="top" roomCode={state.roomCode} canControl={recording.canControl} status={recording.status} isMutating={recording.isMutating} onStart={recording.start} onStop={recording.stop} onPause={recording.pause} onResume={recording.resume} /> : <div className="space-y-3"><p>{state.roomName}</p><p dir="ltr">{state.roomCode}</p><button onClick={() => void navigator.clipboard.writeText(window.location.href)}>{t("topbar.copy")}</button></div>}
   </div></>}
   <div dir="ltr" className="flex w-fit max-w-full items-center justify-center gap-1.5 mx-auto rounded-[2rem] border border-[var(--b)] bg-[var(--s1)]/80 p-2">
    <button className={button} aria-label={t(p.isCamOn ? "tooltips.cameraOn" : "tooltips.cameraOff")} onClick={p.onToggleCam}>{p.isCamOn ? Icons.camera : Icons.cameraOff}</button>
    <button className={button} aria-label={t(p.isMicOn ? "tooltips.muteOn" : "tooltips.muteOff")} onClick={p.onToggleMic}>{p.isMicOn ? Icons.mic : Icons.micOff}</button>
    <button className={button} aria-label={t(p.handRaised ? "controls.lowerHand" : "controls.raiseHand")} aria-pressed={p.handRaised} onClick={p.onToggleHandRaise}>{p.handRaised ? Icons.handFilled : Icons.hand}</button>
    <button className={button} aria-label={t("controls.more")} aria-expanded={more} onClick={() => setMore((v) => !v)}><MoreVertical size={22}/><ChatUnreadBadge /></button>
    <button className={button + " !bg-[var(--red)] !text-white"} aria-label={t("tooltips.leave")} onClick={p.onLeave}>{Icons.leave}</button>
   </div>
 </div>;
}
