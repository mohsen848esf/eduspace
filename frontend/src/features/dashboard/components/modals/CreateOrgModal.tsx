import React, { useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { authApi } from "@/features/auth/api/auth.api";
import { useOrgContextStore } from "@/features/auth/store/orgContextStore";
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
  const [orgName, setOrgName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const newOrg = await authApi.createOrganization(orgName);
      toast.success(
        isFarsi ? "سازمان با موفقیت ایجاد شد." : "Organization created successfully!"
      );
      setOrgName("");
      onClose();
      const { fetchOrgContext } = useOrgContextStore.getState();
      await fetchOrgContext(newOrg.slug);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string; detail?: string } } };
      setErrorMsg(
        error.response?.data?.error ||
          error.response?.data?.detail ||
          "Failed to create organization"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--s1)] border border-[var(--b)] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
        <h3 className="text-lg font-bold text-[var(--t1)]">
          {isFarsi ? "ایجاد سازمان جدید" : "Create New Organization"}
        </h3>
        {errorMsg && (
          <div className="p-3 bg-[var(--red)]/10 border border-[var(--red)]/20 rounded-xl text-xs text-[var(--red)] flex items-center gap-1.5 animate-in fade-in">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={isFarsi ? "نام سازمان" : "Organization Name"}
            placeholder={isFarsi ? "آکادمی من" : "My Academy"}
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
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
              {isFarsi ? "ایجاد" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrgModal;
