import { useEffect, useState } from "react";
import AppShell from "../../../components/layout/AppShell";
import { billingApi } from "../api/billing.api";
import type { OrganizationSubscription, SubscriptionPlan } from "../api/billing.api";
import BillingDashboard from "./BillingDashboard";
import {
  CheckCircle,
  AlertCircle,
  Users,
  Database,
  Video,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  Flame,
  LayoutDashboard,
  Receipt,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";

type TabId = "plans_usage" | "invoices_billing";

export default function SubscriptionPage() {
  const [activeTab, setActiveTab] = useState<TabId>("plans_usage");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState<string | null>(null);
  const [isPortalLoading, setIsPortalLoading] = useState(false);

  async function loadBillingData() {
    try {
      setLoading(true);
      const [plansData, subData] = await Promise.all([
        billingApi.getPlans(),
        billingApi.getSubscription(),
      ]);
      setPlans(plansData);
      setSubscription(subData);
    } catch (err: any) {
      console.error("Failed to load subscription details", err);
      setError("Failed to retrieve subscription configuration. Check connection or organization slug.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBillingData();
  }, []);

  const handlePortalRedirect = async () => {
    try {
      setIsPortalLoading(true);
      const res = await billingApi.createCustomerPortal({
        return_url: window.location.href,
      });
      window.location.href = res.portal_url;
    } catch (err: any) {
      console.error("Portal error", err);
      toast.error(err.response?.data?.detail || "Failed to launch customer portal.");
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (plan.slug === subscription?.plan_details?.slug) {
      toast.success("You are already on this plan!");
      return;
    }

    try {
      setIsCheckoutLoading(plan.slug);
      // Stripe requires a price ID in production, in dev/mock we can pass a dummy one.
      const priceId = plan.slug === "starter" ? "price_starter_monthly" : `price_${plan.slug}_monthly`;
      
      const res = await billingApi.createCheckoutSession({
        price_id: priceId,
        plan_slug: plan.slug,
        return_url: window.location.origin + "/settings/billing?checkout_success=true",
      });
      
      toast.loading("Redirecting to checkout session...");
      window.location.href = res.checkout_url;
    } catch (err: any) {
      console.error("Checkout session failed", err);
      toast.error(err.response?.data?.detail || "Checkout session initialization failed.");
    } finally {
      setIsCheckoutLoading(null);
    }
  };

  // Check URL parameters for billing feedback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout_success") === "true") {
      toast.success("Subscription updated successfully!");
      // Clean query parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      loadBillingData();
    } else if (params.get("canceled") === "true") {
      toast.error("Checkout process canceled.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
      case "trialing":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
            <CheckCircle className="w-3.5 h-3.5" />
            Active
          </span>
        );
      case "past_due":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <AlertCircle className="w-3.5 h-3.5" />
            Past Due
          </span>
        );
      case "read_only":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            Read Only Block
          </span>
        );
      case "downgraded":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            Downgraded to Free
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">
            <HelpCircle className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <AppShell title="Billing & Subscriptions" subtitle="Manage your SaaS subscription plan and invoicing records" activeNav="billing">
        <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
          <div className="w-12 h-12 border-4 border-[var(--brand-soft)] border-t-[var(--brand)] rounded-full animate-spin" />
          <p className="text-[var(--t2)] text-sm font-semibold animate-pulse">Loading billing services...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !subscription) {
    return (
      <AppShell title="Billing & Subscriptions" subtitle="Manage your SaaS subscription plan and invoicing records" activeNav="billing">
        <div className="p-8 rounded-2xl bg-red-500/5 border border-red-500/20 max-w-xl mx-auto text-center space-y-4 shadow-lg my-12">
          <AlertCircle className="w-12 h-12 text-[var(--red)] mx-auto" />
          <h3 className="text-lg font-bold text-[var(--t1)]">Configuration Mismatch</h3>
          <p className="text-[var(--t2)] text-sm">{error || "Subscription dataset unavailable."}</p>
          <button
            onClick={loadBillingData}
            className="px-5 py-2.5 bg-[var(--brand)] hover:bg-[var(--brand-h)] text-white text-sm font-semibold rounded-xl transition-all cursor-pointer"
          >
            Retry Synchronization
          </button>
        </div>
      </AppShell>
    );
  }

  // Calculate usage percentages for meter bars
  const { quota, usage } = subscription;
  const metrics = [
    {
      name: "Students Limit",
      icon: <Users className="w-5 h-5" />,
      used: usage?.students_count ?? 0,
      limit: quota?.max_students ?? 100,
      percentage: Math.min(100, ((usage?.students_count ?? 0) / (quota?.max_students ?? 100)) * 100),
      format: (used: number, limit: number) => `${used} / ${limit} active`,
    },
    {
      name: "Teachers & Admins",
      icon: <Users className="w-5 h-5 text-indigo-400" />,
      used: usage?.teachers_count ?? 0,
      limit: quota?.max_teachers ?? 10,
      percentage: Math.min(100, ((usage?.teachers_count ?? 0) / (quota?.max_teachers ?? 10)) * 100),
      format: (used: number, limit: number) => `${used} / ${limit} active`,
    },
    {
      name: "Courses Creation",
      icon: <BookOpen className="w-5 h-5 text-cyan-400" />,
      used: usage?.courses_count ?? 0,
      limit: quota?.max_courses ?? 10,
      percentage: Math.min(100, ((usage?.courses_count ?? 0) / (quota?.max_courses ?? 10)) * 100),
      format: (used: number, limit: number) => `${used} / ${limit} active`,
    },
    {
      name: "S3 Storage Allocation",
      icon: <Database className="w-5 h-5 text-emerald-400" />,
      used: usage?.storage_used_gb ?? 0,
      limit: quota?.max_storage_gb ?? 5,
      percentage: Math.min(100, ((usage?.storage_used_gb ?? 0) / (quota?.max_storage_gb ?? 5)) * 100),
      format: (used: number, limit: number) => `${used.toFixed(2)} GB / ${limit} GB`,
    },
    {
      name: "Recording Minutes",
      icon: <Video className="w-5 h-5 text-rose-400" />,
      used: usage?.recording_minutes_used ?? 0,
      limit: quota?.max_recording_minutes ?? 120,
      percentage: Math.min(100, ((usage?.recording_minutes_used ?? 0) / (quota?.max_recording_minutes ?? 120)) * 100),
      format: (used: number, limit: number) => `${used} / ${limit} minutes`,
    },
    {
      name: "Simultaneous Live Sessions",
      icon: <Flame className="w-5 h-5 text-amber-400" />,
      used: usage?.active_sessions_count ?? 0,
      limit: quota?.max_active_sessions ?? 5,
      percentage: Math.min(100, ((usage?.active_sessions_count ?? 0) / (quota?.max_active_sessions ?? 5)) * 100),
      format: (used: number, limit: number) => `${used} / ${limit} live`,
    },
  ];

  return (
    <AppShell title="Billing & Subscriptions" subtitle="Scale limits dynamically or review past billing periods" activeNav="billing">
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Read-Only Restriction Banner */}
        {subscription.status === "read_only" && (
          <div className="flex items-start gap-4 p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-[var(--red)] shadow-lg animate-pulse">
            <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-base">Academy Read-Only Restrictions Active</h4>
              <p className="text-sm opacity-90 leading-relaxed">
                Your subscription was restricted to Read-Only mode due to consecutive payment issues. Creation of courses, members, exams, or sessions is currently blocked. To restore service immediately, click "Stripe Customer Billing Portal" under the Invoice History tab to update your credit card details.
              </p>
            </div>
          </div>
        )}

        {/* Tab Headers */}
        <div className="flex border-b border-[var(--b)] gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setActiveTab("plans_usage")}
            className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === "plans_usage"
                ? "border-[var(--brand)] text-[var(--brand-text)] bg-[var(--brand-soft)]/20"
                : "border-transparent text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s2)]/40"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Plans & Quotas</span>
          </button>
          <button
            onClick={() => setActiveTab("invoices_billing")}
            className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === "invoices_billing"
                ? "border-[var(--brand)] text-[var(--brand-text)] bg-[var(--brand-soft)]/20"
                : "border-transparent text-[var(--t2)] hover:text-[var(--t1)] hover:bg-[var(--s2)]/40"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Billing & Invoices</span>
          </button>
        </div>

        {/* Tab Body */}
        {activeTab === "plans_usage" ? (
          <div className="space-y-8 fade-in">
            {/* Active Subscription Overview Card */}
            <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-[var(--s1)] via-[var(--s1)] to-[var(--s2)] border border-[var(--b)] shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--brand-soft)]/30 rounded-full blur-3xl -z-10 pointer-events-none transform translate-x-20 -translate-y-20" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-wider text-[var(--brand-text)] font-extrabold bg-[var(--brand-soft)] px-2.5 py-1 rounded-md">
                      Current Subscription
                    </span>
                    {getStatusBadge(subscription.status)}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-[var(--t1)] tracking-tight">
                    {subscription.plan_details?.name || "Free Plan"}
                  </h2>
                  <p className="text-[var(--t2)] text-sm max-w-xl leading-relaxed">
                    Enjoying expanded system resources under the {subscription.plan_details?.name || "Free Plan"} configuration. Manage additional resources below.
                  </p>
                </div>

                <div className="shrink-0 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handlePortalRedirect}
                    disabled={isPortalLoading}
                    className="px-5 py-3 rounded-xl font-semibold bg-[var(--s2)] text-[var(--t1)] hover:bg-[var(--s3)] border border-[var(--b)] hover:border-[var(--brand)]/30 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    Manage Cards
                  </button>
                  <a
                    href="#plans-grid"
                    className="px-5 py-3 rounded-xl font-semibold bg-[var(--brand)] text-white hover:bg-[var(--brand-h)] transition-all duration-200 text-center shadow-md shadow-indigo-950/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Upgrade Limits</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* Quota Limits & Usage Meters Grid */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[var(--t1)]">System Limits & Resource Usage</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {metrics.map((m) => {
                  const isWarning = m.percentage > 85;
                  const isDanger = m.percentage >= 100;
                  return (
                    <div
                      key={m.name}
                      className="p-5 rounded-2xl bg-[var(--s1)] border border-[var(--b)] hover:border-[var(--brand)]/20 hover:shadow-md transition-all duration-200 space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-semibold text-[var(--t2)]">{m.name}</span>
                        <div className="p-2 rounded-lg bg-[var(--s2)] text-[var(--t2)]">{m.icon}</div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-end">
                          <span className={`text-base font-bold ${isDanger ? "text-[var(--red)]" : "text-[var(--t1)]"}`}>
                            {m.format(m.used, m.limit)}
                          </span>
                          <span className="text-xs text-[var(--t2)] font-medium">
                            {Math.round(m.percentage)}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-[var(--s3)] rounded-full overflow-hidden">
                          <div
                            style={{ width: `${m.percentage}%` }}
                            className={`h-full rounded-full transition-all duration-500 ease-out ${
                              isDanger
                                ? "bg-red-500"
                                : isWarning
                                ? "bg-amber-500"
                                : "bg-gradient-to-r from-[var(--brand)] to-cyan-400"
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Plans Comparative Grid */}
            <div id="plans-grid" className="space-y-6 pt-4">
              <div className="text-center max-w-xl mx-auto space-y-2">
                <h3 className="text-2xl font-extrabold text-[var(--t1)] tracking-tight">Flexible SaaS Subscription Plans</h3>
                <p className="text-[var(--t2)] text-sm">
                  Subscribe to a package suited to your academy scale, and instantly unlock wider bounds.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                {plans.map((p) => {
                  const isActive = p.slug === subscription.plan_details?.slug;
                  return (
                    <div
                      key={p.id}
                      className={`p-6 rounded-3xl bg-[var(--s1)] border transition-all duration-300 flex flex-col justify-between hover:shadow-xl ${
                        isActive
                          ? "border-[var(--brand)] shadow-lg ring-1 ring-[var(--brand)]"
                          : "border-[var(--b)] hover:border-[var(--brand)]/30"
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-lg text-[var(--t1)]">{p.name}</h4>
                            {isActive && (
                              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--brand)]/20">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex items-baseline gap-1 mt-2">
                            <span className="text-3xl font-extrabold text-[var(--t1)]">
                              ${p.monthly_price}
                            </span>
                            <span className="text-xs text-[var(--t2)]">/month</span>
                          </div>
                        </div>

                        {/* Limits Checklist */}
                        <div className="space-y-3 pt-4 border-t border-[var(--b)]/50">
                          <div className="flex items-center gap-2 text-sm text-[var(--t1)]">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{p.max_students} students</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[var(--t1)]">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{p.max_teachers} teachers</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[var(--t1)]">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{p.max_courses} courses</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[var(--t1)]">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{p.max_storage_gb} GB storage</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[var(--t1)]">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{p.max_recording_minutes} rec mins</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[var(--t1)]">
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>{p.max_active_sessions} live sessions</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 pt-4">
                        <button
                          onClick={() => handleSubscribe(p)}
                          disabled={isActive || isCheckoutLoading !== null}
                          className={`w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            isActive
                              ? "bg-[var(--s2)] text-[var(--t3)] border border-[var(--b)] cursor-not-allowed"
                              : "bg-[var(--brand)] text-white hover:bg-[var(--brand-h)] shadow-md shadow-indigo-950/20 disabled:opacity-50"
                          }`}
                        >
                          {isCheckoutLoading === p.slug ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                          ) : isActive ? (
                            "Your Active Plan"
                          ) : p.monthly_price === 0 ? (
                            "Switch to Free"
                          ) : (
                            "Subscribe"
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <BillingDashboard
            subscription={subscription}
            onPortalRedirect={handlePortalRedirect}
            isPortalLoading={isPortalLoading}
          />
        )}
      </div>
    </AppShell>
  );
}
