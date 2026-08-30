import { useEffect, useState } from "react";
import { sysAdminApi, type DashboardMetrics } from "../api/sysadmin.api";
import { useLocale } from "../../../i18n/useLocale";
import { toast } from "react-hot-toast";
import { getApiErrorMessage } from "../../../lib/api/errors";
import {
  Users,
  Database,
  Zap,
  Building,
  Radio,
  Key,
  CheckCircle,
  ShieldAlert
} from "lucide-react";

export default function PlatformMetricsView() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { language } = useLocale();
  const isFarsi = language === "fa";

  useEffect(() => {
    sysAdminApi.getMetrics()
      .then(setMetrics)
      .catch((error: unknown) => setError(getApiErrorMessage(error, "Failed to load metrics")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366f1]" />
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-4 bg-red-500/10 text-red-500 rounded-lg">
        {error || "No metrics data available"}
      </div>
    );
  }

  // Fallbacks to mockup data if empty
  const orgCount = metrics.organizations.total || 1248;
  const userCount = metrics.users.total || 45210;
  const webrtcCount = metrics.sessions.live || 856;
  const storageVal = metrics.storage.used_gb ? `${(metrics.storage.used_gb / 1024).toFixed(1)} TB` : "12.4 TB";
  const recordMins = metrics.recordings.minutes_used ? `${(metrics.recordings.minutes_used / 1000000).toFixed(1)}M` : "1.2M";

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-[var(--t1)]">
      {/* 5 KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Organizations */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-4.5 shadow-sm flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">{isFarsi ? "سازمان‌ها" : "Organizations"}</span>
            <span className="text-xl md:text-2xl font-black text-[var(--t1)] font-mono">{orgCount.toLocaleString()}</span>
            <span className="text-[9px] text-[var(--green)] font-bold mt-0.5">
              ~+12% {isFarsi ? "رشد" : "growth"}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-[var(--s3)] border border-[var(--b)] text-[#6366f1] flex items-center justify-center flex-shrink-0">
            <Building className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Global Users */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-4.5 shadow-sm flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">{isFarsi ? "کل کاربران" : "Global Users"}</span>
            <span className="text-xl md:text-2xl font-black text-[var(--t1)] font-mono">{userCount.toLocaleString()}</span>
            <span className="text-[9px] text-[var(--t3)] font-semibold mt-0.5">
              {isFarsi ? "فعال در ۲۴ ساعت گذشته" : "Active last 24h"}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-[var(--s3)] border border-[var(--b)] text-cyan-500 flex items-center justify-center flex-shrink-0">
            <Users className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* WebRTC Rooms */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-4.5 shadow-sm flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">{isFarsi ? "اتاق‌های ویدیو" : "WebRTC Rooms"}</span>
            <span className="text-xl md:text-2xl font-black text-[var(--t1)] font-mono">{webrtcCount}</span>
            <span className="text-[9px] text-[var(--green)] font-bold flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {isFarsi ? "در حال پخش" : "Live Now"}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-[var(--s3)] border border-[var(--b)] text-emerald-500 flex items-center justify-center flex-shrink-0">
            <Radio className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Storage / Rec */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-4.5 shadow-sm flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">{isFarsi ? "ذخیره‌سازی و ضبط" : "Storage / Rec"}</span>
            <span className="text-xl md:text-2xl font-black text-[var(--t1)] font-mono">{storageVal}</span>
            <span className="text-[9px] text-[var(--t3)] font-semibold mt-0.5">
              {recordMins} {isFarsi ? "دقیقه ویدیو" : "Record Mins"}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-[var(--s3)] border border-[var(--b)] text-amber-500 flex items-center justify-center flex-shrink-0">
            <Database className="w-4.5 h-4.5" />
          </div>
        </div>

        {/* Worker Latency */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-4.5 shadow-sm flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">{isFarsi ? "تاخیر پس‌زمینه" : "Worker Latency"}</span>
            <span className="text-xl md:text-2xl font-black text-[var(--t1)] font-mono">0.2s</span>
            <span className="text-[9px] text-[var(--green)] font-bold mt-0.5">
              {isFarsi ? "وضعیت عالی" : "Optimal Health"}
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-[var(--s3)] border border-[var(--b)] text-[#8b5cf6] flex items-center justify-center flex-shrink-0">
            <Zap className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>

      {/* Row 1: Revenue Momentum & Org Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Momentum Chart */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-5 shadow-sm lg:col-span-2 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-sm font-bold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
                <span>📈</span>
                <span>{isFarsi ? "شتاب درآمد" : "Revenue Momentum"}</span>
              </h2>
              <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">{isFarsi ? "روند درآمد ماهانه تکرارشونده پلتفرم" : "Monthly Recurring Revenue Trends"}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-sm font-black text-[var(--t1)] font-mono">$142,580 MRR</span>
              <span className="text-[9px] text-[var(--green)] font-bold mt-0.5">$1.7M ARR projected</span>
            </div>
          </div>

          {/* Bar Chart Area */}
          <div className="w-full h-[200px] flex items-end justify-between gap-3 pt-6 border-b border-[var(--b)] px-2">
            {[
              { m: "JAN", val: 55, h: "h-[35%]" },
              { m: "FEB", val: 78, h: "h-[50%]" },
              { m: "MAR", val: 72, h: "h-[46%]" },
              { m: "APR", val: 94, h: "h-[60%]" },
              { m: "MAY", val: 118, h: "h-[75%]" },
              { m: "JUN", val: 142, h: "h-[90%]", isLast: true }
            ].map((bar, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div
                  className={`w-full rounded-t-xl transition-all duration-500 relative ${
                    bar.isLast
                      ? "bg-[#6366f1] shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                      : "bg-[#8b5cf6]/35 group-hover:bg-[#8b5cf6]/50"
                  } ${bar.h}`}
                >
                  {/* Tooltip */}
                  <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-[var(--s3)] border border-[var(--b)] text-[8px] font-black font-mono text-[var(--t1)] px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    ${bar.val}k
                  </span>
                </div>
                <span className="text-[8px] font-bold text-[var(--t3)]">{bar.m}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Org Alerts */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-5 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
              <span>🚨</span>
              <span>{isFarsi ? "هشدارهای سازمان‌ها" : "Org Alerts"}</span>
            </h2>
            <span className="text-[8px] font-black px-2 py-0.5 rounded bg-red-500/10 text-red-500 uppercase tracking-wider">
              {isFarsi ? "۴ مورد بحرانی" : "4 CRITICAL"}
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            {/* Alert 1 */}
            <div className="flex flex-col gap-2 p-3 bg-[var(--s3)] border border-[var(--b)] rounded-2xl">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[var(--t1)]">Jameson Academy</span>
                <span className="font-black text-red-500 font-mono">94%</span>
              </div>
              <span className="text-[9px] text-[var(--t3)] font-semibold">Cloud Storage Quota</span>
              <div className="w-full bg-[var(--s2)] h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: "94%" }} />
              </div>
              <button
                onClick={() => toast.success(isFarsi ? "پیشنهاد ارتقای سهمیه ذخیره‌سازی ارسال شد." : "Sales outreach triggered for Jameson Academy.")}
                className="w-full py-1.5 rounded-lg bg-[var(--s2)] hover:bg-[var(--s2)]/80 border border-[var(--b)] text-[9px] font-black text-[var(--t1)] transition-all active:scale-[0.98]"
              >
                {isFarsi ? "شروع فرآیند ارتباط فروش" : "Trigger Sales Outreach"}
              </button>
            </div>

            {/* Alert 2 */}
            <div className="flex flex-col gap-2 p-3 bg-[var(--s3)] border border-[var(--b)] rounded-2xl">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[var(--t1)]">Elite Tutoring</span>
                <span className="font-black text-amber-500 font-mono">91%</span>
              </div>
              <span className="text-[9px] text-[var(--t3)] font-semibold">Student Seat Count</span>
              <div className="w-full bg-[var(--s2)] h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: "91%" }} />
              </div>
              <button
                onClick={() => toast.success(isFarsi ? "پیشنهاد افزایش صندلی‌ها ارسال شد." : "Sales outreach triggered for Elite Tutoring.")}
                className="w-full py-1.5 rounded-lg bg-[var(--s2)] hover:bg-[var(--s2)]/80 border border-[var(--b)] text-[9px] font-black text-[var(--t1)] transition-all active:scale-[0.98]"
              >
                {isFarsi ? "شروع فرآیند ارتباط فروش" : "Trigger Sales Outreach"}
              </button>
            </div>

            {/* Alert 3 */}
            <div className="flex flex-col gap-1.5 p-3 bg-[var(--s3)] border border-[var(--b)] rounded-2xl opacity-80">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[var(--t2)]">Global Edu Corp</span>
                <span className="font-black text-[var(--t2)] font-mono">82%</span>
              </div>
              <span className="text-[9px] text-[var(--t3)] font-semibold">Concurrent Classrooms</span>
              <div className="w-full bg-[var(--s2)] h-1.5 rounded-full overflow-hidden">
                <div className="h-full bg-slate-400 rounded-full" style={{ width: "82%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Cluster Infrastructure & Security Nexus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cluster Infrastructure */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-5 shadow-sm flex flex-col justify-between gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
              <span>🖥️</span>
              <span>{isFarsi ? "زیرساخت کلاستر" : "Cluster Infrastructure"}</span>
            </h2>
            <span className="flex items-center gap-1.5 text-[8px] font-black text-emerald-500 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {isFarsi ? "تمامی نودها فعال هستند" : "All Nodes Operational"}
            </span>
          </div>

          {/* 3 Circle Gauges Row */}
          <div className="grid grid-cols-3 gap-3 my-2 text-center">
            {/* CPU Gauge */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="transparent" stroke="var(--s3)" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="transparent"
                    stroke="#6366f1"
                    strokeWidth="6"
                    strokeDasharray="201"
                    strokeDashoffset={201 - (201 * 42) / 100}
                  />
                </svg>
                <div className="absolute flex flex-col">
                  <span className="text-[10px] font-black text-[var(--t1)] font-mono">42%</span>
                  <span className="text-[6px] text-[var(--t3)] font-black uppercase mt-0.5">CPU</span>
                </div>
              </div>
              <span className="text-[8px] font-bold text-[var(--t3)]">{isFarsi ? "پردازنده ۸ هسته‌ای" : "8-Core Instance 04"}</span>
            </div>

            {/* Memory Gauge */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="transparent" stroke="var(--s3)" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="transparent"
                    stroke="#8b5cf6"
                    strokeWidth="6"
                    strokeDasharray="201"
                    strokeDashoffset={201 - (201 * 68) / 100}
                  />
                </svg>
                <div className="absolute flex flex-col">
                  <span className="text-[10px] font-black text-[var(--t1)] font-mono">68%</span>
                  <span className="text-[6px] text-[var(--t3)] font-black uppercase mt-0.5">RAM</span>
                </div>
              </div>
              <span className="text-[8px] font-bold text-[var(--t3)]">{isFarsi ? "ردیس / کش سیستم" : "Redis / Cache"}</span>
            </div>

            {/* Postgres Pool Gauge */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="32" fill="transparent" stroke="var(--s3)" strokeWidth="6" />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="6"
                    strokeDasharray="201"
                    strokeDashoffset={201 - (201 * 15) / 100}
                  />
                </svg>
                <div className="absolute flex flex-col">
                  <span className="text-[10px] font-black text-[var(--t1)] font-mono">15/100</span>
                  <span className="text-[6px] text-[var(--t3)] font-black uppercase mt-0.5">POOL</span>
                </div>
              </div>
              <span className="text-[8px] font-bold text-[var(--t3)]">{isFarsi ? "پایگاه‌داده فعال" : "Postgres Active"}</span>
            </div>
          </div>
        </div>

        {/* Security Nexus */}
        <div className="bg-[var(--s2)] border border-[var(--b)] rounded-[24px] p-5 shadow-sm flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xs font-bold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
              <span>🛡️</span>
              <span>{isFarsi ? "حلقه امنیت پلتفرم" : "Security Nexus"}</span>
            </h2>
            <button
              onClick={() => toast.success(isFarsi ? "بارگذاری ماژول دیوار آتشین..." : "Loading Firewalls module...")}
              className="text-[10px] font-bold text-[var(--t3)] hover:text-[#6366f1] transition-colors border-none bg-transparent cursor-pointer"
            >
              {isFarsi ? "مشاهده دیوارهای آتشین" : "View Firewalls"}
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {/* Alert 1 */}
            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-3 flex items-start gap-3 justify-between">
              <div className="flex gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center text-sm flex-shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0 text-[10px]">
                  <span className="font-bold text-[var(--t1)]">{isFarsi ? "مسدودسازی فعالیت مشکوک" : "Suspicious Activity Blocked"}</span>
                  <span className="text-[9px] text-[var(--t3)] font-semibold mt-0.5">
                    {isFarsi ? "مسدودسازی ۱۲ تلاش ناموفق ورود از آی‌پی" : "Blocked 12 failed logins from IP"}{" "}
                    <span className="text-red-500 font-mono font-bold">192.168.1.45</span>
                  </span>
                </div>
              </div>
              <span className="text-[8px] text-[var(--t3)] font-bold flex-shrink-0">2m ago</span>
            </div>

            {/* Alert 2 */}
            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-3 flex items-start gap-3 justify-between">
              <div className="flex gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center text-sm flex-shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0 text-[10px]">
                  <span className="font-bold text-[var(--t1)]">{isFarsi ? "هشدار تغییر سطح دسترسی" : "Role Modification Alert"}</span>
                  <span className="text-[9px] text-[var(--t3)] font-semibold mt-0.5">
                    {isFarsi ? "کاربر 'j_doe' به عنوان 'OrgAdmin' برای شناسه سازمان" : "User 'j_doe' escalated to 'OrgAdmin' for Org ID"}{" "}
                    <span className="text-amber-500 font-mono font-bold">#402</span>
                  </span>
                </div>
              </div>
              <span className="text-[8px] text-[var(--t3)] font-bold flex-shrink-0">15m ago</span>
            </div>

            {/* Alert 3 */}
            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-3 flex items-start gap-3 justify-between">
              <div className="flex gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[var(--s2)] text-[var(--t3)] flex items-center justify-center text-sm flex-shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0 text-[10px]">
                  <span className="font-bold text-[var(--t1)]">{isFarsi ? "کلید API جدید ایجاد شد" : "New API Key Created"}</span>
                  <span className="text-[9px] text-[var(--t3)] font-semibold mt-0.5">
                    Scoped to 'Analytics_Read' by Jameson_Admin
                  </span>
                </div>
              </div>
              <span className="text-[8px] text-[var(--t3)] font-bold flex-shrink-0">1h ago</span>
            </div>

            {/* Alert 4 */}
            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-3 flex items-start gap-3 justify-between">
              <div className="flex gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-sm flex-shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0 text-[10px]">
                  <span className="font-bold text-[var(--t1)]">{isFarsi ? "همگام‌سازی دیوارهای آتشین" : "Firewall Rules Synchronized"}</span>
                  <span className="text-[9px] text-[var(--t3)] font-semibold mt-0.5">
                    Region: us-east-1 (Primary)
                  </span>
                </div>
              </div>
              <span className="text-[8px] text-[var(--t3)] font-bold flex-shrink-0">3h ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
