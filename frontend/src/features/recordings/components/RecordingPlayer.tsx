import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Spinner from "../../../components/ui/Spinner";
import recordingsApi from "../api/recordings.api";

interface RecordingPlayerProps {
  token: string;
  // Hint to seek the player to this time on the next load (used by trim preview).
  startSeconds?: number;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
}

/**
 * Plays a recording's stream URL while sending the user's JWT.
 *
 * The native <video src=...> tag can't attach an Authorization header,
 * so we fetch the response as a Blob and hand the resulting object URL
 * to the player. This trades HTTP Range seeking for working playback;
 * for early prod with recordings well under ~100MB this is acceptable.
 *
 * The blob URL is revoked when the component unmounts or the token
 * changes so we don't leak large objects.
 */
export default function RecordingPlayer({
  token,
  startSeconds,
  className,
  controls = true,
  autoPlay = false,
}: RecordingPlayerProps) {
  const { t } = useTranslation("recordings");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setBlobUrl(null);

    const fetchVideo = async () => {
      try {
        const accessToken = localStorage.getItem("access_token");
        if (!accessToken) throw new Error("not authenticated");
        const res = await fetch(recordingsApi.streamUrl(token), {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error(`stream ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message || "load failed");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchVideo();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Revoke previous blob URL when it changes / component unmounts.
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Apply requested seek when the video has buffered enough data.
  useEffect(() => {
    if (!videoRef.current || !blobUrl || startSeconds == null) return;
    const v = videoRef.current;
    const apply = () => {
      try {
        v.currentTime = startSeconds;
      } catch {
        // Some browsers throw if the duration isn't known yet; the
        // 'loadedmetadata' listener below covers that case.
      }
    };
    if (v.readyState >= 1) apply();
    else v.addEventListener("loadedmetadata", apply, { once: true });
  }, [blobUrl, startSeconds]);

  if (isLoading) {
    return (
      <div className="w-full aspect-video bg-[var(--s2)] rounded-xl flex flex-col items-center justify-center gap-3">
        <Spinner size="md" />
        <span className="text-xs text-[var(--t3)]">{t("editor.loading")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full aspect-video bg-[var(--s2)] rounded-xl flex flex-col items-center justify-center gap-2 text-[var(--t3)]">
        <span className="text-2xl">⚠️</span>
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={blobUrl ?? undefined}
      className={className ?? "w-full aspect-video bg-black rounded-xl"}
      controls={controls}
      autoPlay={autoPlay}
      playsInline
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
