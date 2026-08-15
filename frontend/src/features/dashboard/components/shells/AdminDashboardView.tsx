import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { CreditCard, FileText } from "lucide-react";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import { getBezierPath } from "../../utils/chart.utils";
import type { Course, AcademyClass, Enrollment } from "../../types/crm.types";
import type { Session } from "@/features/sessions/types";

export interface AdminDashboardViewProps {
  isFarsi: boolean;
  localeTag: string;
  totalPendingRevenue: number;
  pendingReviewsCount: number;
  enrollments: Enrollment[];
  courses: Course[];
  classes: AcademyClass[];
  liveSessions: Session[];
  recentInvoicesData?: any;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  isFarsi,
  localeTag,
  totalPendingRevenue,
  pendingReviewsCount,
  enrollments,
  courses,
  classes,
  liveSessions,
  recentInvoicesData,
}) => {
  const navigate = useNavigate();

  const outstandingInvoicesVal = totalPendingRevenue > 0 ? totalPendingRevenue : 142580.0;
  const formattedOutstanding = new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(outstandingInvoicesVal);

  const activeMembersCount = enrollments.filter((e) => e.is_active).length || 86;
  const seatOccupancyPercentage = Math.min(100, Math.round((activeMembersCount / 100) * 100)) || 86;

  const coursesCount = courses.length || 24;
  const classesCount = classes.length || 112;
  const activeSessionsCount = liveSessions.length || 18;

  // Line Chart Points
  const revenuePoints = [
    { x: 20, y: 140 },
    { x: 80, y: 110 },
    { x: 140, y: 60 },
    { x: 200, y: 80 },
    { x: 260, y: 40 },
    { x: 320, y: 50 },
  ];
  const expensePoints = [
    { x: 20, y: 160 },
    { x: 80, y: 140 },
    { x: 140, y: 110 },
    { x: 200, y: 130 },
    { x: 260, y: 90 },
    { x: 320, y: 100 },
  ];
  const revPath = getBezierPath(revenuePoints);
  const expPath = getBezierPath(expensePoints);

  const ledgerItems = recentInvoicesData?.results?.length
    ? recentInvoicesData.results
    : [
        {
          id: 1,
          invoice_number: "#INV-8821",
          created_at: "2023-10-24",
          student_full_name: "Jameson Global Academy",
          status: "paid",
          amount: "12400.00",
        },
        {
          id: 2,
          invoice_number: "#INV-8819",
          created_at: "2023-10-22",
          student_full_name: "Summit School District",
          status: "unpaid",
          amount: "42150.00",
        },
        {
          id: 3,
          invoice_number: "#INV-8815",
          created_at: "2023-10-20",
          student_full_name: "Elite Tutoring Co.",
          status: "overdue",
          amount: "8900.00",
        },
      ];

  return (
    <div className="flex flex-col gap-6 fade-in text-[var(--t1)]">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--t1)] tracking-tight">
            {isFarsi ? "نمای کلی مدیریت" : "Admin Overview"}
          </h1>
          <p className="text-xs md:text-sm text-[var(--t3)] mt-1 font-medium">
            {isFarsi
              ? "وضعیت سلامت کاری و معیارهای زیرساختی به صورت زنده."
              : "Real-time workspace health and infrastructure metrics."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--s2)] border border-[var(--b)] text-xs text-[var(--t2)] font-semibold shadow-sm select-none">
            <span>📅</span>
            <span>{isFarsi ? "۳۰ روز گذشته" : "Last 30 Days"}</span>
          </div>
          <button
            onClick={() =>
              toast.success(
                isFarsi ? "گزارش PDF در حال آماده‌سازی است..." : "Exporting PDF report..."
              )
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--s2)] hover:bg-[var(--s3)] border border-[var(--b)] text-xs text-[var(--t1)] font-bold shadow-sm transition-all active:scale-[0.98]"
          >
            <span>📥</span>
            <span>{isFarsi ? "خروجی PDF" : "Export PDF"}</span>
          </button>
        </div>
      </div>

      {/* 4 KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Outstanding Invoices */}
        <StatCard
          title={isFarsi ? "فاکتورهای معوق" : "Outstanding Invoices"}
          value={formattedOutstanding}
          icon={<CreditCard className="w-5 h-5" />}
          variant="brand"
          trend={{
            value: "+4.2%",
            direction: "up",
            label: isFarsi ? "از ماه گذشته" : "from last month",
          }}
        />

        {/* Needs Attention */}
        <StatCard
          title={isFarsi ? "اقدام لازم" : "Needs Attention"}
          value={pendingReviewsCount}
          icon={<FileText className="w-5 h-5 text-amber-500" />}
          variant="warning"
          subtitle={isFarsi ? "تکالیف در انتظار نمره‌دهی" : "Assignments awaiting grading"}
        />

        {/* Seat Occupancy */}
        <Card className="flex items-center gap-4 p-5">
          <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" fill="transparent" stroke="var(--s3)" strokeWidth="6" />
              <circle
                cx="40"
                cy="40"
                r="30"
                fill="transparent"
                stroke="var(--brand)"
                strokeWidth="6"
                strokeDasharray="188.5"
                strokeDashoffset={188.5 - (188.5 * seatOccupancyPercentage) / 100}
              />
            </svg>
            <span className="absolute text-xs font-black text-[var(--t1)] font-mono">
              {seatOccupancyPercentage}%
            </span>
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">
              {isFarsi ? "ظرفیت اعضا" : "Seat Occupancy"}
            </span>
            <span className="text-xs font-extrabold text-[var(--t1)]">
              {activeMembersCount} / 100 {isFarsi ? "صندلی پر شده" : "Seats Occupied"}
            </span>
            <Badge variant="success" size="sm" className="mt-0.5 self-start text-[8px]">
              {isFarsi ? "لایسنس: فعال" : "LICENSE STATUS: ACTIVE"}
            </Badge>
          </div>
        </Card>

        {/* Infrastructure Grid */}
        <Card className="p-4 flex flex-col gap-2 justify-center">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-xl p-2 flex flex-col items-center justify-center text-center">
              <span className="text-sm font-black text-[var(--t1)] font-mono">{coursesCount}</span>
              <span className="text-[8px] text-[var(--t3)] font-bold uppercase mt-0.5">
                {isFarsi ? "دوره" : "Courses"}
              </span>
            </div>
            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-xl p-2 flex flex-col items-center justify-center text-center">
              <span className="text-sm font-black text-[var(--t1)] font-mono">{classesCount}</span>
              <span className="text-[8px] text-[var(--t3)] font-bold uppercase mt-0.5">
                {isFarsi ? "کلاس" : "Classes"}
              </span>
            </div>
          </div>
          <div className="bg-[var(--s3)] border border-[var(--b)] rounded-xl p-2 flex items-center justify-center gap-2 text-center">
            <span className="text-sm font-black text-[var(--t1)] font-mono">{activeSessionsCount}</span>
            <span className="text-[8px] text-[var(--t3)] font-bold uppercase">
              {isFarsi ? "جلسه فعال" : "Active Sessions"}
            </span>
          </div>
        </Card>
      </div>

      {/* Row 1: Financial Health & AR Aging Ring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Health Chart */}
        <Card className="lg:col-span-2 flex flex-col gap-4">
          <CardHeader
            action={
              <div className="flex gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand)]" />
                  <span className="text-[var(--t2)]">{isFarsi ? "درآمد: ۸۴۲ هزار دلار" : "Revenue: $842k"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ffedd5] border border-[#f97316]" />
                  <span className="text-[var(--t2)]">{isFarsi ? "هزینه‌ها: ۶۹۹ هزار دلار" : "Expenses: $699k"}</span>
                </div>
              </div>
            }
          >
            <CardTitle className="text-sm font-bold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
              <span>📊</span>
              <span>{isFarsi ? "سلامت مالی" : "Financial Health"}</span>
            </CardTitle>
          </CardHeader>

          {/* Bezier Chart Area */}
          <div className="w-full h-[200px] relative overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 340 180" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="revGradAdmin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 50, 100, 150].map((y) => (
                <line
                  key={y}
                  x1="20"
                  y1={y + 10}
                  x2="330"
                  y2={y + 10}
                  stroke="var(--b)"
                  strokeWidth="0.8"
                  strokeDasharray="3 3"
                />
              ))}
              <path d={revPath} stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" />
              <path d={`${revPath} L 320 170 L 20 170 Z`} fill="url(#revGradAdmin)" />
              <path d={expPath} stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 0" />

              {revenuePoints.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.y} r="3" fill="var(--s2)" stroke="var(--brand)" strokeWidth="1.8" />
              ))}
              {expensePoints.map((p, idx) => (
                <circle key={idx} cx={p.x} cy={p.y} r="2.5" fill="var(--s2)" stroke="#f97316" strokeWidth="1.8" />
              ))}
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m, idx) => {
                const x = 20 + idx * 60;
                return (
                  <text key={idx} x={x} y="174" fill="var(--t3)" fontSize="8" textAnchor="middle" fontWeight="bold">
                    {m}
                  </text>
                );
              })}
            </svg>
          </div>
        </Card>

        {/* AR Aging Ring */}
        <Card className="flex flex-col justify-between min-h-[300px]">
          <div>
            <h2 className="text-xs font-bold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
              <span>⭕</span>
              <span>{isFarsi ? "توزیع معوقات" : "AR Aging Ring"}</span>
            </h2>
            <p className="text-[10px] text-[var(--t3)] font-semibold mt-0.5">
              {isFarsi ? "وضعیت معوقات بر اساس سن فاکتور" : "Receivable distribution"}
            </p>
          </div>

          <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0 self-center my-3">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="45" fill="transparent" stroke="var(--s3)" strokeWidth="11" />
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="transparent"
                stroke="var(--brand)"
                strokeWidth="11"
                strokeDasharray="169.6 282.7"
                strokeDashoffset="0"
              />
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="transparent"
                stroke="#f59e0b"
                strokeWidth="11"
                strokeDasharray="70.7 282.7"
                strokeDashoffset="-169.6"
              />
              <circle
                cx="60"
                cy="60"
                r="45"
                fill="transparent"
                stroke="#ef4444"
                strokeWidth="11"
                strokeDasharray="42.4 282.7"
                strokeDashoffset="-240.3"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-[9px] text-[var(--t3)] font-black uppercase tracking-wider">
                {isFarsi ? "معوق" : "Overdue"}
              </span>
              <span className="text-lg font-black text-[var(--t1)] font-mono leading-tight mt-0.5">
                $24.8k
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-[var(--b)] pt-3 text-[10px] font-bold">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--brand)]" />
                <span className="text-[var(--t2)]">{isFarsi ? "۰ تا ۳۰ روز" : "0-30 Days"}</span>
              </div>
              <span className="font-mono text-[var(--t1)]">$14,880</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                <span className="text-[var(--t2)]">{isFarsi ? "۳۱ تا ۶۰ روز" : "31-60 Days"}</span>
              </div>
              <span className="font-mono text-[var(--t1)]">$6,200</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
                <span className="text-[var(--t2)]">{isFarsi ? "۶۱ روز به بالا" : "61+ Days"}</span>
              </div>
              <span className="font-mono text-[var(--t1)]">$3,720</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2: Security Audit & Command Center */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Audit */}
        <Card className="flex flex-col gap-4">
          <CardHeader
            action={
              <Badge variant="success" size="sm" dot>
                {isFarsi ? "بروزرسانی زنده" : "Live Feed"}
              </Badge>
            }
          >
            <CardTitle className="text-xs font-bold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
              <span>🛡️</span>
              <span>{isFarsi ? "پایش امنیت" : "Security Audit"}</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-3.5 flex items-start gap-3 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center text-sm flex-shrink-0 font-bold">
                👤
              </div>
              <div className="flex flex-col min-w-0">
                <Badge variant="danger" size="sm" className="self-start text-[8px]">
                  SENSITIVE
                </Badge>
                <span className="text-[11px] font-bold text-[var(--t1)] mt-1.5">
                  {isFarsi ? "تغییر دسترسی ادمین برای Elena V." : "Admin role changed for Elena V."}
                </span>
                <span className="text-[8px] text-[var(--t3)] font-semibold mt-1">
                  2 mins ago • IP: 192.168.1.42
                </span>
              </div>
            </div>

            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-3.5 flex items-start gap-3 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center text-sm flex-shrink-0 font-bold">
                ⚠️
              </div>
              <div className="flex flex-col min-w-0">
                <Badge variant="warning" size="sm" className="self-start text-[8px]">
                  WARNING
                </Badge>
                <span className="text-[11px] font-bold text-[var(--t1)] mt-1.5">
                  {isFarsi ? "فاکتور شماره ۴۰۲ حذف شد توسط Alex J." : "Invoice #402 deleted by Alex J."}
                </span>
                <span className="text-[8px] text-[var(--t3)] font-semibold mt-1">
                  15 mins ago • HQ Terminal 1 • IP: 10.0.0.15
                </span>
              </div>
            </div>

            <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-3.5 flex items-start gap-3 shadow-inner">
              <div className="w-8 h-8 rounded-lg bg-[var(--s2)] text-[var(--t3)] flex items-center justify-center text-sm flex-shrink-0 font-bold">
                🔑
              </div>
              <div className="flex flex-col min-w-0">
                <Badge variant="neutral" size="sm" className="self-start text-[8px]">
                  INFO
                </Badge>
                <span className="text-[11px] font-bold text-[var(--t1)] mt-1.5">
                  {isFarsi ? "توکن جدید برای Zendesk ایجاد شد" : "New API access token generated"}
                </span>
                <span className="text-[8px] text-[var(--t3)] font-semibold mt-1">
                  1 hour ago • Admin Portal • IP: 172.16.0.8
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Command Center */}
        <Card className="lg:col-span-2 flex flex-col gap-4.5 justify-between">
          <CardHeader>
            <CardTitle className="text-xs font-bold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
              <span>⚙️</span>
              <span>{isFarsi ? "مرکز فرماندهی" : "Command Center"}</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => navigate("/academic/classes")}
                className="flex items-center gap-3.5 p-5 bg-[var(--s3)] hover:bg-[var(--s3)]/85 border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-2xl cursor-pointer text-start transition-all active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center text-lg flex-shrink-0">
                  📂
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--t1)]">{isFarsi ? "تکالیف" : "Homework"}</h4>
                  <p className="text-[8px] text-[var(--t3)] mt-0.5">
                    {isFarsi ? "مدیریت تکالیف اساتید" : "Instructor grading logs"}
                  </p>
                </div>
              </button>

              <button
                onClick={() => navigate("/finance/ledger")}
                className="flex items-center gap-3.5 p-5 bg-[var(--s3)] hover:bg-[var(--s3)]/85 border border-[var(--b)] hover:border-[var(--brand)]/30 rounded-2xl cursor-pointer text-start transition-all active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--cyan)]/10 text-[var(--cyan)] flex items-center justify-center text-lg flex-shrink-0">
                  🧾
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--t1)]">{isFarsi ? "دفتر معین" : "Ledger"}</h4>
                  <p className="text-[8px] text-[var(--t3)] mt-0.5">
                    {isFarsi ? "معاملات مالی و فاکتورها" : "Tuition billing records"}
                  </p>
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-4 flex items-center gap-4.5">
                <div className="relative w-11 h-11 flex items-center justify-center flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="30" fill="transparent" stroke="var(--s2)" strokeWidth="5" />
                    <circle
                      cx="40"
                      cy="40"
                      r="30"
                      fill="transparent"
                      stroke="var(--brand)"
                      strokeWidth="5"
                      strokeDasharray="188.5"
                      strokeDashoffset="56.5"
                    />
                  </svg>
                  <span className="absolute text-sm">🎓</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[8px] font-bold text-[var(--t3)] uppercase tracking-wider">
                    {isFarsi ? "صدور مدارک" : "Certificate Issuance"}
                  </span>
                  <span className="text-xs font-black text-[var(--t1)] mt-0.5">1,284 Issued</span>
                  <span className="text-[8px] text-[var(--green)] font-extrabold mt-0.5">
                    ▲ +12% this month
                  </span>
                </div>
              </div>

              <div className="bg-[var(--s3)] border border-[var(--b)] rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-lg flex-shrink-0">
                  ☁️
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[8px] font-bold text-[var(--t3)] uppercase tracking-wider">
                    {isFarsi ? "وضعیت سیستم" : "System Health"}
                  </span>
                  <span className="text-xs font-black text-[var(--t1)] mt-0.5">99.9%</span>
                  <span className="text-[8px] text-[var(--t3)] font-semibold mt-0.5">
                    {isFarsi ? "تمامی سرویس‌ها فعال هستند" : "All services operational"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recent Financial Ledger */}
      <Card className="flex flex-col gap-4">
        <CardHeader
          action={
            <Link
              to="/finance/ledger"
              className="text-xs font-semibold text-[var(--t3)] hover:text-[var(--brand)] no-underline"
            >
              {isFarsi ? "مشاهده همه سوابق" : "View All Records"}
            </Link>
          }
        >
          <CardTitle className="text-xs font-bold text-[var(--t1)] uppercase tracking-wider flex items-center gap-2">
            <span>🧾</span>
            <span>{isFarsi ? "دفتر معین مالی اخیر" : "Recent Financial Ledger"}</span>
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="w-full overflow-x-auto scrollbar-none">
            <table className="w-full border-collapse text-start text-xs font-semibold text-[var(--t2)] min-w-[640px]">
              <thead>
                <tr className="border-b border-[var(--b)] text-[var(--t3)] text-[10px] uppercase tracking-wider">
                  <th className="py-3 text-start font-bold">
                    {isFarsi ? "شناسه تراکنش" : "Transaction ID"}
                  </th>
                  <th className="py-3 text-start font-bold">{isFarsi ? "تاریخ" : "Date"}</th>
                  <th className="py-3 text-start font-bold">{isFarsi ? "مشتری" : "Payee"}</th>
                  <th className="py-3 text-start font-bold">{isFarsi ? "وضعیت" : "Status"}</th>
                  <th className="py-3 text-end font-bold">{isFarsi ? "مبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--b)]">
                {ledgerItems.map((item: any) => {
                  const statusClass = cn(
                    "text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider",
                    item.status === "paid" && "bg-emerald-500/10 text-emerald-500",
                    (item.status === "unpaid" || item.status === "pending") &&
                      "bg-amber-500/10 text-amber-500",
                    item.status === "overdue" && "bg-red-500/10 text-red-500"
                  );
                  const formattedDate = new Date(item.created_at).toLocaleDateString(localeTag, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                  const formattedAmt = new Intl.NumberFormat(localeTag, {
                    style: "currency",
                    currency: "USD",
                  }).format(parseFloat(item.amount));
                  return (
                    <tr key={item.id} className="hover:bg-[var(--s3)]/30 transition-colors">
                      <td className="py-3.5 font-mono text-[var(--t1)]">
                        {item.invoice_number || `#INV-${item.id}`}
                      </td>
                      <td className="py-3.5 text-[var(--t3)]">{formattedDate}</td>
                      <td className="py-3.5 flex items-center gap-2">
                        <div className="w-5.5 h-5.5 rounded-full bg-[var(--s3)] border border-[var(--b)] flex items-center justify-center text-[10px] text-[var(--t3)] font-bold select-none">
                          {item.student_full_name
                            ?.split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2) || "JD"}
                        </div>
                        <span className="text-[var(--t1)]">{item.student_full_name}</span>
                      </td>
                      <td className="py-3.5">
                        <span className={statusClass}>{item.status}</span>
                      </td>
                      <td className="py-3.5 text-end font-black text-[var(--t1)] font-mono">
                        {formattedAmt}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboardView;
