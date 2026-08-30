import { useMemo, useState } from "react";
import {
  useLocalParticipant,
  useParticipants,
  useTracks,
  isTrackReference,
} from "@livekit/components-react";
import { Track, type Participant } from "livekit-client";

/**
 * A single visible cell in the call grid. We split a participant who is
 * publishing both their camera and a screen share into two tiles, so
 * everyone else sees them as if they were two distinct participants —
 * the way Google Meet handles screen sharing.
 *
 * The local participant is the only exception: when they're sharing,
 * we don't render a separate "self" camera tile (they don't need to
 * see themselves twice). Their tile shows the shared screen, with a
 * small PiP of their camera in the corner.
 */
export type CallTile = {
  /** Stable React key. `${identity}::${kind}`. */
  key: string;
  kind: "camera" | "screen";
  participant: Participant;
};

export interface UseCallTilesResult {
  /** Tiles in render order. `participants[0]` is always the local user. */
  tiles: CallTile[];
  /** Track refs collected once and shared across all consumers. */
  tracks: ReturnType<typeof useTracks>;
  localIdentity: string;
  /** Currently pinned tile, or null when nothing is pinned. */
  pinnedKey: string | null;
  /**
   * Pin/unpin a tile. Passing the already-pinned key unpins. Passing
   * null unpins outright.
   */
  setPinnedKey: (key: string | null) => void;
}

/**
 * Builds the tile list, indexes track refs for cheap lookup, and runs
 * the auto-pin policy:
 *
 * Auto-pin policy
 * ---------------
 *  * When a new screen-share tile appears, pin it — but only if the
 *    user hasn't already explicitly unpinned a previous share. We
 *    track that with `userOverrodeRef` so subsequent shares don't
 *    keep stealing focus the user just dismissed.
 *  * When the pinned tile disappears (sharer stopped), the pin clears
 *    naturally, and the override resets so the *next* share can
 *    auto-pin again.
 *
 * Anyone can override at any time by calling `setPinnedKey`.
 */
export function useCallTiles(): UseCallTilesResult {
  const { localParticipant } = useLocalParticipant();
  const remote = useParticipants();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: true },
  ]);

  // De-duplicate: useParticipants() already includes the local user on
  // some versions of @livekit/components-react. Filter to be safe.
  const participants = useMemo<Participant[]>(() => {
    const list: Participant[] = [localParticipant];
    const remoteList = remote.filter((p) => p.identity !== localParticipant.identity);

    const getHandRaiseInfo = (p: Participant) => {
      if (!p.metadata) return { raised: false, at: 0 };
      try {
        const meta = JSON.parse(p.metadata);
        return {
          raised: !!meta.handRaised,
          at: typeof meta.handRaisedAt === "number" ? meta.handRaisedAt : 0,
        };
      } catch {
        return { raised: false, at: 0 };
      }
    };

    remoteList.sort((a, b) => {
      const infoA = getHandRaiseInfo(a);
      const infoB = getHandRaiseInfo(b);
      if (infoA.raised && !infoB.raised) return -1;
      if (!infoA.raised && infoB.raised) return 1;
      if (infoA.raised && infoB.raised) {
        return infoA.at - infoB.at;
      }
      return 0;
    });

    list.push(...remoteList);
    return list;
  }, [localParticipant, remote]);

  const tiles = useMemo<CallTile[]>(() => {
    const out: CallTile[] = [];
    for (const p of participants) {
      const screenRef = tracks.find(
        (t) =>
          t.participant.identity === p.identity &&
          t.source === Track.Source.ScreenShare,
      );
      const isSharing =
        screenRef &&
        isTrackReference(screenRef) &&
        !screenRef.publication.isMuted;

      if (isSharing) {
        out.push({
          key: `${p.identity}::camera`,
          kind: "camera",
          participant: p,
        });
        out.push({
          key: `${p.identity}::screen`,
          kind: "screen",
          participant: p,
        });
      } else {
        out.push({
          key: `${p.identity}::camera`,
          kind: "camera",
          participant: p,
        });
      }
    }
    return out;
  }, [participants, tracks]);

  const screens = tiles.filter((tile) => tile.kind === "screen");
  const screenSignature = screens.map((tile) => tile.key).join("|");
  const [pinOverride, setPinOverride] = useState<{
    screenSignature: string;
    key: string | null;
  } | null>(null);
  const hasCurrentOverride = pinOverride?.screenSignature === screenSignature;
  const overriddenKey =
    pinOverride?.key && tiles.some((tile) => tile.key === pinOverride.key)
      ? pinOverride.key
      : null;
  const pinnedKey = hasCurrentOverride ? overriddenKey : screens[0]?.key ?? null;

  const userSetPinnedKey = (key: string | null) => {
    setPinOverride({ screenSignature, key });
  };

  return {
    tiles,
    tracks,
    localIdentity: localParticipant.identity,
    pinnedKey,
    setPinnedKey: userSetPinnedKey,
  };
}
