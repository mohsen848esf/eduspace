import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import Spinner from "../../../components/ui/Spinner";
import { Tooltip } from "../../../components/ui/Tooltip";
import { Icons } from "../../../lib/constants/icons";
import recordingsApi, { type Recording } from "../api/recordings.api";
import RecordingPlayer from "./RecordingPlayer";
import { useAccessGuard } from "../hooks/useAccessGuard";

function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

/**
 * Plain watch page for a recording someone else shared with the user.
 * Owners are bounced to the editor route since that's where they spend
 * their time on a recording.
 *
 * Polls detail() periodically: if the host unpublishes / removes the
 * viewer / soft-deletes the recording, we tear the player down and
 * route back to /recordings so the viewer can't keep watching the Blob.
 */
export default function RecordingViewPage() {
  const { t } = useTranslation("recordings");
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setIsLoading(true);
    recordingsApi
      .detail(token)
      .then((data) => {
        if (cancelled) return;
        if (data.is_owner) {
          navigate(`/recordings/${data.public_token}/edit`, { replace: true });
          return;
        }
        setRecording(data);
      })
      .catch(() => {
        toast.error(t("editor.notReady"));
        navigate("/recordings");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate, t]);

  // While the player is up, periodically re-check that the viewer still
  // has access. If the host unpublishes mid-watch, we kick them out.
  const { revoked } = useAccessGuard({
    enabled: !!recording && !recording.is_owner,
    token: recording?.public_token ?? null,
  });

  useEffect(() => {
    if (!revoked) return;
    toast(t("watch.accessRevoked"), { icon: "🔒" });
    navigate("/recordings", { replace: true });
  }, [revoked, navigate, t]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--s0)]">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!recording || revoked) return null;

  return (
    <div className="min-h-screen bg-[var(--s0)] text-[var(--t1)]">
      <header className="h-14 flex items-center justify-between px-5 bg-[var(--s1)] border-b border-[var(--b)]">
        <div className="flex items-center gap-3">
          <Tooltip content={t("editor.back")}>
            <button
              onClick={() => navigate("/recordings")}
              className="w-9 h-9 rounded-lg bg-transparent border-none cursor-pointer text-[var(--t2)] hover:bg-[var(--s3)] hover:text-[var(--t1)] flex items-center justify-center"
            >
              <span className="rtl-flip">{Icons.leave}</span>
            </button>
          </Tooltip>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {recording.room_name ||
                recording.room_code ||
                recording.public_token}
            </div>
            <div className="text-[11px] text-[var(--t3)]">
              {recording.owner_full_name
                ? t("card.by", { name: recording.owner_full_name })
                : new Date(recording.started_at).toLocaleString()}
            </div>
          </div>
        </div>

        <span className="text-[11px] font-mono text-[var(--t2)] force-ltr">
          {formatTimecode(recording.duration_seconds)}
        </span>
      </header>

      <main className="max-w-5xl mx-auto p-5">
        <RecordingPlayer
          token={recording.public_token}
          autoPlay
          trackProgress
          startSeconds={
            recording.last_position_seconds && recording.last_position_seconds > 1
              ? recording.last_position_seconds
              : undefined
          }
        />
      </main>
    </div>
  );
}
