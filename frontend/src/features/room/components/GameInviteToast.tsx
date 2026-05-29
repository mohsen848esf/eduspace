import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

interface GameInviteToastProps {
  invite: {
    gameId: string;
    gameTitle: string;
    gameUrl: string;
    from: string;
  } | null;
  onAccept: () => Promise<unknown> | void;
  onDecline: () => void;
}

/**
 * Renders a sticky react-hot-toast when a host launches a game and the
 * local participant hasn't acted on the invite yet.
 *
 * The toast is dismissed automatically when the parent clears the
 * pending invite (accept/decline triggers that). The component owns its
 * `toastId` so re-renders don't spawn duplicate toasts.
 */
export default function GameInviteToast({
  invite,
  onAccept,
  onDecline,
}: GameInviteToastProps) {
  const { t } = useTranslation("games");
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!invite) {
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      return;
    }

    const id = toast(
      (instance) => (
        <div className="flex flex-col gap-2 min-w-[220px]">
          <p className="text-sm font-semibold">
            {t("invite.title", { from: invite.from })}
          </p>
          <p className="text-xs opacity-70">
            {t("invite.subtitle", { title: invite.gameTitle })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                toast.dismiss(instance.id);
                await onAccept();
              }}
              className="flex-1 bg-indigo-600 text-white text-xs font-semibold py-1.5 rounded-lg"
            >
              {t("invite.join")}
            </button>
            <button
              onClick={() => {
                toast.dismiss(instance.id);
                onDecline();
              }}
              className="px-3 text-xs opacity-60 hover:opacity-100"
            >
              {t("invite.decline")}
            </button>
          </div>
        </div>
      ),
      {
        // Sticky until the user picks one. We dismiss in the cleanup or
        // when the parent clears the invite.
        duration: Infinity,
        style: {
          background: "#1e1e2a",
          color: "#f0f0f8",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: "12px",
          padding: "12px",
        },
      },
    );
    toastIdRef.current = id;

    return () => {
      toast.dismiss(id);
      toastIdRef.current = null;
    };
  }, [invite, onAccept, onDecline, t]);

  return null;
}
