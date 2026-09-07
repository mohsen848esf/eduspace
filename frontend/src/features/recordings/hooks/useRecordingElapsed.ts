import { useEffect, useState } from "react";
import type { Recording } from "../api/recordings.api";

interface ElapsedEntry {
  seconds: number;
  lastTick: number;
  ticking: boolean;
}

const elapsedRegistry = new Map<string, ElapsedEntry>();

export function formatRecordingElapsed(secondsTotal: number): string {
  const seconds = Math.max(0, Math.floor(secondsTotal));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function readElapsed(recording: Recording | null, now = Date.now()): number {
  if (!recording) return 0;
  const key = recording.public_token;
  const ticking = recording.status === "recording";
  let entry = elapsedRegistry.get(key);

  if (!entry) {
    const startedAt = Date.parse(recording.started_at || "");
    const serverElapsed = recording.duration_seconds || 0;
    const wallElapsed = Number.isFinite(startedAt) ? Math.floor((now - startedAt) / 1000) : 0;
    const initial = recording.status === "paused" && serverElapsed > 0
      ? serverElapsed
      : Math.max(serverElapsed, wallElapsed);
    entry = { seconds: Math.max(0, initial), lastTick: now, ticking };
    elapsedRegistry.set(key, entry);
    return entry.seconds;
  }

  if (ticking && entry.ticking) {
    entry.seconds += Math.max(0, (now - entry.lastTick) / 1000);
  } else if ((recording.duration_seconds || 0) > entry.seconds) {
    entry.seconds = recording.duration_seconds;
  }
  entry.lastTick = now;
  entry.ticking = ticking;
  return Math.max(0, Math.floor(entry.seconds));
}

export function useRecordingElapsed(recording: Recording | null): number {
  const [elapsed, setElapsed] = useState(() => readElapsed(recording));

  useEffect(() => {
    const syncTimer = window.setTimeout(() => setElapsed(readElapsed(recording)), 0);
    if (!recording || recording.status !== "recording") {
      return () => window.clearTimeout(syncTimer);
    }
    const timer = window.setInterval(() => setElapsed(readElapsed(recording)), 1000);
    return () => {
      window.clearTimeout(syncTimer);
      window.clearInterval(timer);
    };
  }, [recording]);

  return recording ? elapsed : 0;
}
