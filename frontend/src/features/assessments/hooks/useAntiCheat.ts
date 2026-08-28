import { useEffect, useRef } from "react";
import { useRecordTabLoss, useUpdateTelemetry } from "./useSubmissions";

interface UseAntiCheatProps {
  submissionId: number;
  status?: string;
  antiCheatToken?: string;
  onTabLoss: (tabLossesCount: number) => void;
}

export function useAntiCheat({ submissionId, status, antiCheatToken, onTabLoss }: UseAntiCheatProps) {
  const recordTabLossMutation = useRecordTabLoss();
  const updateTelemetryMutation = useUpdateTelemetry();
  const hasLoggedTelemetry = useRef(false);

  const activeTokenRef = useRef<string | undefined>(antiCheatToken);

  useEffect(() => {
    if (antiCheatToken) {
      activeTokenRef.current = antiCheatToken;
    }
  }, [antiCheatToken]);

  // 1. Telemetry Log on mount
  useEffect(() => {
    if (status === "started" && !hasLoggedTelemetry.current) {
      hasLoggedTelemetry.current = true;
      updateTelemetryMutation.mutate({
        id: submissionId,
        data: {
          browser_info: navigator.userAgent,
        },
      });
    }
  }, [status, submissionId, updateTelemetryMutation]);

  // 2. Focus loss tracking
  const isStarted = status === "started";
  const submissionStatusRef = useRef<string | undefined>(status);

  useEffect(() => {
    submissionStatusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!isStarted) return;

    const handleFocusLoss = () => {
      if (submissionStatusRef.current !== "started") return;
      if (!activeTokenRef.current) {
        console.warn("No active anti-cheat token to verify tab focus loss.");
        return;
      }

      recordTabLossMutation.mutate(
        { id: submissionId, antiCheatToken: activeTokenRef.current },
        {
          onSuccess: (data) => {
            activeTokenRef.current = data.anti_cheat_token;
            onTabLoss(data.tab_focus_losses);
          },
        }
      );
    };

    window.addEventListener("blur", handleFocusLoss);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleFocusLoss();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleFocusLoss);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isStarted, submissionId, onTabLoss, recordTabLossMutation]);
}
