import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/utils";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isPushToTalk: boolean;
  onTogglePushToTalk: () => void;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-8 h-[18px] rounded-full relative transition-colors duration-200 border-none cursor-pointer flex-shrink-0",
        on ? "bg-[var(--brand)]" : "bg-[var(--s4)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full transition-transform duration-200 block",
          on ? "translate-x-[14px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export default function SettingsPanel({
  isOpen,
  onClose,
  isPushToTalk,
  onTogglePushToTalk,
}: SettingsPanelProps) {
  const { t } = useTranslation("room");
  if (!isOpen) return null;

  const shortcuts = [
    {
      label: t("settings.shortcutMicLabel"),
      sub: t("settings.shortcutMicSub"),
      key: "Ctrl+D",
    },
    {
      label: t("settings.shortcutCamLabel"),
      sub: t("settings.shortcutCamSub"),
      key: "Ctrl+E",
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-[76px] left-1/2 -translate-x-1/2 z-50 w-60 bg-[var(--s2)] border border-[var(--b)] rounded-xl shadow-2xl p-3 fade-in">
        <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-2 px-1">
          {t("settings.title")}
        </div>

        {/* Push to Talk */}
        <div className="flex items-center justify-between py-2 px-1 mb-1">
          <div>
            <div className="text-xs font-medium text-[var(--t1)]">
              {t("settings.pushToTalk")}
            </div>
            <div className="text-[10px] text-[var(--t3)]">
              {isPushToTalk
                ? t("settings.pttHold")
                : t("settings.pttDisabled")}
            </div>
          </div>
          <Toggle on={isPushToTalk} onClick={onTogglePushToTalk} />
        </div>

        <div className="h-px bg-[var(--b)] my-1" />

        {/* Keyboard shortcuts */}
        <div className="text-[10px] font-semibold text-[var(--t3)] uppercase tracking-wider mb-1 px-1 mt-2">
          {t("settings.shortcuts")}
        </div>
        {shortcuts.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between py-1.5 px-1"
          >
            <div>
              <div className="text-xs font-medium text-[var(--t1)]">
                {item.label}
              </div>
              <div className="text-[10px] text-[var(--t3)]">{item.sub}</div>
            </div>
            <span className="text-[10px] font-semibold font-mono bg-[var(--s3)] text-[var(--t2)] px-2 py-0.5 rounded-md">
              {item.key}
            </span>
          </div>
        ))}

        <div className="h-px bg-[var(--b)] my-1" />

        {/* Toggles */}
        {[
          { label: t("settings.noiseCancellation"), defaultOn: true },
          { label: t("settings.hdVideo"), defaultOn: false },
        ].map((item) => (
          <ToggleRow
            key={item.label}
            label={item.label}
            defaultOn={item.defaultOn}
          />
        ))}
      </div>
    </>
  );
}

function ToggleRow({
  label,
  defaultOn,
}: {
  label: string;
  defaultOn: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-1.5 px-1">
      <span className="text-xs font-medium text-[var(--t1)]">{label}</span>
      <Toggle on={on} onClick={() => setOn(!on)} />
    </div>
  );
}
