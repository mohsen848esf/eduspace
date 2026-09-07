import { useEffect, useState } from "react";
import { useConnectionState, useRoomContext } from "@livekit/components-react";
import { ConnectionQuality, ConnectionState, RoomEvent } from "livekit-client";
import { useTranslation } from "react-i18next";
import { LoaderCircle, WifiOff } from "lucide-react";
export default function ConnectionStatus({ onLeave }: { onLeave: () => void }) {
 const { t } = useTranslation("room");
 const room = useRoomContext();
 const connection = useConnectionState();
 const [ready, setReady] = useState(false);
 const [poor, setPoor] = useState(false);
 useEffect(() => {
   let cancelled = false;
   let checking = false;
   let generation = 0;
   const check = async () => {
     if (checking || room.state !== ConnectionState.Connected) return;
     checking = true;
     const current = generation;
     try {
       await room.localParticipant.publishData(new TextEncoder().encode('{"type":"CONNECTION_PROBE"}'), { reliable: true });
       if (!cancelled && current === generation) setReady(true);
     } catch { if (!cancelled) setReady(false); }
     finally { checking = false; }
   };
   const reset = () => { generation++; setReady(false); };
   const quality = (value: ConnectionQuality, participant: { identity: string }) => {
     if (participant.identity === room.localParticipant.identity) setPoor(value === ConnectionQuality.Poor || value === ConnectionQuality.Lost);
   };
   void check();
   const timer = window.setInterval(() => void check(), 10000);
   room.on(RoomEvent.Connected, check); room.on(RoomEvent.Reconnected, check);
   room.on(RoomEvent.Reconnecting, reset); room.on(RoomEvent.SignalReconnecting, reset);
   room.on(RoomEvent.ConnectionQualityChanged, quality);
   window.addEventListener("offline", reset); window.addEventListener("online", check);
   return () => { cancelled = true; clearInterval(timer); room.off(RoomEvent.Connected, check); room.off(RoomEvent.Reconnected, check); room.off(RoomEvent.Reconnecting, reset); room.off(RoomEvent.SignalReconnecting, reset); room.off(RoomEvent.ConnectionQualityChanged, quality); window.removeEventListener("offline", reset); window.removeEventListener("online", check); };
 }, [room]);
 const connecting = connection !== ConnectionState.Connected || !ready;
 if (!connecting && !poor) return null;
 return connecting ? <div role="status" aria-live="polite" className="absolute inset-0 z-[100] bg-[var(--s0)]/95 flex flex-col items-center justify-center gap-4 p-6 text-center"><LoaderCircle className="animate-spin motion-reduce:animate-none" size={32}/><p>{t(connection === ConnectionState.Reconnecting ? "connection.reconnecting" : "connection.connecting")}</p><p className="text-sm text-[var(--t3)]">{t("connection.wait")}</p><button className="rounded-lg px-4 py-2 bg-[var(--s3)]" onClick={onLeave}>{t("tooltips.leave")}</button></div> : <div role="status" aria-live="polite" className="absolute top-[calc(env(safe-area-inset-top)+4.25rem)] inset-x-3 z-40 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] min-w-0 items-start gap-2 rounded-xl border border-[var(--amber)] bg-[var(--s2)] px-3 py-2 text-sm shadow-xl sm:inset-x-auto sm:start-1/2 sm:max-w-md sm:-translate-x-1/2"><WifiOff size={18} className="mt-0.5 shrink-0"/><span className="min-w-0 break-words leading-5">{t("connection.poor")}</span></div>;
}
