import React, { useState, useEffect, useMemo, useRef } from "react";
import { toast } from "react-hot-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useLocale } from "../../../i18n/useLocale";
import { authApi, type OrganizationDetail, type OrganizationBranding } from "../../auth/api/auth.api";
import {
  generateThemeTokens,
  PRESET_PALETTES,
  type ThemeMode,
  type ThemeTokens,
} from "../../../lib/themeGenerator";
import {
  generateBrandingMarkdownTemplate,
  parseBrandingMarkdown,
} from "../utils/brandingMarkdown";
import { getMediaUrl } from "../../../lib/api/client";
import { useOrgContextStore } from "../../auth/store/orgContextStore";
import {
  Upload,
  Download,
  Check,
  Sparkles,
  Sliders,
  RotateCcw,
  Palette,
  Sun,
  Moon,
  Eye,
  BookOpen,
  Calendar,
  FileText,
  Users,
} from "lucide-react";
import { cn } from "../../../lib/utils";

interface OrgAppearanceSettingsProps {
  organization: OrganizationDetail;
  onSuccess?: () => void;
}

export default function OrgAppearanceSettings({
  organization,
  onSuccess,
}: OrgAppearanceSettingsProps) {
  const { language } = useLocale();
  const isFarsi = language === "fa";
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialBranding = organization.branding || {};

  // Form State
  const [primaryColor, setPrimaryColor] = useState(
    initialBranding.primary_color || "#00D084"
  );
  const [secondaryColor, setSecondaryColor] = useState(
    initialBranding.secondary_color || "#FFB000"
  );
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    initialBranding.default_theme || "dark-tinted"
  );
  const [slogan, setSlogan] = useState(
    initialBranding.slogan || "English for Better Opportunities"
  );
  const [customTokens, setCustomTokens] = useState<Record<string, string>>(
    initialBranding.custom_tokens || {}
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Logo file upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    organization.logo || null
  );

  // Sync state if organization prop changes
  useEffect(() => {
    if (organization.branding) {
      setPrimaryColor(organization.branding.primary_color || "#00D084");
      setSecondaryColor(organization.branding.secondary_color || "#FFB000");
      setThemeMode(organization.branding.default_theme || "dark-tinted");
      setSlogan(
        organization.branding.slogan || "English for Better Opportunities"
      );
      setCustomTokens(organization.branding.custom_tokens || {});
    }
    if (organization.logo) {
      setLogoPreview(organization.logo);
    }
  }, [organization]);

  // Compute live 3-Tier Design Tokens dynamically
  const previewTokens = useMemo<ThemeTokens>(() => {
    return generateThemeTokens({
      primary: primaryColor,
      secondary: secondaryColor,
      mode: themeMode,
      customTokens,
    });
  }, [primaryColor, secondaryColor, themeMode, customTokens]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const brandingPayload: OrganizationBranding = {
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        default_theme: themeMode,
        is_tinted: themeMode.includes("tinted"),
        slogan: slogan.trim(),
        custom_tokens: Object.keys(customTokens).length > 0 ? customTokens : undefined,
      };

      if (logoFile) {
        const formData = new FormData();
        formData.append("branding", JSON.stringify(brandingPayload));
        formData.append("logo", logoFile);
        return authApi.updateOrganization(organization.id, formData);
      } else {
        return authApi.updateOrganization(organization.id, {
          branding: brandingPayload,
        });
      }
    },
    onSuccess: () => {
      toast.success(
        isFarsi
          ? "تنظیمات هویت بصری سازمان با موفقیت ذخیره شد."
          : "Organization visual identity saved successfully."
      );
      queryClient.invalidateQueries({ queryKey: ["activeOrganization"] });
      queryClient.invalidateQueries({ queryKey: ["orgContext"] });
      queryClient.invalidateQueries({ queryKey: ["orgMembers"] });
      if (organization.slug) {
        useOrgContextStore.getState().fetchOrgContext(organization.slug);
      }
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(
        err?.response?.data?.detail ||
          (isFarsi
            ? "خطا در ذخیره تنظیمات ظاهر سازمان."
            : "Failed to save organization appearance.")
      );
    },
  });

  // Logo file change handler
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    }
  };

  // Download AI Markdown Template (.md)
  const handleDownloadMarkdownTemplate = () => {
    const content = generateBrandingMarkdownTemplate(organization.name, {
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      default_theme: themeMode,
      slogan,
      custom_tokens: customTokens,
    });

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${organization.slug || "eduspace"}-branding-template.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(
      isFarsi
        ? "قالب و پرامپت هوش مصنوعی (.md) با موفقیت دانلود شد."
        : "AI Markdown template downloaded."
    );
  };

  // Upload and parse Markdown file (.md) on client-side
  const handleUploadMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseBrandingMarkdown(content);

      if (parsed.success && parsed.branding) {
        if (parsed.branding.primary_color) {
          setPrimaryColor(parsed.branding.primary_color);
        }
        if (parsed.branding.secondary_color) {
          setSecondaryColor(parsed.branding.secondary_color);
        }
        if (parsed.branding.default_theme) {
          setThemeMode(parsed.branding.default_theme);
        }
        if (parsed.branding.slogan) {
          setSlogan(parsed.branding.slogan);
        }
        if (parsed.branding.custom_tokens) {
          setCustomTokens(parsed.branding.custom_tokens);
        }
        toast.success(
          isFarsi
            ? "فایل کانفیگ هوش مصنوعی با موفقیت اعمال شد. پیش‌نمایش به‌روزرسانی گردید."
            : "AI branding configuration loaded into preview!"
        );
      } else {
        toast.error(parsed.error || "خطا در پردازش فایل مارک‌داون");
      }
    };
    reader.readAsText(file);
    // Reset file input so user can re-upload same file if needed
    e.target.value = "";
  };

  // Custom token override helper
  const handleCustomTokenChange = (key: string, val: string) => {
    setCustomTokens((prev) => {
      const next = { ...prev };
      if (!val || val.trim() === "") {
        delete next[key];
      } else {
        next[key] = val.trim();
      }
      return next;
    });
  };

  const handleResetTokens = () => {
    setCustomTokens({});
    toast.success(
      isFarsi
        ? "تمامی متغیرهای سفارشی به محاسبه خودکار ریاضی بازنشانی شدند."
        : "Tokens reset to automatic calculation."
    );
  };

  return (
    <div className="w-full flex flex-col lg:flex-row gap-6 items-start pb-8">
      {/* ── 1. LEFT COLUMN: Visual Identity & Branding Controls ── */}
      <div className="w-full lg:w-[440px] flex-shrink-0 bg-[#071E18] border border-[#164638] rounded-3xl p-5 md:p-6 flex flex-col gap-6 shadow-xl text-[#F2F7F5] max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar sticky top-4">
        {/* Header Title */}
        <div className="flex flex-col border-b border-[#164638] pb-4">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#00D084]" />
            <h3 className="text-base font-extrabold text-[#F2F7F5]">
              {isFarsi ? "تنظیمات ظاهر و هویت بصری" : "Appearance & Branding"}
            </h3>
          </div>
          <p className="text-xs text-[#A3B7B0] mt-1 font-medium leading-relaxed">
            {isFarsi
              ? "رنگ‌بندی، لوگو و تم اختصاصی سازمان را سفارشی‌سازی کنید."
              : "Customize your organization's logo, colors, and workspace theme."}
          </p>
        </div>

        {/* 1.1 Organization Logo & Slogan */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-bold text-[#A3B7B0]">
            {isFarsi ? "لوگوی سازمان" : "Organization Logo"}
          </label>
          <div className="flex items-center justify-between gap-3 bg-[#0A211A] border border-[#164638] p-3 rounded-2xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[#00D084] flex items-center justify-center text-[#04140F] font-black text-xl flex-shrink-0 shadow-md shadow-[#00D084]/20 overflow-hidden">
                {logoPreview ? (
                  <img
                    src={getMediaUrl(logoPreview)}
                    alt={organization.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{organization.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-[#F2F7F5] truncate">
                  {organization.name}
                </span>
                <span className="text-[11px] text-[#A3B7B0] truncate">
                  {slogan || (isFarsi ? "آکادمی اختصاصی" : "Academy")}
                </span>
              </div>
            </div>

            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoChange}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-[#0D2920] hover:bg-[#103127] border border-[#164638] text-xs font-bold text-[#F2F7F5] flex items-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95"
              >
                <Upload className="w-3.5 h-3.5 text-[#00D084]" />
                <span>{isFarsi ? "تغییر لوگو" : "Upload"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 1.2 Primary Brand Color */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#A3B7B0]">
              {isFarsi ? "رنگ اصلی برند" : "Primary Brand Color"}
            </label>
            <span className="text-[11px] font-mono text-[#00D084] font-bold">
              {primaryColor.toUpperCase()}
            </span>
          </div>

          <p className="text-[11px] text-[#718982] leading-tight">
            {isFarsi
              ? "رنگ اصلی برای دکمه‌ها، المان‌های اکتیو، بَج‌ها و سطوح سازمانی استفاده می‌شود."
              : "Primary color driving action buttons, active navigation, and surfaces."}
          </p>

          {/* Palette Swatches */}
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPrimaryColor(p.primary);
                  setSecondaryColor(p.secondary);
                }}
                className={cn(
                  "w-8 h-8 rounded-xl cursor-pointer transition-all flex items-center justify-center border-2",
                  primaryColor.toLowerCase() === p.primary.toLowerCase()
                    ? "border-white scale-110 shadow-md ring-2 ring-[#00D084]/40"
                    : "border-transparent hover:scale-105 opacity-80 hover:opacity-100"
                )}
                style={{ backgroundColor: p.primary }}
                title={isFarsi ? p.nameFa : p.nameEn}
              >
                {primaryColor.toLowerCase() === p.primary.toLowerCase() && (
                  <Check className="w-4 h-4 text-[#04140F] stroke-[3]" />
                )}
              </button>
            ))}

            {/* Direct Hex Color Picker */}
            <div className="relative flex items-center ms-auto">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-8 h-8 rounded-xl cursor-pointer bg-transparent border border-[#164638] p-0.5"
              />
            </div>
          </div>
        </div>

        {/* 1.3 Secondary Accent Color */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[#A3B7B0]">
              {isFarsi ? "رنگ ثانویه (تکمیلی)" : "Secondary Accent Color"}
            </label>
            <span className="text-[11px] font-mono text-[#FFB000] font-bold">
              {secondaryColor.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="flex-1 bg-[#0A211A] border border-[#164638] rounded-xl px-3 py-1.5 text-xs text-[#F2F7F5] font-mono focus:outline-none focus:border-[#00D084]"
              placeholder="#FFB000"
            />
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="w-9 h-8 rounded-xl cursor-pointer bg-transparent border border-[#164638] p-0.5"
            />
          </div>
        </div>

        {/* 1.4 Theme Mode Selector (4 Themes) */}
        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-bold text-[#A3B7B0]">
            {isFarsi ? "حالت و ساختار تم پنل" : "Workspace Theme Mode"}
          </label>

          <div className="grid grid-cols-2 gap-2">
            {/* Dark Tinted */}
            <button
              type="button"
              onClick={() => setThemeMode("dark-tinted")}
              className={cn(
                "p-3 rounded-2xl border text-start flex flex-col gap-1.5 transition-all cursor-pointer",
                themeMode === "dark-tinted"
                  ? "bg-[#0D2920] border-[#00D084] shadow-md ring-1 ring-[#00D084]/40"
                  : "bg-[#0A211A] border-[#164638] hover:bg-[#0D2920]/60 opacity-75 hover:opacity-100"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#F2F7F5]">
                  {isFarsi ? "تیره رنگی" : "Dark Tinted"}
                </span>
                <Moon className="w-3.5 h-3.5 text-[#00D084]" />
              </div>
              <span className="text-[10px] text-[#A3B7B0]">
                {isFarsi ? "زمردی سازمانی عمیق" : "Deep Branded Dark"}
              </span>
            </button>

            {/* Dark Neutral */}
            <button
              type="button"
              onClick={() => setThemeMode("dark")}
              className={cn(
                "p-3 rounded-2xl border text-start flex flex-col gap-1.5 transition-all cursor-pointer",
                themeMode === "dark"
                  ? "bg-[#171E27] border-[#38BDF8] shadow-md ring-1 ring-[#38BDF8]/40"
                  : "bg-[#0A211A] border-[#164638] hover:bg-[#171E27]/60 opacity-75 hover:opacity-100"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#F2F7F5]">
                  {isFarsi ? "تیره خنثی" : "Dark Neutral"}
                </span>
                <Moon className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <span className="text-[10px] text-[#A3B7B0]">
                {isFarsi ? "زغالی مدرن SaaS" : "Neutral Slate Dark"}
              </span>
            </button>

            {/* Light Tinted */}
            <button
              type="button"
              onClick={() => setThemeMode("light-tinted")}
              className={cn(
                "p-3 rounded-2xl border text-start flex flex-col gap-1.5 transition-all cursor-pointer",
                themeMode === "light-tinted"
                  ? "bg-[#0D2920] border-[#00D084] shadow-md ring-1 ring-[#00D084]/40"
                  : "bg-[#0A211A] border-[#164638] hover:bg-[#0D2920]/60 opacity-75 hover:opacity-100"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#F2F7F5]">
                  {isFarsi ? "روشن رنگی" : "Light Tinted"}
                </span>
                <Sun className="w-3.5 h-3.5 text-[#00D084]" />
              </div>
              <span className="text-[10px] text-[#A3B7B0]">
                {isFarsi ? "سطوح هماهنگ با برند" : "Branded Light Tint"}
              </span>
            </button>

            {/* Light Neutral */}
            <button
              type="button"
              onClick={() => setThemeMode("light")}
              className={cn(
                "p-3 rounded-2xl border text-start flex flex-col gap-1.5 transition-all cursor-pointer",
                themeMode === "light"
                  ? "bg-[#171E27] border-[#38BDF8] shadow-md ring-1 ring-[#38BDF8]/40"
                  : "bg-[#0A211A] border-[#164638] hover:bg-[#171E27]/60 opacity-75 hover:opacity-100"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#F2F7F5]">
                  {isFarsi ? "روشن خنثی" : "Light Neutral"}
                </span>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-[10px] text-[#A3B7B0]">
                {isFarsi ? "سفید خالص و تمیز" : "Clean White SaaS"}
              </span>
            </button>
          </div>
        </div>

        {/* 1.5 AI Markdown (.md) Assistant Box */}
        <div className="bg-[#0A211A] border border-[#164638] rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00D084]" />
            <span className="text-xs font-bold text-[#F2F7F5]">
              {isFarsi ? "دستیار هوش مصنوعی (فایل MD)" : "AI Assistant Markdown"}
            </span>
          </div>
          <p className="text-[11px] text-[#A3B7B0] leading-relaxed">
            {isFarsi
              ? "می‌توانید قالب مارک‌داون را دانلود کرده و به هر هوش مصنوعی (ChatGPT/Claude) بدهید تا تم شما را بسازد، سپس فایل MD را اینجا آپلود کنید."
              : "Download the .md template for AI prompt, or upload an AI-generated .md config."}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownloadMarkdownTemplate}
              className="flex-1 py-2 px-3 rounded-xl bg-[#0D2920] hover:bg-[#103127] border border-[#164638] text-xs font-bold text-[#F2F7F5] flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-[#00D084]" />
              <span>{isFarsi ? "دانلود قالب MD" : "Download .md"}</span>
            </button>

            <label className="flex-1 py-2 px-3 rounded-xl bg-[#096A49] hover:bg-[#00A96B] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm active:scale-95 text-center">
              <Upload className="w-3.5 h-3.5 text-white" />
              <span>{isFarsi ? "آپلود MD" : "Upload .md"}</span>
              <input
                type="file"
                accept=".md,.markdown,.txt"
                onChange={handleUploadMarkdown}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* 1.6 Advanced Design Tokens Accordion */}
        <div className="flex flex-col border-t border-[#164638] pt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced((p) => !p)}
            className="flex items-center justify-between text-xs font-bold text-[#A3B7B0] hover:text-[#F2F7F5] bg-transparent border-none cursor-pointer py-1"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#00D084]" />
              <span>{isFarsi ? "تنظیمات پیشرفته توکن‌ها" : "Advanced Token Overrides"}</span>
            </div>
            <span className="text-[11px] font-mono text-[#00D084]">
              {showAdvanced ? "▲" : "▼"}
            </span>
          </button>

          {showAdvanced && (
            <div className="flex flex-col gap-3 mt-3 bg-[#0A211A] border border-[#164638] p-3.5 rounded-2xl animate-in fade-in">
              <div className="flex items-center justify-between pb-1 border-b border-[#164638]">
                <span className="text-[11px] text-[#718982]">
                  {isFarsi ? "تغییر دستی لایه‌های سطوح و بردرها" : "Manual Token Overrides"}
                </span>
                <button
                  type="button"
                  onClick={handleResetTokens}
                  className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-transparent border-none cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isFarsi ? "بازنشانی" : "Reset"}</span>
                </button>
              </div>

              {["--s0", "--s1", "--s2", "--s3", "--s4", "--b", "--b-soft"].map((tokenKey) => (
                <div key={tokenKey} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono text-[#A3B7B0]">{tokenKey}</span>
                  <input
                    type="text"
                    value={customTokens[tokenKey] || previewTokens[tokenKey] || ""}
                    onChange={(e) => handleCustomTokenChange(tokenKey, e.target.value)}
                    className="w-28 bg-[#071E18] border border-[#164638] rounded-lg px-2 py-1 text-[11px] text-[#F2F7F5] font-mono focus:outline-none focus:border-[#00D084]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 1.7 Save Changes Button */}
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full py-3 px-4 rounded-2xl bg-[#00D084] hover:bg-[#00E88F] text-[#04140F] font-black text-sm cursor-pointer border-none shadow-lg shadow-[#00D084]/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-auto"
        >
          {saveMutation.isPending ? (
            <span>{isFarsi ? "در حال ذخیره‌سازی..." : "Saving..."}</span>
          ) : (
            <>
              <Check className="w-4 h-4 text-[#04140F] stroke-[3]" />
              <span>{isFarsi ? "ذخیره تغییرات" : "Save Changes"}</span>
            </>
          )}
        </button>
      </div>

      {/* ── 2. RIGHT COLUMN: Real-Time Interactive Live Mini Dashboard Preview ── */}
      <div className="flex-1 w-full min-w-0 flex flex-col gap-3 sticky top-4 self-start">
        {/* Preview Badge & Info */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#00D084]" />
            <span className="text-xs font-bold text-[#A3B7B0]">
              {isFarsi ? "پیش‌نمایش زنده داشبورد سازمان" : "Live Interactive Dashboard Preview"}
            </span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-[#00D084]/15 text-[#00D084] text-[10px] font-mono font-bold uppercase">
            {themeMode}
          </span>
        </div>

        {/* ── Mini Live Preview Canvas (Injected with dynamic previewTokens) ── */}
        <div
          className="w-full rounded-3xl border p-4 md:p-6 transition-all duration-300 shadow-2xl overflow-hidden select-none"
          style={
            {
              backgroundColor: previewTokens["--s0"],
              borderColor: previewTokens["--b"],
              color: previewTokens["--t1"],
              ...previewTokens,
            } as React.CSSProperties
          }
        >
          {/* Simulated EduSpace Platform Topbar (Dark Navy Platform Isolation) */}
          <div className="w-full h-11 bg-[#08131F] border-b border-[#14283D] rounded-2xl px-3.5 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-black">
                E
              </div>
              <span className="text-xs font-black text-white">EduSpace</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 rounded-full bg-[#00D084] text-[#04140F] font-black text-[10px]">
                {isFarsi ? "+ جلسه جدید" : "+ New Meeting"}
              </div>
              <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-white text-[9px] font-bold flex items-center justify-center">
                U
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* 2.1 Mini Welcome Banner */}
            <div
              className="w-full rounded-2xl p-4 border flex items-center justify-between gap-3 transition-all"
              style={{
                backgroundColor: previewTokens["--s2"],
                borderColor: previewTokens["--b"],
              }}
            >
              <div className="flex flex-col text-start">
                <span
                  className="text-sm font-black flex items-center gap-1.5"
                  style={{ color: previewTokens["--t1"] }}
                >
                  <span>{isFarsi ? "خوش آمدید، علی رضایی" : "Welcome, Ali Rezaei"}</span>
                  <span>✋</span>
                </span>
                <span
                  className="text-[11px] font-medium mt-0.5"
                  style={{ color: previewTokens["--t3"] }}
                >
                  {isFarsi
                    ? "امروز یک روز عالی برای یادگیری و ساختن آینده‌ای بهتر است."
                    : "Today is a great day to build a better future."}
                </span>
              </div>

              <div className="flex items-center gap-2.5" dir="ltr">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-md flex-shrink-0 overflow-hidden"
                  style={{
                    backgroundColor: previewTokens["--brand"],
                    color: previewTokens["--brand-text"],
                  }}
                >
                  {logoPreview ? (
                    <img
                      src={getMediaUrl(logoPreview)}
                      alt={organization.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    organization.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span
                    className="text-xs font-black truncate leading-tight"
                    style={{ color: previewTokens["--t1"] }}
                  >
                    {organization.name}
                  </span>
                  <span
                    className="text-[9px] font-semibold mt-0.5 truncate"
                    style={{ color: previewTokens["--t3"] }}
                  >
                    {slogan}
                  </span>
                </div>
              </div>
            </div>

            {/* 2.2 Mini Row of 4 KPI Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                {
                  label: isFarsi ? "کلاس‌های فعال" : "Active Classes",
                  value: "۱۴",
                  icon: BookOpen,
                  trend: "+2",
                },
                {
                  label: isFarsi ? "اعلان‌های خوانده نشده" : "Unread Inbox",
                  value: "۱۲",
                  icon: FileText,
                  trend: "3 new",
                },
                {
                  label: isFarsi ? "تکالیف بررسی" : "Pending Reviews",
                  value: "۸",
                  icon: FileText,
                  trend: "review",
                },
                {
                  label: isFarsi ? "دانشجویان کل" : "Total Students",
                  value: "۲۴۸",
                  icon: Users,
                  trend: "+18%",
                },
              ].map((kpi, idx) => {
                const IconComponent = kpi.icon;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl p-3 border flex flex-col justify-between items-center text-center transition-all"
                    style={{
                      backgroundColor: previewTokens["--s2"],
                      borderColor: previewTokens["--b"],
                    }}
                  >
                    <div className="w-full flex items-center justify-between">
                      <span
                        className="text-[10px] font-bold truncate"
                        style={{ color: previewTokens["--t2"] }}
                      >
                        {kpi.label}
                      </span>
                      <IconComponent
                        className="w-3.5 h-3.5"
                        style={{ color: previewTokens["--brand"] }}
                      />
                    </div>
                    <span
                      className="text-lg font-black font-mono my-1"
                      style={{ color: previewTokens["--t1"] }}
                    >
                      {kpi.value}
                    </span>
                    <span
                      className="text-[9px] font-bold"
                      style={{ color: previewTokens["--brand"] }}
                    >
                      {kpi.trend}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 2.3 Mini Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Donut Category Chart */}
              <div
                className="md:col-span-5 rounded-2xl p-3.5 border flex flex-col justify-between"
                style={{
                  backgroundColor: previewTokens["--s2"],
                  borderColor: previewTokens["--b"],
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-extrabold"
                    style={{ color: previewTokens["--t1"] }}
                  >
                    {isFarsi ? "⭕ توزیع محصولات" : "Category Breakdown"}
                  </span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: previewTokens["--t3"] }}
                  >
                    $24.8k
                  </span>
                </div>

                <div className="relative w-24 h-24 self-center my-2 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="36"
                      fill="transparent"
                      stroke={previewTokens["--s3"]}
                      strokeWidth="10"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="36"
                      fill="transparent"
                      stroke={previewTokens["--brand"]}
                      strokeWidth="10"
                      strokeDasharray="120 226"
                      strokeDashoffset="0"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="36"
                      fill="transparent"
                      stroke={previewTokens["--amber"]}
                      strokeWidth="10"
                      strokeDasharray="60 226"
                      strokeDashoffset="-120"
                    />
                  </svg>
                  <span
                    className="absolute text-xs font-black font-mono"
                    style={{ color: previewTokens["--t1"] }}
                  >
                    52%
                  </span>
                </div>

                <div
                  className="flex items-center justify-between text-[9px] font-bold border-t pt-2"
                  style={{ borderColor: previewTokens["--b"] }}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: previewTokens["--brand"] }}
                    />
                    <span style={{ color: previewTokens["--t2"] }}>
                      {isFarsi ? "برنامه‌نویسی" : "Coding"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: previewTokens["--amber"] }}
                    />
                    <span style={{ color: previewTokens["--t2"] }}>
                      {isFarsi ? "طراحی" : "Design"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Line Curve */}
              <div
                className="md:col-span-7 rounded-2xl p-3.5 border flex flex-col justify-between"
                style={{
                  backgroundColor: previewTokens["--s2"],
                  borderColor: previewTokens["--b"],
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-extrabold"
                    style={{ color: previewTokens["--t1"] }}
                  >
                    {isFarsi ? "📈 عملکرد مالی" : "Financial Curve"}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-lg text-[9px] font-bold"
                    style={{
                      backgroundColor: previewTokens["--brand-soft"],
                      color: previewTokens["--brand"],
                    }}
                  >
                    +12.5%
                  </span>
                </div>

                <div className="w-full h-20 relative my-1">
                  <svg className="w-full h-full" viewBox="0 0 200 80" fill="none">
                    <path
                      d="M 10 65 Q 50 50, 90 35 T 190 15"
                      stroke={previewTokens["--brand"]}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 10 70 Q 50 60, 90 55 T 190 45"
                      stroke={previewTokens["--amber"]}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div
                  className="flex items-center justify-between text-[9px] font-bold border-t pt-2"
                  style={{ borderColor: previewTokens["--b"] }}
                >
                  <span style={{ color: previewTokens["--t3"] }}>
                    {isFarsi ? "درآمد کل: $24,860" : "Revenue: $24,860"}
                  </span>
                  <span style={{ color: previewTokens["--t3"] }}>
                    {isFarsi ? "هزینه‌ها: $8,420" : "Expenses: $8,420"}
                  </span>
                </div>
              </div>
            </div>

            {/* 2.4 Mini Activity Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div
                className="rounded-2xl p-3 border flex items-center justify-between gap-2"
                style={{
                  backgroundColor: previewTokens["--s2"],
                  borderColor: previewTokens["--b"],
                }}
              >
                <div className="flex flex-col text-start">
                  <span
                    className="text-[11px] font-bold truncate"
                    style={{ color: previewTokens["--t1"] }}
                  >
                    {isFarsi ? "جلسه React پیشرفته" : "Advanced React Workshop"}
                  </span>
                  <span
                    className="text-[9px] mt-0.5"
                    style={{ color: previewTokens["--t3"] }}
                  >
                    {isFarsi ? "امروز • ۱۶:۰۰" : "Today • 16:00"}
                  </span>
                </div>
                <Calendar
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: previewTokens["--brand"] }}
                />
              </div>

              <div
                className="rounded-2xl p-3 border flex items-center justify-between gap-2"
                style={{
                  backgroundColor: previewTokens["--s2"],
                  borderColor: previewTokens["--b"],
                }}
              >
                <div className="flex flex-col text-start">
                  <span
                    className="text-[11px] font-bold truncate"
                    style={{ color: previewTokens["--t1"] }}
                  >
                    {isFarsi ? "پروژه نهایی طراحی" : "Final UI Project"}
                  </span>
                  <span
                    className="text-[9px] mt-0.5"
                    style={{ color: previewTokens["--t3"] }}
                  >
                    {isFarsi ? "تحویل داده شده" : "Submitted"}
                  </span>
                </div>
                <span
                  className="px-2 py-0.5 rounded-lg text-[9px] font-bold border"
                  style={{
                    backgroundColor: previewTokens["--brand-soft"],
                    borderColor: previewTokens["--b"],
                    color: previewTokens["--brand"],
                  }}
                >
                  {isFarsi ? "تکمیل شد" : "Done"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
