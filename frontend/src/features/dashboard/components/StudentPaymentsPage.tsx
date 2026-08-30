import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { crmApi } from "../api/crm.api";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import { useLocale } from "../../../i18n/useLocale";
import { CreditCard, Calendar, FileText, CheckCircle, AlertTriangle, ShieldCheck } from "lucide-react";

export default function StudentPaymentsPage() {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const [searchParams] = useSearchParams();
  const courseIdParam = searchParams.get("course");
  const courseId = courseIdParam ? parseInt(courseIdParam) : undefined;

  const [activeTab, setActiveTab] = useState<"unpaid" | "paid" | "all">("unpaid");

  // Queries
  const { data: invoicesResponse, isLoading: loadingInvoices } = useQuery({
    queryKey: ["student-invoices-list", courseId],
    queryFn: () => crmApi.getInvoices({ page_size: 100, course_id: courseId }),
  });
  const invoices = invoicesResponse?.results || [];

  const { data: balance, isLoading: loadingBalance } = useQuery({
    queryKey: ["student-invoices-balance", courseId],
    queryFn: () => crmApi.getInvoiceBalance({ course_id: courseId }),
  });

  const unpaidInvoices = invoices.filter(inv => 
    inv.status === "unpaid" || inv.status === "overdue" || inv.status === "partial"
  );

  const paidInvoices = invoices.filter(inv => 
    inv.status === "paid" || inv.status === "refunded"
  );

  const getActiveList = () => {
    switch (activeTab) {
      case "unpaid": return unpaidInvoices;
      case "paid": return paidInvoices;
      case "all": return invoices;
      default: return [];
    }
  };

  const activeList = getActiveList();
  const isLoading = loadingInvoices || loadingBalance;

  return (
    <AppShell title={isFarsi ? "صورتحساب‌ها و پرداخت‌های من" : "My Payments"}>
      <div className="flex flex-col gap-6 max-w-5xl mx-auto">
        
        {/* Balance Summary Header Cards */}
        {loadingBalance ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[var(--s2)] h-24 rounded-2xl animate-pulse border border-[var(--b)]" />
            <div className="bg-[var(--s2)] h-24 rounded-2xl animate-pulse border border-[var(--b)]" />
            <div className="bg-[var(--s2)] h-24 rounded-2xl animate-pulse border border-[var(--b)]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Outstanding Balance Card */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
              <div>
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">
                  {isFarsi ? "بدهی معوقه" : "Outstanding Balance"}
                </span>
                <div className="text-2xl font-black text-[var(--t1)] mt-1.5">
                  ${balance?.outstanding?.toFixed(1) || "0.0"}
                </div>
                <span className="text-[10px] text-[var(--t3)] block mt-0.5">
                  {isFarsi ? `${balance?.pending_count || 0} فاکتور پرداخت نشده` : `${balance?.pending_count || 0} unpaid invoices`}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* Total Paid Card */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              <div>
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">
                  {isFarsi ? "مبلغ پرداخت شده" : "Total Paid"}
                </span>
                <div className="text-2xl font-black text-[var(--t1)] mt-1.5">
                  ${balance?.total_paid?.toFixed(1) || "0.0"}
                </div>
                <span className="text-[10px] text-[var(--t3)] block mt-0.5">
                  {isFarsi ? "تراکنش‌های موفق" : "Successful payments"}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            {/* Total Billed Card */}
            <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--brand)]/5 rounded-full blur-2xl pointer-events-none" />
              <div>
                <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider block">
                  {isFarsi ? "کل شهریه صادر شده" : "Total Billed"}
                </span>
                <div className="text-2xl font-black text-[var(--t1)] mt-1.5">
                  ${balance?.total_billed?.toFixed(1) || "0.0"}
                </div>
                <span className="text-[10px] text-[var(--t3)] block mt-0.5">
                  {isFarsi ? "شهریه کل دوره‌ها" : "Billed amount across all classes"}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center text-xl">
                <CreditCard className="w-6 h-6" />
              </div>
            </div>

          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-[var(--b)] overflow-x-auto gap-2 bg-[var(--s2)] p-1.5 rounded-xl border border-[var(--b)] shadow-sm">
          {(["unpaid", "paid", "all"] as const).map((tab) => {
            const count = tab === "unpaid" ? unpaidInvoices.length 
                        : tab === "paid" ? paidInvoices.length
                        : invoices.length;
            
            const labels = {
              unpaid: isFarsi ? "پرداخت نشده" : "Unpaid / Overdue",
              paid: isFarsi ? "پرداخت شده" : "Paid",
              all: isFarsi ? "کل تاریخچه" : "Billing History"
            };

            const colors = {
              unpaid: "border-rose-500 text-rose-500",
              paid: "border-emerald-500 text-emerald-500",
              all: "border-[var(--brand)] text-[var(--brand)]"
            };

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold border-b-2 cursor-pointer transition-all duration-150 whitespace-nowrap bg-transparent flex items-center gap-2 ${
                  activeTab === tab 
                    ? colors[tab]
                    : "border-transparent text-[var(--t3)] hover:text-[var(--t1)]"
                }`}
              >
                <span>{labels[tab]}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab ? "bg-[var(--brand)]/15" : "bg-[var(--s3)]"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Content list */}
        {isLoading ? (
          <div className="flex justify-center p-16"><Spinner /></div>
        ) : activeList.length === 0 ? (
          <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-16 text-center shadow-sm">
            <div className="text-4xl mb-4">🧾</div>
            <h3 className="text-sm font-bold text-[var(--t1)]">
              {isFarsi ? "هیچ فاکتور یا صورتحسابی یافت نشد" : "No invoices found"}
            </h3>
            <p className="text-xs text-[var(--t3)] mt-1">
              {isFarsi ? "تاریخچه صورتحساب‌های خود را از بخش‌های بالا دنبال کنید." : "Keep track of your billing records and tuition history using the tabs above."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeList.map((invoice) => {
              const isOverdue = invoice.status === "overdue" || (invoice.status === "unpaid" && invoice.due_date && new Date(invoice.due_date) < new Date());
              const isPaid = invoice.status === "paid";
              
              return (
                <div 
                  key={invoice.id} 
                  className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-5 hover:border-[var(--brand)]/40 transition-all flex flex-col justify-between gap-4 shadow-sm hover:shadow-md relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--brand)]/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
                        isPaid ? "bg-emerald-500/10 text-emerald-500" : isOverdue ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                      }`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-[var(--brand)] uppercase tracking-wider block">
                          {invoice.invoice_number || `INV-${invoice.id}`}
                        </span>
                        <h4 className="text-sm font-bold text-[var(--t1)] mt-0.5 truncate">{invoice.class_name || (isFarsi ? "شهریه آکادمی" : "Academy Tuition")}</h4>
                        <p className="text-[11px] text-[var(--t3)] mt-1 truncate">
                          {isFarsi ? "روش پرداخت:" : "Method:"} {invoice.payment_method ? (isFarsi ? (invoice.payment_method === "online" ? "آنلاین" : invoice.payment_method === "cash" ? "نقدی" : "حواله بانکی") : invoice.payment_method) : (isFarsi ? "ثبت نشده" : "Not specified")}
                        </p>
                      </div>
                    </div>

                    <div className="text-end">
                      <div className="text-base font-black text-[var(--t1)]">${invoice.amount}</div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                        isPaid ? "bg-emerald-500/15 text-emerald-500" 
                        : isOverdue ? "bg-rose-500/15 text-rose-500" 
                        : "bg-amber-500/15 text-amber-500"
                      }`}>
                        {isPaid ? (isFarsi ? "پرداخت شده" : "Paid") 
                        : isOverdue ? (isFarsi ? "معوق" : "Overdue") 
                        : (isFarsi ? "در انتظار پرداخت" : "Unpaid")}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 items-center justify-between text-[11px] text-[var(--t3)] border-t border-[var(--b)] pt-3 mt-1 font-medium">
                    {invoice.due_date && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {isFarsi ? "سررسید:" : "Due:"} {new Date(invoice.due_date).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}
                      </span>
                    )}
                    {isPaid && invoice.paid_at && (
                      <span className="flex items-center gap-1.5 text-emerald-500">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {isFarsi ? "تاریخ پرداخت:" : "Paid on:"} {new Date(invoice.paid_at).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}
                      </span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </AppShell>
  );
}
