import { useState } from "react";
import AppShell from "../../../components/layout/AppShell";
import PlatformMetricsView from "./PlatformMetricsView";
import OrganizationsView from "./OrganizationsView";
import SystemSettingsView from "./SystemSettingsView";
import AuditLogsView from "./AuditLogsView";
import { useLocale } from "../../../i18n/useLocale";
import { toast } from "react-hot-toast";

type TabId = "metrics" | "organizations" | "settings" | "audit_logs";

export default function SysAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>("metrics");
  const { language } = useLocale();
  const isFarsi = language === "fa";

  const renderActiveView = () => {
    switch (activeTab) {
      case "metrics":
        return <PlatformMetricsView />;
      case "organizations":
        return <OrganizationsView />;
      case "settings":
        return <SystemSettingsView />;
      case "audit_logs":
        return <AuditLogsView />;
      default:
        return null;
    }
  };

  const tabs = [
    { id: "metrics" as TabId, label: isFarsi ? "معیارهای پلتفرم" : "Platform Metrics" },
    { id: "organizations" as TabId, label: isFarsi ? "ثبت سازمان‌ها" : "Organizations Registry" },
    { id: "settings" as TabId, label: isFarsi ? "تنظیمات سراسری" : "Global Configurations" },
    { id: "audit_logs" as TabId, label: isFarsi ? "لاگ‌های عملیاتی" : "Operator Audit Logs" },
  ];

  return (
    <AppShell
      title={isFarsi ? "نمای حاکمیت" : "Governance Overview"}
      subtitle={isFarsi ? "وضعیت سلامت زیرساخت و برابری سازمان‌ها به صورت زنده." : "Real-time infrastructure health and organization parity."}
      activeNav="sysAdmin"
    >
      <div className="space-y-6">
        {/* Horizontal Navigation Tabs with Top-Right Action Buttons */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[var(--b)] gap-4 pb-2">
          <div className="flex gap-1 overflow-x-auto whitespace-nowrap scrollbar-none w-full md:w-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-xs md:text-sm font-semibold border-b-2 transition-all duration-200 outline-none ${
                    isActive
                      ? "border-[var(--brand)] text-[var(--brand)] bg-[var(--brand-soft)]/20"
                      : "border-transparent text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s2)]/40"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-auto mb-2 md:mb-0">
            <button
              onClick={() => toast.success(isFarsi ? "گزارش پلتفرم صادر شد." : "Platform report exported successfully.")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] text-xs text-[var(--t1)] font-bold shadow-sm transition-all active:scale-[0.98] select-none"
            >
              <span>📥</span>
              <span>{isFarsi ? "خروجی گزارش" : "Export Report"}</span>
            </button>
            <button
              onClick={() => toast.success(isFarsi ? "آغاز فرآیند استقرار مستاجر جدید..." : "Initializing new tenant deployment...")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-h)] text-xs text-[var(--brand-text)] font-bold shadow-sm transition-all active:scale-[0.98] select-none"
            >
              <span>➕</span>
              <span>{isFarsi ? "استقرار سازمان جدید" : "New Org Deployment"}</span>
            </button>
          </div>
        </div>

        {/* Selected tab content */}
        <div className="min-h-[400px]">
          {renderActiveView()}
        </div>
      </div>
    </AppShell>
  );
}
