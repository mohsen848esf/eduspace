import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import client from "../../../lib/api/client";
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

  const { data: certificates = [], isLoading: loadingCerts } = useQuery({
    queryKey: ["certificates"],
    queryFn: async () => {
      const res = await client.get("/auth/certificates/");
      return res.data;
    },
  });

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

        {/* Certifications Card */}
        <div className="border-t border-[var(--b)]/60 pt-8 mt-4">
          <div className="mb-6">
            <h2 className="text-base font-bold text-[var(--t1)]">
              {isFarsi ? "گواهی‌نامه‌های من" : "My Certificates"}
            </h2>
            <p className="text-xs text-[var(--t3)] mt-1">
              {isFarsi 
                ? "گواهی‌نامه‌هایی که با موفقیت در این آکادمی کسب کرده‌اید." 
                : "Certificates you have earned by completing courses in this academy."}
            </p>
          </div>

          {loadingCerts ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : certificates.length === 0 ? (
            <div className="text-center py-6 text-[var(--t3)] text-xs border border-dashed border-[var(--b)] rounded-xl">
              {isFarsi ? "هنوز گواهی‌نامه‌ای کسب نکرده‌اید." : "You have not earned any certificates yet."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certificates.map((cert: any) => (
                <div
                  key={cert.id}
                  className="p-5 border border-[var(--b)] rounded-xl bg-[var(--s3)] flex flex-col justify-between gap-4 relative overflow-hidden"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--t1)]">{cert.course_title}</h4>
                      <p className="text-xs text-[var(--t3)] mt-1">{cert.class_name}</p>
                    </div>
                    <span className="text-xl">🏆</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-[var(--b)]/60 pt-3 text-[10px] text-[var(--t3)]">
                    <div>
                      <span className="block">{isFarsi ? "شماره سریال:" : "Serial Number:"}</span>
                      <span className="font-mono text-[var(--t2)] font-semibold">{cert.certificate_number}</span>
                    </div>
                    <div>
                      <span className="block">{isFarsi ? "تاریخ صدور:" : "Issued Date:"}</span>
                      <span className="text-[var(--t2)]">
                        {new Date(cert.issued_at).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const printWindow = window.open("", "_blank");
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>Certificate - ${cert.certificate_number}</title>
                                <style>
                                  body {
                                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                    display: flex;
                                    justify-content: center;
                                    align-items: center;
                                    height: 100vh;
                                    margin: 0;
                                    background: #f0f0f0;
                                  }
                                  .cert-container {
                                    background: white;
                                    border: 15px double #c5a059;
                                    padding: 50px;
                                    width: 800px;
                                    text-align: center;
                                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                                    position: relative;
                                  }
                                  .logo {
                                    font-size: 24px;
                                    font-weight: bold;
                                    color: #4a154b;
                                    margin-bottom: 20px;
                                  }
                                  h1 {
                                    color: #c5a059;
                                    font-size: 38px;
                                    margin: 10px 0;
                                    font-family: Georgia, serif;
                                  }
                                  .subtitle {
                                    font-size: 18px;
                                    font-style: italic;
                                    margin-bottom: 30px;
                                  }
                                  .recipient {
                                    font-size: 28px;
                                    font-weight: bold;
                                    text-decoration: underline;
                                    margin: 20px 0;
                                  }
                                  .details {
                                    font-size: 16px;
                                    line-height: 1.6;
                                    margin: 30px auto;
                                    max-w: 600px;
                                  }
                                  .footer-info {
                                    display: flex;
                                    justify-content: space-between;
                                    margin-top: 50px;
                                    font-size: 14px;
                                    color: #555;
                                  }
                                  @media print {
                                    body {
                                      background: white;
                                    }
                                    .cert-container {
                                      box-shadow: none;
                                      border: 15px double #c5a059;
                                    }
                                  }
                                </style>
                              </head>
                              <body>
                                <div class="cert-container" dir="${isFarsi ? "rtl" : "ltr"}">
                                  <div class="logo">EDUSPACE ACADEMY</div>
                                  <h1>${isFarsi ? "گواهی‌نامه پایان دوره" : "Certificate of Completion"}</h1>
                                  <p class="subtitle">${isFarsi ? "بدین‌وسیله گواهی می‌شود که:" : "This is to certify that"}</p>
                                  <div class="recipient">${cert.student_full_name || cert.student_username}</div>
                                  <p class="details">
                                    ${isFarsi 
                                      ? `با موفقیت دوره <strong>${cert.course_title}</strong> (کلاس: ${cert.class_name}) را در این موسسه به پایان رسانده و معیارهای ارزیابی مورد نیاز را با موفقیت احراز نموده است.`
                                      : `has successfully completed the course <strong>${cert.course_title}</strong> (Class: ${cert.class_name}) and met all evaluation criteria.`}
                                  </p>
                                  <div class="footer-info">
                                    <div>
                                      <strong>${isFarsi ? "شماره سریال:" : "Certificate ID:"}</strong><br>
                                      ${cert.certificate_number}
                                    </div>
                                    <div>
                                      <strong>${isFarsi ? "تاریخ صدور:" : "Date of Issue:"}</strong><br>
                                      ${new Date(cert.issued_at).toLocaleDateString(isFarsi ? "fa-IR" : "en-US")}
                                    </div>
                                  </div>
                                </div>
                                <script>
                                  window.onload = function() {
                                    window.print();
                                  }
                                </script>
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                        }
                      }}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold transition-colors"
                    >
                      {isFarsi ? "چاپ گواهی‌نامه" : "Print Certificate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
