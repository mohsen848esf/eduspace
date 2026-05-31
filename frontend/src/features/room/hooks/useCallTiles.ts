import { useEffect, useMemo, useRef, useState } from "react";
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
    for (const p of remote) {
      if (p.identity !== localParticipant.identity) list.push(p);
    }
    return list;
  }, [localParticipant, remote]);

  const tiles = useMemo<CallTile[]>(() => {
    const out: CallTile[] = [];
    for (const p of participants) {
      const isLocal = p.identity === localParticipant.identity;
      const screenRef = tracks.find(
        (t) =>
          t.participant.identity === p.identity &&
          t.source === Track.Source.ScreenShare,
      );
      const isSharing =
        screenRef &&
        isTrackReference(screenRef) &&
        !screenRef.publication.isMuted;

      // For the local sharer we render only the screen tile (with their
      // own camera as a corner PiP) so they don't see themselves twice.
      // Remote sharers get split into two tiles so everyone else can
      // place / pin them independently.
      if (isSharing && isLocal) {
        out.push({
          key: `${p.identity}::screen`,
          kind: "screen",
          participant: p,
        });
      } else if (isSharing && !isLocal) {
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
  }, [participants, tracks, localParticipant.identity]);

  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const userOverrodeRef = useRef(false);

  // Auto-pin the first screen tile that shows up, unless the user has
  // explicitly unpinned. The override flag resets whenever no screen
  // tile is present at all so future shares can re-trigger auto-pin.
  useEffect(() => {
    const screens = tiles.filter((t) => t.kind === "screen");

    if (screens.length === 0) {
      // No share present. Clear any stale pin and reset the override
      // so the next share can auto-pin.
      if (pinnedKey !== null) setPinnedKey(null);
      userOverrodeRef.current = false;
      return;
    }

    // If the currently pinned tile is gone (e.g. tile re-keyed because
    // the participant rejoined), refresh to the newest screen.
    const pinnedExists =
      pinnedKey !== null && tiles.some((t) => t.key === pinnedKey);

    if (!pinnedExists && !userOverrodeRef.current) {
      setPinnedKey(screens[0].key);
    }
  }, [tiles, pinnedKey]);

  // Wrap the setter so the auto-pin policy can tell user-driven changes
  // apart from its own writes.
  const userSetPinnedKey = (key: string | null) => {
    userOverrodeRef.current = true;
    setPinnedKey(key);
  };

  return {
    tiles,
    tracks,
    localIdentity: localParticipant.identity,
    pinnedKey,
    setPinnedKey: userSetPinnedKey,
  };
}
