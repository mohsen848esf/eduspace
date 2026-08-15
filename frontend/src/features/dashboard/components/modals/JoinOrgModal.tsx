import React, { useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useOrgContextStore } from "@/features/auth/store/orgContextStore";
import { toast } from "react-hot-toast";

export interface JoinOrgModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isFarsi?: boolean;
}

export const JoinOrgModal: React.FC<JoinOrgModalProps> = ({
  open,
  onClose,
  onSuccess,
  isFarsi = false,
}) => {
  const [orgCodeOrSlug, setOrgCodeOrSlug] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgCodeOrSlug.trim()) return;
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const res = await authApi.joinOrganization(orgCodeOrSlug);
      toast.success(
        res.message ||
          (isFarsi ? "درخواست عضویت ارسال شد." : "Join request submitted.")
      );
      setOrgCodeOrSlug("");
      onClose();

      if (res.auto_joined) {
        await useAuthStore.getState().fetchMe();
        const { fetchOrgContext } = useOrgContextStore.getState();
        await fetchOrgContext(orgCodeOrSlug);
      } else {
        onSuccess?.();
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; detail?: string } } };
      setErrorMsg(
        error.response?.data?.error ||
          error.response?.data?.detail ||
          "Failed to join organization"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
        <h3 className="text-lg font-bold text-[var(--t1)]">
          {isFarsi ? "پیوستن به سازمان" : "Join Organization"}
        </h3>
        <p className="text-xs text-[var(--t2)] leading-relaxed">
          {isFarsi
            ? "کد دعوت ۸ رقمی یا شناسه (Slug) سازمانی که می‌خواهید به آن ملحق شوید را وارد کنید."
            : "Enter the 8-digit invite code or the organization slug you wish to join."}
        </p>
        {errorMsg && (
          <div className="p-3 bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-xl text-xs text-[var(--red)] flex items-center gap-1.5 animate-in fade-in">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={isFarsi ? "کد دعوت یا شناسه (Slug)" : "Invite Code or Slug"}
            placeholder={isFarsi ? "مثال: EDU-1234 یا my-academy" : "e.g. EDU-1234 or my-academy"}
            value={orgCodeOrSlug}
            onChange={(e) => setOrgCodeOrSlug(e.target.value)}
            required
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onClose();
                setErrorMsg("");
              }}
              disabled={isSubmitting}
            >
              {isFarsi ? "لغو" : "Cancel"}
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isFarsi ? "پیوستن" : "Join"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinOrgModal;
