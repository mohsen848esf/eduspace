import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { useLocale } from "../../../i18n/useLocale";
import { useAuthStore } from "../../auth/store/authStore";
import { authApi } from "../../auth/api/auth.api";
import AppShell from "../../../components/layout/AppShell";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Spinner from "../../../components/ui/Spinner";

export default function ProfileCompletionPage() {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const { user, fetchMe } = useAuthStore();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with user data
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: async () => {
      await fetchMe();
      toast.success(isFarsi ? "پروفایل با موفقیت بروزرسانی شد" : "Profile updated successfully");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || (isFarsi ? "خطا در بروزرسانی پروفایل" : "Failed to update profile"));
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error(isFarsi ? "لطفاً تمامی فیلدها را پر کنید" : "Please fill in all fields");
      return;
    }
    updateProfileMutation.mutate({
      full_name: fullName,
      email: email,
    });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append("avatar", file);
      updateProfileMutation.mutate(formData);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  if (!user) {
    return (
      <AppShell title={isFarsi ? "پروفایل کاربری" : "User Profile"}>
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={isFarsi ? "تنظیمات حساب کاربری" : "Account Profile Settings"}>
      <div className="max-w-2xl mx-auto bg-[var(--s2)] rounded-2xl border border-[var(--b)] p-6 md:p-8 shadow-sm flex flex-col gap-8 animate-in fade-in duration-150">
        
        {/* Header Summary */}
        <div>
          <h2 className="text-base font-bold text-[var(--t1)]">
            {isFarsi ? "تنظیمات پروفایل کاربری" : "Profile Settings"}
          </h2>
          <p className="text-xs text-[var(--t3)] mt-1">
            {isFarsi 
              ? "عکس نمایه، نام و سایر مشخصات حساب خود را تکمیل و مدیریت کنید." 
              : "Update your avatar, full name, email, and control your display options."}
          </p>
        </div>

        {/* Avatar Section */}
        <div className="flex flex-col items-center sm:flex-row gap-5 border-b border-[var(--b)]/60 pb-6">
          <div
            onClick={triggerFileInput}
            className="relative w-24 h-24 rounded-full border-2 border-[var(--b)] flex items-center justify-center bg-[var(--s3)] overflow-hidden group cursor-pointer hover:border-[var(--brand-text)] transition-all duration-200 shadow-md flex-shrink-0"
          >
            {user.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl font-semibold">
                {fullName.charAt(0).toUpperCase() || user.username.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <span className="text-[10px] text-white font-bold tracking-wide uppercase">
                {isFarsi ? "تغییر تصویر" : "Change Image"}
              </span>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            className="hidden"
            accept="image/*"
          />
          <div className="text-center sm:text-start">
            <h3 className="text-sm font-semibold text-[var(--t1)]">
              {isFarsi ? "تصویر پروفایل شما" : "Your Avatar"}
            </h3>
            <p className="text-xs text-[var(--t3)] mt-1.5 leading-relaxed max-w-sm">
              {isFarsi 
                ? "یک تصویر مربعی بارگذاری کنید. این تصویر به اساتید و همکلاسی‌های شما نشان داده می‌شود." 
                : "Upload a clean profile picture. It will be visible to your instructors and classmates."}
            </p>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                label={isFarsi ? "نام کاربری" : "Username"}
                value={user.username}
                disabled
              />
            </div>
            <div className="flex-1">
              <Input
                label={isFarsi ? "وضعیت آنلاین" : "Online Status"}
                value={user.is_online ? (isFarsi ? "آنلاین" : "Online") : (isFarsi ? "آفلاین" : "Offline")}
                disabled
              />
            </div>
          </div>

          <Input
            label={isFarsi ? "نام و نام خانوادگی" : "Full Name"}
            placeholder={isFarsi ? "مثال: علی رضایی" : "e.g. John Doe"}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <Input
            label={isFarsi ? "نشانی ایمیل" : "Email Address"}
            type="email"
            placeholder="e.g. user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 mt-2">
            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? <Spinner size="sm" /> : (isFarsi ? "ذخیره پروفایل" : "Save Profile")}
            </Button>
          </div>
        </form>

      </div>
    </AppShell>
  );
}
