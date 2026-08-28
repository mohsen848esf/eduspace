import { useState, useEffect } from "react";

interface UseExamTimerProps {
  startedAt?: string;
  durationMinutes?: number;
  status?: string;
  onTimeout: () => void;
}

export function useExamTimer({ startedAt, durationMinutes, status, onTimeout }: UseExamTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt || !durationMinutes || status !== "started") {
      return;
    }

    const startedTime = new Date(startedAt).getTime();
    const durationMs = durationMinutes * 60 * 1000;
    const endTime = startedTime + durationMs;

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = Math.floor((endTime - now) / 1000);

      if (difference <= 0) {
        setTimeLeft(0);
        onTimeout();
      } else {
        setTimeLeft(difference);
      }
    };

    const initialTimer = window.setTimeout(updateTimer, 0);
    const interval = setInterval(updateTimer, 1000);

    return () => {
      window.clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [startedAt, durationMinutes, status, onTimeout]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    timeLeft:
      startedAt && durationMinutes && status === "started" ? timeLeft : null,
    formatTime,
  };
}
