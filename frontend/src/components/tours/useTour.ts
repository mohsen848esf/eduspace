import { useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useLocale } from "../../i18n/useLocale";
import { toursList } from "./tourConfigs";
import { useAuthStore } from "../../features/auth/store/authStore";

export function useTour() {
  const { isRTL } = useLocale();
  const { user } = useAuthStore();

  const startTour = useCallback(
    (pathname: string, force = false) => {
      const config = toursList[pathname];
      if (!config) return;

      const userId = user?.id ?? "guest";
      const tourKey = `tour_completed_${userId}_${config.id}_v${config.version}`;
      const isCompleted = localStorage.getItem(tourKey);

      // Skip auto-run if already completed and not force-triggered
      if (isCompleted && !force) return;

      const steps = config.steps(isRTL);
      if (steps.length === 0) return;

      const driverObj = driver({
        showProgress: true,
        steps: steps,
        nextBtnText: isRTL ? "بعدی" : "Next ➔",
        prevBtnText: isRTL ? "قبلی" : "🠴 Prev",
        doneBtnText: isRTL ? "پایان" : "Done ✓",
        showButtons: ["next", "previous"],
        allowClose: true,
        overlayColor: "rgba(15, 15, 23, 0.75)",
        popoverClass: "eduspace-tour-popover",
        onPopoverRender: (popover) => {
          const footer = popover.footer;
          if (footer && !footer.querySelector(".eduspace-tour-skip-btn")) {
            const skipBtn = document.createElement("button");
            skipBtn.className = "driver-popover-btn eduspace-tour-skip-btn";
            skipBtn.innerText = isRTL ? "رد کردن" : "Skip ✕";
            skipBtn.style.order = "-1";
            skipBtn.addEventListener("click", () => {
              driverObj.destroy();
            });
            footer.appendChild(skipBtn);
          }
        },
        onDestroyed: () => {
          localStorage.setItem(tourKey, "true");
        },
      });

      driverObj.drive();
    },
    [isRTL, user],
  );

  return { startTour };
}
