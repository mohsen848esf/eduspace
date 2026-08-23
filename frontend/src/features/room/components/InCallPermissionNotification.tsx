import React from "react";
import { cn } from "../../../lib/utils";

export interface PermissionRequest {
  id: string;
  identity: string;
  displayName: string;
  permission: "screen_share" | "microphone" | "camera" | "presentation_upload";
  timestamp: number;
}

interface InCallPermissionNotificationProps {
  requests: PermissionRequest[];
  onApprove: (request: PermissionRequest) => void;
  onDeny: (request: PermissionRequest) => void;
}

export const InCallPermissionNotification: React.FC<InCallPermissionNotificationProps> = ({
  requests,
  onApprove,
  onDeny,
}) => {
  if (requests.length === 0) return null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-[90vw] sm:max-w-md w-full pointer-events-auto animate-in slide-in-from-top-4 duration-200 select-none">
      {requests.map((req) => {
        let label = "درخواست دسترسی";
        let icon = "✋";
        if (req.permission === "screen_share") {
          label = "درخواست اشتراک صفحه";
          icon = "🖥️";
        } else if (req.permission === "microphone") {
          label = "درخواست باز کردن میکروفون";
          icon = "🎙️";
        } else if (req.permission === "camera") {
          label = "درخواست باز کردن دوربین";
          icon = "📷";
        } else if (req.permission === "presentation_upload") {
          label = "درخواست آپلود و ارائه فایل";
          icon = "📄";
        }

        return (
          <div
            key={req.id}
            className={cn(
              "flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl",
              "bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 text-white shadow-2xl",
              "shadow-amber-500/10 transition-all",
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-lg flex-shrink-0">{icon}</span>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">
                  {req.displayName}
                </span>
                <span className="text-[11px] text-amber-300/90 font-medium truncate">
                  {label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => onApprove(req)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg border-none cursor-pointer transition-all active:scale-95 shadow-md shadow-emerald-900/30"
              >
                تایید
              </button>
              <button
                type="button"
                onClick={() => onDeny(req)}
                className="px-2.5 py-1 bg-white/10 hover:bg-rose-500/20 text-gray-300 hover:text-rose-300 text-xs font-semibold rounded-lg border-none cursor-pointer transition-all active:scale-95"
              >
                رد
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InCallPermissionNotification;
