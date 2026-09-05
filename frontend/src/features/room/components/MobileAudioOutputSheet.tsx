import {
  Check,
  Headphones,
  Phone,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import BottomSheet from "../../../components/layout/BottomSheet";
import { cn } from "../../../lib/utils";

interface MobileAudioOutputSheetProps {
  open: boolean;
  outputs: MediaDeviceInfo[];
  selectedDeviceId: string;
  muted: boolean;
  canRoute: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (deviceId: string) => void;
  onMute: () => void;
}

function getOutputKind(label: string): "headphones" | "phone" | "speaker" {
  const normalized = label.toLowerCase();
  if (/head|buds|airpods|bluetooth|هندزفری|هدفون/.test(normalized)) return "headphones";
  if (/earpiece|receiver|phone|گوشی/.test(normalized)) return "phone";
  return "speaker";
}

function getOutputLabel(
  device: MediaDeviceInfo,
  index: number,
  translate: (key: string, options?: Record<string, unknown>) => string,
) {
  if (device.label.trim()) return device.label;
  return index === 0
    ? translate("mobile.speaker")
    : translate("mobile.outputDevice", { index: index + 1 });
}

export default function MobileAudioOutputSheet({
  open,
  outputs,
  selectedDeviceId,
  muted,
  canRoute,
  onOpenChange,
  onSelect,
  onMute,
}: MobileAudioOutputSheetProps) {
  const { t } = useTranslation("room");
  const visibleOutputs = outputs.length > 0
    ? outputs
    : [{ deviceId: "default", label: "", kind: "audiooutput", groupId: "", toJSON: () => ({}) } as MediaDeviceInfo];

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      height={Math.min(64, 29 + visibleOutputs.length * 8)}
      ariaLabel={t("mobile.audioOutput")}
      panelClassName="!rounded-t-[2rem] bg-[color-mix(in_srgb,var(--s2)_98%,transparent)]"
    >
      <div dir="auto" className="flex flex-col px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {visibleOutputs.map((device, index) => {
          const label = getOutputLabel(device, index, t);
          const kind = getOutputKind(label);
          const selected = !muted && (
            selectedDeviceId === device.deviceId ||
            (!selectedDeviceId && (device.deviceId === "default" || index === 0))
          );
          const Icon = kind === "headphones" ? Headphones : kind === "phone" ? Phone : Volume2;
          return (
            <button
              key={device.deviceId || `${label}-${index}`}
              type="button"
              disabled={!canRoute && index > 0}
              className={cn(
                "flex min-h-16 w-full items-center gap-4 rounded-2xl px-3 text-start transition-colors",
                "hover:bg-[var(--s3)] active:bg-[var(--s4)] disabled:opacity-45",
              )}
              onClick={() => onSelect(device.deviceId)}
            >
              <Icon size={24} className="shrink-0 text-[var(--t1)]" />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{label}</span>
              {selected && <Check size={25} aria-label={t("mobile.selectedOutput")} className="shrink-0 text-[var(--brand)]" />}
            </button>
          );
        })}

        <button type="button" className="flex min-h-16 w-full items-center gap-4 rounded-2xl px-3 text-start transition-colors hover:bg-[var(--s3)] active:bg-[var(--s4)]" onClick={onMute}>
          <VolumeX size={24} className="shrink-0" />
          <span className="flex-1 text-[15px] font-medium">{t("mobile.turnOffSound")}</span>
          {muted && <Check size={25} aria-label={t("mobile.selectedOutput")} className="shrink-0 text-[var(--brand)]" />}
        </button>

        <button type="button" className="mt-1 flex min-h-16 w-full items-center gap-4 rounded-2xl px-3 text-start transition-colors hover:bg-[var(--s3)] active:bg-[var(--s4)]" onClick={() => onOpenChange(false)}>
          <X size={25} className="shrink-0" />
          <span className="text-[15px] font-medium">{t("mobile.cancel")}</span>
        </button>
      </div>
    </BottomSheet>
  );
}
