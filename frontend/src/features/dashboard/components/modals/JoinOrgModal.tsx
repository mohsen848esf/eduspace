import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authApi } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useOrgContextStore } from "@/features/auth/store/orgContextStore";
import { joinOrgSchema, type JoinOrgFormData } from "@/features/auth/schemas/auth.schemas";
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<JoinOrgFormData>({
    resolver: zodResolver(joinOrgSchema),
    defaultValues: { codeOrSlug: "" },
  });

  if (!open) return null;

  const onSubmit = async (data: JoinOrgFormData) => {
    try {
      const res = await authApi.joinOrganization(data.codeOrSlug);
      toast.success(
        res.message ||
          (isFarsi ? "درخواست عضویت ارسال شد." : "Join request submitted.")
      );
      reset();
      onClose();

      if (res.auto_joined) {
        await useAuthStore.getState().fetchMe();
        const { fetchOrgContext } = useOrgContextStore.getState();
        await fetchOrgContext(data.codeOrSlug);
      } else {
        onSuccess?.();
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; detail?: string } } };
      setError("codeOrSlug", {
        message:
          error.response?.data?.error ||
          error.response?.data?.detail ||
          "Failed to join organization",
      });
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
        {errors.codeOrSlug?.message && (
          <div className="p-3 bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-xl text-xs text-[var(--red)] flex items-center gap-1.5 animate-in fade-in">
            <span>⚠️</span>
            <span>{errors.codeOrSlug.message}</span>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label={isFarsi ? "کد دعوت یا شناسه (Slug)" : "Invite Code or Slug"}
            placeholder={
              isFarsi ? "مثال: EDU-1234 یا my-academy" : "e.g. EDU-1234 or my-academy"
            }
            error={errors.codeOrSlug?.message}
            autoFocus
            {...register("codeOrSlug")}
          />
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset();
                onClose();
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
