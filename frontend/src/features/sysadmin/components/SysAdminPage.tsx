import { useState } from "react";
import AppShell from "../../../components/layout/AppShell";
import PlatformMetricsView from "./PlatformMetricsView";
import OrganizationsView from "./OrganizationsView";
import SystemSettingsView from "./SystemSettingsView";
import AuditLogsView from "./AuditLogsView";

type TabId = "metrics" | "organizations" | "settings" | "audit_logs";

export default function SysAdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>("metrics");

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
    { id: "metrics" as TabId, label: "Platform Metrics" },
    { id: "organizations" as TabId, label: "Organizations Registry" },
    { id: "settings" as TabId, label: "Global Configurations" },
    { id: "audit_logs" as TabId, label: "Operator Audit Logs" },
  ];

  return (
    <AppShell title="Super Admin Platform Governance" subtitle="Manage operational tenants, quotas, system configurations, and security audits" activeNav="sysAdmin">
      <div className="space-y-6">
        {/* Horizontal Navigation Tabs */}
        <div className="flex border-b border-[var(--b)] gap-1 overflow-x-auto whitespace-nowrap scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-xs md:text-sm font-semibold border-b-2 transition-all duration-200 outline-none ${
                  isActive
                    ? "border-[var(--brand)] text-[var(--brand-text)] bg-[var(--brand-soft)]/20"
                    : "border-transparent text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s2)]/40"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Selected tab content */}
        <div className="min-h-[400px]">
          {renderActiveView()}
        </div>
      </div>
    </AppShell>
  );
}
