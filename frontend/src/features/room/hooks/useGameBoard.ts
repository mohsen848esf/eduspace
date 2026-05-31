import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  useRoomContext,
  useLocalParticipant,
  useParticipants,
} from "@livekit/components-react";
import { useRoomStore } from "../store/roomStore";
import toast from "react-hot-toast";

export interface GameBoardState {
  isActive: boolean;
  gameId: string | null;
  gameUrl: string | null;
  gameTitle: string | null;
  hostIdentity: string | null;
  acceptedParticipants: string[];
  /**
   * Live game scores keyed by participant identity. Populated from
   * SCORE_UPDATE messages that the local iframe broadcasts and from
   * GAME_SCORE data-channel messages relayed by remote participants.
   */
  scores: Record<string, number>;
}

const GAME_MESSAGES = {
  GAME_INVITE: "GAME_INVITE",
  GAME_ACCEPT: "GAME_ACCEPT",
  GAME_DECLINE: "GAME_DECLINE",
  GAME_START: "GAME_START",
  GAME_END: "GAME_END",
  GAME_SCORE: "GAME_SCORE",
} as const;

export function useGameBoard() {
  const { t } = useTranslation("games");
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  // remote participants are read by callers; the hook itself doesn't need them
  useParticipants();
  const { isHost } = useRoomStore();

  const [gameBoard, setGameBoard] = useState<GameBoardState>({
    isActive: false,
    gameId: null,
    gameUrl: null,
    gameTitle: null,
    hostIdentity: null,
    acceptedParticipants: [],
    scores: {},
  });

  const [pendingInvite, setPendingInvite] = useState<{
    gameId: string;
    gameTitle: string;
    gameUrl: string;
    from: string;
  } | null>(null);

  const sendMessage = useCallback(
    async (type: string, payload: any, destinations?: string[]) => {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({ type, payload }));
      await room.localParticipant.publishData(data, {
        reliable: true,
        destinationIdentities: destinations,
      });
    },
    [room],
  );

  // Host launches game
  const launchGame = useCallback(
    async (gameId: string, gameTitle: string, gameUrl: string) => {
      if (!isHost) return;

      await sendMessage(GAME_MESSAGES.GAME_INVITE, {
        gameId,
        gameTitle,
        gameUrl,
        from: localParticipant.name || localParticipant.identity,
      });

      setGameBoard({
        isActive: true,
        gameId,
        gameUrl,
        gameTitle,
        hostIdentity: localParticipant.identity,
        acceptedParticipants: [localParticipant.identity],
        scores: {},
      });

      toast.success(t("board.launched", { title: gameTitle }));
    },
    [isHost, localParticipant, sendMessage, t],
  );

  const acceptGame = useCallback(async () => {
    if (!pendingInvite) return;

    await sendMessage(GAME_MESSAGES.GAME_ACCEPT, {
      identity: localParticipant.identity,
      name: localParticipant.name || localParticipant.identity,
    });

    setGameBoard((prev) => ({
      ...prev,
      isActive: true,
      gameId: pendingInvite.gameId,
      gameUrl: pendingInvite.gameUrl,
      gameTitle: pendingInvite.gameTitle,
      hostIdentity: pendingInvite.from,
    }));

    setPendingInvite(null);
  }, [pendingInvite, localParticipant, sendMessage]);

  const declineGame = useCallback(() => {
    setPendingInvite(null);
  }, []);

  const endGame = useCallback(async () => {
    if (!isHost) return;
    await sendMessage(GAME_MESSAGES.GAME_END, {});
    setGameBoard({
      isActive: false,
      gameId: null,
      gameUrl: null,
      gameTitle: null,
      hostIdentity: null,
      acceptedParticipants: [],
      scores: {},
    });
    toast(t("board.ended"), { icon: "🎮" });
  }, [isHost, sendMessage, t]);

  /**
   * Broadcast the local player's score over the data channel so every
   * peer's GameBoard can render the live roster. Called from
   * GameBoard whenever the iframe emits SCORE_UPDATE for the local
   * user.
   */
  const relayScore = useCallback(
    async (score: number) => {
      // Update local state immediately so the host's UI reacts even
      // before the data channel round-trip completes.
      setGameBoard((prev) => ({
        ...prev,
        scores: { ...prev.scores, [localParticipant.identity]: score },
      }));
      await sendMessage(GAME_MESSAGES.GAME_SCORE, {
        identity: localParticipant.identity,
        score,
      });
    },
    [localParticipant.identity, sendMessage],
  );

  const handleDataMessage = useCallback(
    (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const { type, payload: data } = JSON.parse(decoder.decode(payload));

        switch (type) {
          case GAME_MESSAGES.GAME_INVITE:
            setPendingInvite({
              gameId: data.gameId,
              gameTitle: data.gameTitle,
              gameUrl: data.gameUrl,
              from: participant?.identity || data.from,
            });
            break;

          case GAME_MESSAGES.GAME_ACCEPT:
            setGameBoard((prev) => ({
              ...prev,
              acceptedParticipants: [
                ...prev.acceptedParticipants,
                data.identity,
              ],
            }));
            break;

          case GAME_MESSAGES.GAME_END:
            setGameBoard({
              isActive: false,
              gameId: null,
              gameUrl: null,
              gameTitle: null,
              hostIdentity: null,
              acceptedParticipants: [],
              scores: {},
            });
            setPendingInvite(null);
            toast(t("board.endedByHost"), { icon: "🎮" });
            break;

          case GAME_MESSAGES.GAME_SCORE: {
            // Trust the wire participant identity (LiveKit sets it
            // server-side); fall back to the payload for clients that
            // can't read the participant context.
            const id =
              (participant && participant.identity) || data.identity;
            if (!id) break;
            const score = Number(data.score ?? 0);
            setGameBoard((prev) => ({
              ...prev,
              scores: { ...prev.scores, [id]: score },
            }));
            break;
          }
        }
      } catch {
        /* swallow malformed */
      }
    },
    [t],
  );

  return {
    gameBoard,
    pendingInvite,
    launchGame,
    acceptGame,
    declineGame,
    endGame,
    relayScore,
    handleDataMessage,
  };
}
