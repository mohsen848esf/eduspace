import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { crmApi } from "../api/crm.api";
import { useLocale } from "../../../i18n/useLocale";
import AppShell from "../../../components/layout/AppShell";
import Spinner from "../../../components/ui/Spinner";
import Button from "../../../components/ui/Button";
import { Printer, ArrowLeft, CheckCircle, Clock, AlertTriangle, Receipt, FileText } from "lucide-react";

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const id = parseInt(invoiceId || "0");

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => crmApi.getInvoice(id),
    enabled: id > 0,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <AppShell title="...">
        <div className="flex justify-center p-16">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  if (error || !invoice) {
    return (
      <AppShell title={isFarsi ? "فاکتور یافت نشد" : "Invoice Not Found"}>
        <div className="p-12 text-center flex flex-col items-center gap-4">
          <div className="text-4xl text-[var(--red)]">⚠️</div>
          <p className="text-[var(--t2)] font-medium">
            {isFarsi ? "فاکتور مالی مورد نظر یافت نشد یا شما دسترسی ندارید." : "The requested invoice was not found or you do not have permission to view it."}
          </p>
          <Link to="/finance/ledger">
            <Button variant="secondary">{isFarsi ? "بازگشت به دفتر مالی" : "Back to Ledger"}</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const statusColors: Record<string, string> = {
    paid: "bg-green-500/10 text-green-500 border-green-500/20",
    unpaid: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    partial: "bg-sky-500/10 text-sky-500 border-sky-500/20",
    overdue: "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse",
    cancelled: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    refunded: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  };

  const statusLabels: Record<string, string> = {
    paid: isFarsi ? "پرداخت شده" : "Paid",
    unpaid: isFarsi ? "پرداخت نشده" : "Unpaid",
    partial: isFarsi ? "پرداخت شده (بخشی)" : "Partially Paid",
    overdue: isFarsi ? "سررسید گذشته" : "Overdue",
    cancelled: isFarsi ? "لغو شده" : "Cancelled",
    refunded: isFarsi ? "استرداد شده" : "Refunded",
  };

  const paymentMethods: Record<string, string> = {
    cash: isFarsi ? "نقدی" : "Cash",
    bank_transfer: isFarsi ? "کارت به کارت / حواله" : "Bank Transfer",
    online: isFarsi ? "پرداخت آنلاین" : "Online Payment",
  };

  // Safe parsing of items or fallback
  const items = invoice.items || [];
  const totalAmount = parseFloat(invoice.amount);

  return (
    <AppShell title={invoice.invoice_number || `#${invoice.id}`}>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice-area, #printable-invoice-area * {
            visibility: visible;
          }
          #printable-invoice-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        {/* Breadcrumb & Actions */}
        <div className="flex items-center justify-between no-print">
          <div className="flex items-center gap-2 text-xs text-[var(--t3)]">
            <Link to="/finance/ledger" className="hover:text-[var(--brand)] transition-colors flex items-center gap-1 no-underline">
              <ArrowLeft className="w-3.5 h-3.5" />
              {isFarsi ? "بازگشت به دفتر مالی" : "Back to Ledger"}
            </Link>
            <span>/</span>
            <span className="text-[var(--t1)] font-medium">
              {isFarsi ? `جزئیات فاکتور ${invoice.invoice_number || invoice.id}` : `Invoice Details ${invoice.invoice_number || invoice.id}`}
            </span>
          </div>

          <Button onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            {isFarsi ? "چاپ فاکتور" : "Print Invoice"}
          </Button>
        </div>

        {/* Invoice Detail Sheet Card */}
        <div 
          id="printable-invoice-area" 
          className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-8 transition-all hover:shadow-md"
        >
          {/* Header row: Branding and Invoice # */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-[var(--b)]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-black text-[var(--brand)]">🚀</span>
                <span className="text-xl font-bold tracking-tight text-[var(--t1)]">EduSpace</span>
              </div>
              <p className="text-xs text-[var(--t3)]">
                {isFarsi ? "سیستم مدیریت آموزشی و لجر مالی" : "Educational Management & Financial Ledger"}
              </p>
            </div>

            <div className="text-left md:text-right flex flex-col gap-1">
              <h2 className="text-lg font-bold text-[var(--t1)] flex items-center gap-1.5 md:justify-end">
                <FileText className="w-4 h-4 text-[var(--brand)]" />
                {isFarsi ? "فاکتور شهریه" : "Tuition Invoice"}
              </h2>
              <p className="text-sm font-mono text-[var(--t2)] font-semibold">{invoice.invoice_number || `#${invoice.id}`}</p>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusColors[invoice.status] || "bg-[var(--s3)]"}`}>
                  {invoice.status === "paid" ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  {statusLabels[invoice.status] || invoice.status}
                </span>
              </div>
            </div>
          </div>

          {/* Details Row: Billed To / From */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-[var(--b)]">
            <div className="flex flex-col gap-2 text-left">
              <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">
                {isFarsi ? "صورت‌حساب به نام:" : "Billed To:"}
              </span>
              <div>
                <h3 className="text-sm font-bold text-[var(--t1)]">{invoice.student_full_name || invoice.student_username}</h3>
                <p className="text-xs text-[var(--t3)]">@{invoice.student_username}</p>
                {invoice.class_name && (
                  <p className="text-xs text-[var(--t2)] mt-1">
                    {isFarsi ? "کلاس آموزشی: " : "Class: "}
                    <strong className="text-[var(--brand-text)]">{invoice.class_name}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 text-left md:text-right">
              <span className="text-[10px] font-bold text-[var(--t3)] uppercase tracking-wider">
                {isFarsi ? "مشخصات فاکتور:" : "Invoice Info:"}
              </span>
              <div className="text-xs text-[var(--t2)] space-y-1">
                <p>
                  {isFarsi ? "تاریخ صدور: " : "Date Issued: "}
                  <span className="font-mono">{new Date(invoice.created_at).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}</span>
                </p>
                {invoice.due_date && (
                  <p>
                    {isFarsi ? "مهلت پرداخت: " : "Due Date: "}
                    <span className="font-mono text-[var(--amber)] font-semibold">
                      {new Date(invoice.due_date).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}
                    </span>
                  </p>
                )}
                {invoice.paid_at && (
                  <p>
                    {isFarsi ? "تاریخ پرداخت: " : "Paid At: "}
                    <span className="font-mono text-[var(--green)]">
                      {new Date(invoice.paid_at).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}
                    </span>
                  </p>
                )}
                {invoice.payment_method && (
                  <p>
                    {isFarsi ? "روش پرداخت: " : "Payment Method: "}
                    <span className="font-semibold">{paymentMethods[invoice.payment_method] || invoice.payment_method}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Itemized list table */}
          <div>
            <h3 className="text-xs font-bold text-[var(--t3)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-[var(--brand)]" />
              {isFarsi ? "جزئیات آیتم‌های فاکتور" : "Itemized Line Items"}
            </h3>
            <div className="border border-[var(--b)] rounded-xl overflow-hidden">
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--s3)] border-b border-[var(--b)] text-[var(--t3)] font-bold uppercase text-left">
                    <th className="p-3">#</th>
                    <th className="p-3">{isFarsi ? "شرح خدمات" : "Description"}</th>
                    <th className="p-3 text-center">{isFarsi ? "تعداد" : "Qty"}</th>
                    <th className="p-3 text-right">{isFarsi ? "قیمت واحد" : "Unit Price"}</th>
                    <th className="p-3 text-right">{isFarsi ? "جمع کل" : "Total"}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? (
                    items.map((item, index) => (
                      <tr key={index} className="border-b border-[var(--b)] last:border-0 hover:bg-[var(--s3)]/30 text-left">
                        <td className="p-3 text-[var(--t3)] font-mono">{index + 1}</td>
                        <td className="p-3 text-[var(--t1)] font-medium">{item.description}</td>
                        <td className="p-3 text-center text-[var(--t2)] font-mono">{item.quantity}</td>
                        <td className="p-3 text-right text-[var(--t2)] font-mono">${parseFloat(item.unit_price).toFixed(2)}</td>
                        <td className="p-3 text-right font-semibold text-[var(--t1)] font-mono">
                          ${(item.quantity * parseFloat(item.unit_price)).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    // Fallback to a single line item using the invoice amount
                    <tr className="border-b border-[var(--b)] last:border-0 text-left">
                      <td className="p-3 text-[var(--t3)] font-mono">1</td>
                      <td className="p-3 text-[var(--t1)] font-medium">
                        {isFarsi
                          ? `شهریه تحصیلی کلاس آموزشی ${invoice.class_name || ""}`
                          : `Tuition Fee for Academy Class: ${invoice.class_name || "Enrollment"}`}
                      </td>
                      <td className="p-3 text-center text-[var(--t2)] font-mono">1</td>
                      <td className="p-3 text-right text-[var(--t2)] font-mono">${totalAmount.toFixed(2)}</td>
                      <td className="p-3 text-right font-semibold text-[var(--t1)] font-mono">${totalAmount.toFixed(2)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals Section */}
          <div className="flex flex-col items-end gap-2 text-xs">
            <div className="w-full md:w-64 border border-[var(--b)] rounded-xl p-4 flex flex-col gap-2 bg-[var(--s3)]">
              <div className="flex justify-between items-center">
                <span className="text-[var(--t3)]">{isFarsi ? "جمع جزئی:" : "Subtotal:"}</span>
                <span className="font-mono text-[var(--t2)]">${totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-[var(--b)] pt-2 font-bold text-sm">
                <span className="text-[var(--t1)]">{isFarsi ? "مبلغ قابل پرداخت:" : "Total Payable:"}</span>
                <span className="font-mono text-[var(--brand-text)]">${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {invoice.notes && (
            <div className="bg-[var(--brand-soft)] border border-[var(--b)] p-4 rounded-xl text-xs text-[var(--t2)] text-left flex gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--brand)] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-[var(--t1)] mb-1">{isFarsi ? "توضیحات و شرایط فاکتور:" : "Invoice Notes & Details:"}</strong>
                <p className="leading-relaxed">{invoice.notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
