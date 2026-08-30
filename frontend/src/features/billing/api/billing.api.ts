import client from "../../../lib/api/client";

export interface SubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  monthly_price: number;
  yearly_price: number;
  max_students: number;
  max_teachers: number;
  max_courses: number;
  max_storage_gb: number;
  max_recording_minutes: number;
  max_active_sessions: number;
  is_active: boolean;
}

export interface OrganizationQuota {
  max_students: number;
  max_teachers: number;
  max_courses: number;
  max_storage_gb: number;
  max_recording_minutes: number;
  max_active_sessions: number;
}

export interface OrganizationUsage {
  students_count: number;
  teachers_count: number;
  courses_count: number;
  storage_used_gb: number;
  recording_minutes_used: number;
  active_sessions_count: number;
}

export interface OrganizationSubscription {
  id: number;
  organization: number;
  organization_name: string;
  plan: number;
  plan_details: SubscriptionPlan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: "trialing" | "active" | "past_due" | "unpaid" | "canceled" | "downgraded" | "read_only";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  payment_failed_at: string | null;
  created_at: string;
  updated_at: string;
  quota?: OrganizationQuota;
  usage?: OrganizationUsage;
}

export interface BillingInvoice {
  id: number;
  organization: number;
  organization_name: string;
  amount: string;
  currency: string;
  stripe_invoice_id: string;
  status: string;
  invoice_pdf_url: string | null;
  issued_at: string;
  created_at: string;
}

export const billingApi = {
  getPlans: async (): Promise<SubscriptionPlan[]> => {
    const res = await client.get("/billing/plans/");
    return res.data;
  },

  getSubscription: async (): Promise<OrganizationSubscription> => {
    const res = await client.get("/billing/subscription/");
    return res.data;
  },

  createCheckoutSession: async (data: {
    price_id: string;
    plan_slug: string;
    return_url: string;
  }): Promise<{ checkout_url: string }> => {
    const res = await client.post("/billing/checkout/", data);
    return res.data;
  },

  createCustomerPortal: async (data: {
    return_url: string;
  }): Promise<{ portal_url: string }> => {
    const res = await client.post("/billing/customer-portal/", data);
    return res.data;
  },

  getInvoices: async (): Promise<BillingInvoice[]> => {
    const res = await client.get("/billing/invoices/");
    return res.data;
  },
};
