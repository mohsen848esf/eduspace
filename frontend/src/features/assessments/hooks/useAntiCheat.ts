import { useEffect, useRef } from "react";
import { useRecordTabLoss, useUpdateTelemetry } from "./useSubmissions";

interface UseAntiCheatProps {
  submissionId: number;
  status?: string;
  onTabLoss: (tabLossesCount: number) => void;
}

export function useAntiCheat({ submissionId, status, onTabLoss }: UseAntiCheatProps) {
  const recordTabLossMutation = useRecordTabLoss();
  const updateTelemetryMutation = useUpdateTelemetry();
  const hasLoggedTelemetry = useRef(false);

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
  submissionStatusRef.current = status;

  useEffect(() => {
    if (!isStarted) return;

    const handleFocusLoss = () => {
      if (submissionStatusRef.current !== "started") return;

      recordTabLossMutation.mutate(submissionId, {
        onSuccess: (data) => {
          onTabLoss(data.tab_focus_losses);
        },
      });
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
