import React from "react";
import { Link } from "react-router-dom";
import { DollarSign, ArrowUpRight, ArrowDownRight, ArrowLeft, ArrowRight } from "lucide-react";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import type { FinanceSummary, TuitionInvoice } from "../../types/crm.types";

export interface OrgFinanceSnapshotProps {
  isFarsi: boolean;
  localeTag: string;
  summaryData?: FinanceSummary | null;
  recentInvoicesData?: { results?: TuitionInvoice[] } | null;
}

export const OrgFinanceSnapshot: React.FC<OrgFinanceSnapshotProps> = ({
  isFarsi,
  localeTag,
  summaryData,
  recentInvoicesData,
}) => {
  const invoices = recentInvoicesData?.results || [];
  const revenue = summaryData?.revenue || 0;
  const expenses = summaryData?.expenses || 0;
  const outstanding = summaryData?.outstanding || 0;
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(localeTag, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <span className="px-2 py-0.5 rounded-full bg-[var(--green)]/15 text-[var(--green)] text-[10px] font-bold">
            {isFarsi ? "پرداخت شده" : "Paid"}
          </span>
        );
      case "unpaid":
        return (
          <span className="px-2 py-0.5 rounded-full bg-[var(--amber)]/15 text-[var(--amber)] text-[10px] font-bold">
            {isFarsi ? "در انتظار پرداخت" : "Unpaid"}
          </span>
        );
      case "cancelled":
        return (
          <span className="px-2 py-0.5 rounded-full bg-[var(--s3)] text-[var(--t3)] text-[10px] font-medium">
            {isFarsi ? "لغو شده" : "Cancelled"}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-[var(--s3)] text-[var(--t2)] text-[10px]">
            {status}
          </span>
        );
    }
  };

  return (
    <Card className="flex flex-col h-full space-y-4">
      <CardHeader
        action={
          <Link
            to="/finance/ledger"
            className="text-xs font-bold text-[var(--t3)] hover:text-[var(--brand)] no-underline flex items-center gap-1 transition-colors"
          >
            <span>{isFarsi ? "دفتر کل و فاکتورها" : "Financial Ledger"}</span>
            {isFarsi ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </Link>
        }
      >
        <CardTitle className="text-xs font-bold text-[var(--t2)] uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-[var(--brand)]" />
          <span>{isFarsi ? "خلاصه مالی و تراکنش‌های اخیر" : "Financial Overview"}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metric summary boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-[var(--s1)] border border-[var(--b)] p-3 rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-[var(--t3)]">
              {isFarsi ? "کل دریافتی" : "Total Revenue"}
            </span>
            <div className="text-base sm:text-lg font-black text-[var(--t1)] font-mono flex items-center gap-1 text-[var(--green)]">
              <ArrowUpRight className="w-4 h-4" />
              <span>{formatCurrency(revenue)}</span>
            </div>
          </div>

          <div className="bg-[var(--s1)] border border-[var(--b)] p-3 rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-[var(--t3)]">
              {isFarsi ? "هزینه‌ها" : "Total Expenses"}
            </span>
            <div className="text-base sm:text-lg font-black text-[var(--t1)] font-mono flex items-center gap-1 text-[var(--red)]">
              <ArrowDownRight className="w-4 h-4" />
              <span>{formatCurrency(expenses)}</span>
            </div>
          </div>

          <div className="bg-[var(--s1)] border border-[var(--b)] p-3 rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-[var(--t3)]">
              {isFarsi ? "مطالبات شهریه" : "Outstanding"}
            </span>
            <div className="text-base sm:text-lg font-black text-[var(--t1)] font-mono flex items-center gap-1 text-[var(--amber)]">
              <span>{formatCurrency(outstanding)}</span>
            </div>
          </div>
        </div>

        {/* Recent Invoices Table / List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--t2)]">
            <span>{isFarsi ? "آخرین فاکتورهای صادرشده" : "Recent Invoices"}</span>
            <span className="text-[11px] text-[var(--t3)] font-normal font-mono">{invoices.length} {isFarsi ? "مورد" : "items"}</span>
          </div>

          {invoices.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--t3)] bg-[var(--s1)] border border-[var(--b)] rounded-xl">
              {isFarsi ? "هنوز فاکتوری در این سازمان ثبت نشده است." : "No invoice records found in this organization."}
            </div>
          ) : (
            <div className="divide-y divide-[var(--b)]/60 bg-[var(--s1)] border border-[var(--b)] rounded-xl px-3">
              {invoices.slice(0, 4).map((inv) => (
                <div key={inv.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/finance/invoices/${inv.id}`}
                        className="text-xs font-bold text-[var(--brand)] hover:underline no-underline truncate"
                      >
                        {inv.invoice_number || `#${inv.id}`}
                      </Link>
                      {getStatusBadge(inv.status)}
                    </div>
                    <div className="text-[11px] text-[var(--t3)] truncate">
                      {inv.student_full_name || inv.student_username || (isFarsi ? "دانشجو" : "Student")}
                      {inv.class_name && ` • ${inv.class_name}`}
                    </div>
                  </div>

                  <div className="text-end shrink-0">
                    <span className="text-xs font-bold font-mono text-[var(--t1)]">
                      ${parseFloat(inv.amount || "0").toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default OrgFinanceSnapshot;
