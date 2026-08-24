import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { authApi } from "../../auth/api/auth.api";
import { useAuthStore } from "../../auth/store/authStore";
import { useOrgContextStore } from "../../auth/store/orgContextStore";
import { useLocale } from "../../../i18n/useLocale";
import Spinner from "../../../components/ui/Spinner";
import Button from "../../../components/ui/Button";

export default function JoinOrgPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const navigate = useNavigate();
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function doJoin() {
      if (!orgSlug) {
        setStatus("error");
        setMessage(isFarsi ? "شناسه سازمان نامعتبر است." : "Invalid organization identifier.");
        return;
      }

      try {
        const res = await authApi.joinOrganization(orgSlug);
        if (!active) return;
        
        setStatus("success");
        setMessage(
          res.message || 
          (isFarsi 
            ? "درخواست عضویت شما با موفقیت ثبت شد." 
            : "Your request to join has been successfully submitted.")
        );
        
        toast.success(
          res.message || 
          (isFarsi ? "عضویت با موفقیت انجام شد." : "Joined successfully!")
        );

        // Fetch new user info and org context
        await useAuthStore.getState().fetchMe();
        const { fetchOrgContext } = useOrgContextStore.getState();
        await fetchOrgContext(orgSlug);

        // Redirect after a short delay
        setTimeout(() => {
          if (active) {
            navigate("/dashboard");
          }
        }, 3000);
      } catch (err: any) {
        if (!active) return;
        setStatus("error");
        const errMsg = err.response?.data?.error || err.response?.data?.detail || "Failed to join organization";
        setMessage(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
      }
    }

    doJoin();

    return () => {
      active = false;
    };
  }, [orgSlug, isFarsi, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--s0)] text-[var(--t1)] p-6">
      <div className="bg-[var(--s2)] border border-[var(--b)] rounded-2xl p-8 max-w-md w-full text-center shadow-lg flex flex-col items-center gap-6">
        <h2 className="text-xl font-bold text-[var(--t1)]">
          {isFarsi ? "عضویت در آکادمی" : "Joining Academy"}
        </h2>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-[var(--t2)]">
              {isFarsi ? "در حال پردازش درخواست عضویت..." : "Processing your join request..."}
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <span className="text-5xl">🎉</span>
            <p className="text-sm text-[var(--green)] font-semibold">{message}</p>
            <p className="text-xs text-[var(--t3)]">
              {isFarsi 
                ? "درحال انتقال به داشبورد..." 
                : "Redirecting to your dashboard..."}
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <span className="text-5xl">⚠️</span>
            <p className="text-sm text-[var(--red)] font-semibold">{message}</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-2">
              {isFarsi ? "بازگشت به داشبورد" : "Back to Dashboard"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
