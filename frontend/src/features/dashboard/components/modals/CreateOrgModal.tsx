import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authApi } from "@/features/auth/api/auth.api";
import { useOrgContextStore } from "@/features/auth/store/orgContextStore";
import { createOrgSchema, type CreateOrgFormData } from "@/features/auth/schemas/auth.schemas";
import { toast } from "react-hot-toast";

export interface CreateOrgModalProps {
  open: boolean;
  onClose: () => void;
  isFarsi?: boolean;
}

export const CreateOrgModal: React.FC<CreateOrgModalProps> = ({
  open,
  onClose,
  isFarsi = false,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateOrgFormData>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: { name: "" },
  });

  if (!open) return null;

  const onSubmit = async (data: CreateOrgFormData) => {
    try {
      const newOrg = await authApi.createOrganization(data.name);
      toast.success(
        isFarsi ? "سازمان با موفقیت ایجاد شد." : "Organization created successfully!"
      );
      reset();
      onClose();
      const { fetchOrgContext } = useOrgContextStore.getState();
      await fetchOrgContext(newOrg.slug);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; detail?: string } } };
      setError("name", {
        message:
          error.response?.data?.error ||
          error.response?.data?.detail ||
          "Failed to create organization",
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
        <h3 className="text-lg font-bold text-[var(--t1)]">
          {isFarsi ? "ایجاد سازمان جدید" : "Create New Organization"}
        </h3>
        {errors.name?.message && (
          <div className="p-3 bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-xl text-xs text-[var(--red)] flex items-center gap-1.5 animate-in fade-in">
            <span>⚠️</span>
            <span>{errors.name.message}</span>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label={isFarsi ? "نام سازمان" : "Organization Name"}
            placeholder={isFarsi ? "آکادمی من" : "My Academy"}
            error={errors.name?.message}
            autoFocus
            {...register("name")}
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
              {isFarsi ? "ایجاد" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrgModal;
