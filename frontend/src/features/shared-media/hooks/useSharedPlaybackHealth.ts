import { useCallback, useEffect, useRef, useState } from "react";
import { RoomEvent, type RemoteParticipant, type Room } from "livekit-client";
import { decodePlaybackHealth, encodePlaybackHealth } from "../lib/realtime";
import {
  PLAYBACK_HEALTH_INTERVAL_MS,
  PLAYBACK_HEALTH_STALE_MS,
  type PlaybackHealthEntry,
} from "../lib/playbackHealth";
import type { SharedPlaybackHealth } from "../schemas/shared-media.schema";

interface Options {
  room: Room;
  roomCode: string;
  playbackId?: number;
  canModerate: boolean;
  moderatorIdentities: string[];
  createSample: () => SharedPlaybackHealth;
}

export function useSharedPlaybackHealth({
  room,
  roomCode,
  playbackId,
  canModerate,
  moderatorIdentities,
  createSample,
}: Options): PlaybackHealthEntry[] {
  const sampleFactoryRef = useRef(createSample);
  const moderatorIdentitiesRef = useRef(moderatorIdentities);
  const [entries, setEntries] = useState<Record<string, PlaybackHealthEntry>>({});

  useEffect(() => {
    sampleFactoryRef.current = createSample;
    moderatorIdentitiesRef.current = moderatorIdentities;
  }, [createSample, moderatorIdentities]);

  const applyEntry = useCallback((
    message: SharedPlaybackHealth,
    identity: string,
    displayName: string,
  ) => {
    if (!playbackId || message.room_code !== roomCode || message.playback_id !== playbackId) return;
    const receivedAt = Date.now();
    setEntries((current) => {
      const existing = current[identity];
      if (existing && existing.emitted_at > message.emitted_at) return current;
      return {
        ...current,
        [identity]: { ...message, identity, displayName, receivedAt },
      };
    });
  }, [playbackId, roomCode]);

  useEffect(() => {
    if (!playbackId) return;
    let disposed = false;
    const local = room.localParticipant;

    const report = () => {
      if (disposed) return;
      const sample = sampleFactoryRef.current();
      if (canModerate) {
        applyEntry(sample, local.identity, local.name || local.identity);
      }
      const destinations = moderatorIdentitiesRef.current.filter(
        (identity, index, all) => identity !== local.identity && all.indexOf(identity) === index,
      );
      if (destinations.length === 0) return;
      void local.publishData(encodePlaybackHealth(sample), {
        reliable: false,
        destinationIdentities: destinations,
      }).catch(() => undefined);
    };

    const onData = (payload: Uint8Array, participant?: RemoteParticipant) => {
      if (!canModerate || !participant) return;
      const message = decodePlaybackHealth(payload);
      if (!message) return;
      applyEntry(message, participant.identity, participant.name || participant.identity);
    };
    const prune = () => {
      if (!canModerate) return;
      const cutoff = Date.now() - PLAYBACK_HEALTH_STALE_MS;
      setEntries((current) => {
        const next = Object.fromEntries(
          Object.entries(current).filter(([, entry]) => entry.receivedAt >= cutoff),
        );
        return Object.keys(next).length === Object.keys(current).length ? current : next;
      });
    };
    const onDisconnected = (participant: RemoteParticipant) => {
      setEntries((current) => {
        if (!current[participant.identity]) return current;
        const next = { ...current };
        delete next[participant.identity];
        return next;
      });
    };

    report();
    const reportTimer = window.setInterval(report, PLAYBACK_HEALTH_INTERVAL_MS);
    const pruneTimer = window.setInterval(prune, PLAYBACK_HEALTH_INTERVAL_MS);
    room.on(RoomEvent.DataReceived, onData);
    room.on(RoomEvent.Reconnected, report);
    room.on(RoomEvent.ParticipantDisconnected, onDisconnected);
    return () => {
      disposed = true;
      window.clearInterval(reportTimer);
      window.clearInterval(pruneTimer);
      room.off(RoomEvent.DataReceived, onData);
      room.off(RoomEvent.Reconnected, report);
      room.off(RoomEvent.ParticipantDisconnected, onDisconnected);
      setEntries({});
    };
  }, [applyEntry, canModerate, playbackId, room]);

  return Object.values(entries).sort((left, right) => left.displayName.localeCompare(right.displayName));
}
