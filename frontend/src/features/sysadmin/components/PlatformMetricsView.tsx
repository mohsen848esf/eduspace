import { useEffect, useState } from "react";
import { sysAdminApi, type DashboardMetrics } from "../api/sysadmin.api";

export default function PlatformMetricsView() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    sysAdminApi.getMetrics()
      .then(setMetrics)
      .catch((err) => setError(err.response?.data?.detail || "Failed to load metrics"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--brand)]" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-4 bg-[var(--red)]/10 text-[var(--red)] rounded-lg">
        {error || "No metrics data available"}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Organizations Card */}
        <div className="p-5 bg-[var(--s2)] border border-[var(--b)] rounded-xl relative overflow-hidden group hover:border-[var(--brand-soft)] transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[var(--brand)]/10 to-transparent rounded-bl-full" />
          <p className="text-[12px] font-semibold text-[var(--t3)] uppercase tracking-wider">Organizations</p>
          <h3 className="text-3xl font-extrabold mt-2 text-[var(--t1)]">{metrics.organizations.total}</h3>
          <div className="flex items-center gap-3 mt-4 text-xs text-[var(--t2)]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
              {metrics.organizations.active} Active
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--red)]" />
              {metrics.organizations.suspended} Suspended
            </span>
          </div>
        </div>

        {/* Users Card */}
        <div className="p-5 bg-[var(--s2)] border border-[var(--b)] rounded-xl relative overflow-hidden group hover:border-[var(--brand-soft)] transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[var(--cyan)]/10 to-transparent rounded-bl-full" />
          <p className="text-[12px] font-semibold text-[var(--t3)] uppercase tracking-wider">Total Registered Users</p>
          <h3 className="text-3xl font-extrabold mt-2 text-[var(--t1)]">{metrics.users.total}</h3>
          <p className="text-xs text-[var(--t3)] mt-4">Across all operational tenants</p>
        </div>

        {/* Sessions Card */}
        <div className="p-5 bg-[var(--s2)] border border-[var(--b)] rounded-xl relative overflow-hidden group hover:border-[var(--brand-soft)] transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[var(--green)]/10 to-transparent rounded-bl-full" />
          <p className="text-[12px] font-semibold text-[var(--t3)] uppercase tracking-wider">Live Sessions</p>
          <h3 className="text-3xl font-extrabold mt-2 text-[var(--t1)] flex items-center gap-2">
            {metrics.sessions.live}
            {metrics.sessions.live > 0 && (
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--green)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-[var(--green)]"></span>
              </span>
            )}
          </h3>
          <p className="text-xs text-[var(--t3)] mt-4">Active LiveKit video classes</p>
        </div>

        {/* Storage / Recording Card */}
        <div className="p-5 bg-[var(--s2)] border border-[var(--b)] rounded-xl relative overflow-hidden group hover:border-[var(--brand-soft)] transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[var(--orange)]/10 to-transparent rounded-bl-full" />
          <p className="text-[12px] font-semibold text-[var(--t3)] uppercase tracking-wider">Storage & Recordings</p>
          <h3 className="text-3xl font-extrabold mt-2 text-[var(--t1)]">{metrics.storage.used_gb} <span className="text-sm font-semibold text-[var(--t3)]">GB</span></h3>
          <p className="text-xs text-[var(--t2)] mt-4">{metrics.recordings.minutes_used} total recording minutes</p>
        </div>
      </div>

      {/* Celery Queue Backlog status */}
      <div className="p-6 bg-[var(--s1)] border border-[var(--b)] rounded-xl">
        <h4 className="text-md font-bold text-[var(--t1)] mb-4 flex items-center gap-2">
          <span>Celery Queue Backlogs</span>
          <span className="text-xs font-normal text-[var(--t3)]">(Redis queue length)</span>
        </h4>
        <div className="space-y-4">
          {Object.entries(metrics.celery_backlog).map(([queueName, count]) => {
            const isHigh = count > 10;
            const progressPercent = Math.min(100, (count / 20) * 100);
            return (
              <div key={queueName} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-[var(--t2)] uppercase tracking-wide">{queueName}</span>
                  <span className={`font-bold px-2 py-0.5 rounded-full ${isHigh ? 'bg-[var(--red)]/20 text-[var(--red)] animate-pulse' : 'bg-[var(--s3)] text-[var(--t2)]'}`}>
                    {count} tasks
                  </span>
                </div>
                <div className="w-full bg-[var(--s3)] h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${isHigh ? 'bg-[var(--red)]' : 'bg-[var(--brand)]'}`}
                    style={{ width: `${progressPercent || 2}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
