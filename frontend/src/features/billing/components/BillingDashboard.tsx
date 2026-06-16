import { useEffect, useState } from "react";
import { billingApi } from "../api/billing.api";
import type { OrganizationSubscription, BillingInvoice } from "../api/billing.api";
import { Download, CreditCard, Calendar, AlertCircle } from "lucide-react";

interface BillingDashboardProps {
  subscription: OrganizationSubscription | null;
  onPortalRedirect: () => void;
  isPortalLoading: boolean;
}

export default function BillingDashboard({
  subscription,
  onPortalRedirect,
  isPortalLoading,
}: BillingDashboardProps) {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        setLoading(true);
        const data = await billingApi.getInvoices();
        setInvoices(data);
      } catch (err: any) {
        console.error("Failed to load invoices", err);
        setError("Failed to load billing history. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "open":
      case "pending":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
      case "failed":
      case "unpaid":
        return "bg-red-500/10 text-red-400 border border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-400 border border-gray-500/20";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-[var(--s1)] border border-[var(--b)] hover:border-[var(--brand)]/30 transition-all duration-300 shadow-lg flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--t1)] text-lg">Payment Method & Invoices</h3>
                <p className="text-[var(--t2)] text-sm">Update payment methods, view invoices, or change plan limits.</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-[var(--b)]">
            <button
              onClick={onPortalRedirect}
              disabled={isPortalLoading}
              className="w-full md:w-auto px-5 py-3 rounded-xl font-medium bg-[var(--brand)] text-white hover:bg-[var(--brand-h)] transition-all duration-200 shadow-md shadow-indigo-950/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPortalLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Redirecting...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Stripe Customer Billing Portal</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[var(--s1)] border border-[var(--b)] hover:border-[var(--brand)]/30 transition-all duration-300 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--t1)] text-lg">Billing Info & Renewal</h3>
              <p className="text-[var(--t2)] text-sm">Subscription terms and scheduling details.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-[var(--b)]/50">
              <span className="text-[var(--t2)] text-sm">Renewal Cycle</span>
              <span className="text-[var(--t1)] font-medium text-sm">Monthly</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-[var(--b)]/50">
              <span className="text-[var(--t2)] text-sm">Renewal Date</span>
              <span className="text-[var(--t1)] font-medium text-sm">
                {subscription?.current_period_end ? formatDate(subscription.current_period_end) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-[var(--t2)] text-sm">Auto-Renewal</span>
              <span className={`text-sm font-semibold ${subscription?.cancel_at_period_end ? "text-[var(--amber)]" : "text-emerald-400"}`}>
                {subscription?.cancel_at_period_end ? "Disabled (Ends at period close)" : "Enabled"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      <div className="p-6 rounded-2xl bg-[var(--s1)] border border-[var(--b)] shadow-lg">
        <h3 className="font-semibold text-[var(--t1)] text-lg mb-6">Invoice History</h3>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="w-10 h-10 border-4 border-[var(--brand-soft)] border-t-[var(--brand)] rounded-full animate-spin" />
            <p className="text-[var(--t2)] text-sm font-medium animate-pulse">Fetching invoices...</p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[var(--red)]">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-[var(--b)] rounded-2xl">
            <CreditCard className="w-12 h-12 text-[var(--t3)] mb-4" />
            <h4 className="font-medium text-[var(--t1)] mb-1">No Invoices Found</h4>
            <p className="text-[var(--t2)] text-sm max-w-sm">No transaction statements are currently recorded for this academy.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--b)]">
                  <th className="py-4 text-xs font-semibold text-[var(--t2)] uppercase tracking-wider">Invoice ID</th>
                  <th className="py-4 text-xs font-semibold text-[var(--t2)] uppercase tracking-wider">Date Issued</th>
                  <th className="py-4 text-xs font-semibold text-[var(--t2)] uppercase tracking-wider">Amount</th>
                  <th className="py-4 text-xs font-semibold text-[var(--t2)] uppercase tracking-wider">Status</th>
                  <th className="py-4 text-xs font-semibold text-[var(--t2)] uppercase tracking-wider text-right">Invoice PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--b)]/50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[var(--s2)]/40 transition-colors duration-150">
                    <td className="py-4 text-sm font-medium text-[var(--t1)]">
                      {inv.stripe_invoice_id.substring(0, 14)}...
                    </td>
                    <td className="py-4 text-sm text-[var(--t2)]">
                      {formatDate(inv.issued_at)}
                    </td>
                    <td className="py-4 text-sm font-medium text-[var(--t1)]">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: inv.currency || "USD",
                      }).format(parseFloat(inv.amount))}
                    </td>
                    <td className="py-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-right">
                      {inv.invoice_pdf_url ? (
                        <a
                          href={inv.invoice_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--brand)] hover:text-[var(--brand-h)] hover:underline font-semibold"
                        >
                          <Download className="w-4 h-4" />
                          <span>PDF</span>
                        </a>
                      ) : (
                        <span className="text-[var(--t3)] text-xs">Generating...</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
