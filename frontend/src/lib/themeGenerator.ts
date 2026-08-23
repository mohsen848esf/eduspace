/**
 * 3-Tier Mathematical Theme Token Generator for EduSpace White-Label Engine.
 * Converts 2-3 Seed tokens (primary, secondary, mode) into a complete cohesive token set.
 */

export type ThemeMode = "light" | "light-tinted" | "dark" | "dark-tinted";

export interface ColorHSL {
  h: number; // 0 - 360
  s: number; // 0 - 100
  l: number; // 0 - 100
}

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export interface ThemeTokens {
  // Brand
  "--brand": string;
  "--brand-h": string;
  "--brand-soft": string;
  "--brand-text": string;
  "--brand-dark": string;

  // Surfaces
  "--s0": string; // App Background
  "--s1": string; // Sidebar Background
  "--s2": string; // Main Surface 1
  "--s3": string; // Elevated Surface 2
  "--s4": string; // Active / Hover Surface 3

  // Borders
  "--b": string;
  "--b-soft": string;
  "--bh": string;

  // Typography
  "--t1": string;
  "--t2": string;
  "--t3": string;

  // Status & Accents
  "--green": string;
  "--amber": string;
  "--cyan": string;
  "--red": string;
  "--purple": string;

  // Charts
  "--chart-primary": string;
  "--chart-secondary": string;
  "--chart-grid": string;
  "--chart-label": string;

  // EduSpace Platform Header Isolation
  "--header-bg": string;
  "--header-border": string;

  [key: string]: string;
}

export interface PresetPalette {
  id: string;
  nameFa: string;
  nameEn: string;
  primary: string;
  secondary: string;
}

export const PRESET_PALETTES: PresetPalette[] = [
  {
    id: "deep-emerald",
    nameFa: "سبز زمردی سازمانی (پیش‌فرض)",
    nameEn: "Enterprise Deep Emerald",
    primary: "#00D084",
    secondary: "#FFB000",
  },
  {
    id: "ocean-indigo",
    nameFa: "آبی نیلگون و ایندیگو",
    nameEn: "Ocean Indigo",
    primary: "#38BDF8",
    secondary: "#818CF8",
  },
  {
    id: "royal-purple",
    nameFa: "بنفش سلطنتی",
    nameEn: "Royal Purple",
    primary: "#A855F7",
    secondary: "#EC4899",
  },
  {
    id: "sunset-amber",
    nameFa: "کهربایی و نارنجی غروب",
    nameEn: "Sunset Amber",
    primary: "#F59E0B",
    secondary: "#EF4444",
  },
  {
    id: "tech-sapphire",
    nameFa: "یاقوتی فناوری (Sapphire)",
    nameEn: "Tech Sapphire",
    primary: "#2563EB",
    secondary: "#06B6D4",
  },
  {
    id: "crimson-rose",
    nameFa: "زرشکی و سرخ مدرن",
    nameEn: "Crimson Rose",
    primary: "#F43F5E",
    secondary: "#FB923C",
  },
];

// --- Color Math Utilities ---

export function hexToRgb(hex: string): ColorRGB {
  let cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) {
    return { r: 0, g: 208, b: 132 }; // Fallback to #00D084
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function rgbToHsl(r: number, g: number, b: number): ColorHSL {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / d + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hexToHsl(hex: string): ColorHSL {
  const rgb = hexToRgb(hex);
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

export function hslToRgb(h: number, s: number, l: number): ColorRGB {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;

  return {
    r: Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hNorm) * 255),
    b: Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  };
}

export function hslToHex(h: number, s: number, l: number): string {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Calculates WCAG 2.1 relative luminance
 */
export function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Derives optimal high-contrast text color for CTA buttons
 */
export function getContrastTextColor(bgHex: string): string {
  const lum = getLuminance(bgHex);
  // If button background is bright (lum > 0.50), use deep dark emerald/slate text
  return lum > 0.5 ? "#04140F" : "#FFFFFF";
}

// --- 4-Theme Mathematical Token Derivation Engine ---

export interface GenerateOptions {
  primary?: string;
  secondary?: string;
  mode?: ThemeMode;
  customTokens?: Record<string, string>;
}

export function generateThemeTokens(options: GenerateOptions = {}): ThemeTokens {
  const primaryHex = (options.primary || "#00D084").trim();
  const secondaryHex = (options.secondary || "#FFB000").trim();
  const mode: ThemeMode = options.mode || "dark-tinted";

  const { h, s } = hexToHsl(primaryHex);

  const brandText = getContrastTextColor(primaryHex);
  const brandHover = hslToHex(h, s, Math.min(65, hexToHsl(primaryHex).l + 6));
  const brandSoft = `rgba(${hexToRgb(primaryHex).r}, ${hexToRgb(primaryHex).g}, ${hexToRgb(primaryHex).b}, 0.14)`;

  // Always enforce the Platform Header isolation: Dark Navy #08131F
  const platformHeaderBg = "#08131F";
  const platformHeaderBorder = "#14283D";

  let tokens: ThemeTokens;

  switch (mode) {
    case "light": {
      // 1. NEUTRAL LIGHT (Pure Enterprise SaaS Light + Brand Accent)
      tokens = {
        "--brand": primaryHex,
        "--brand-h": brandHover,
        "--brand-soft": `rgba(${hexToRgb(primaryHex).r}, ${hexToRgb(primaryHex).g}, ${hexToRgb(primaryHex).b}, 0.10)`,
        "--brand-text": brandText,
        "--brand-dark": "#0F172A",

        "--s0": "#F7F9FC", // Clean SaaS App BG
        "--s1": "#FFFFFF", // Sidebar
        "--s2": "#FFFFFF", // Standard Card Surface
        "--s3": "#F1F5F9", // Elevated Stat Card
        "--s4": "#E2E8F0", // Hover Surface

        "--b": "#E2E8F0", // Crisp Light Border
        "--b-soft": "#EEF2F6",
        "--bh": primaryHex,

        "--t1": "#0F172A", // Dark Slate Text Primary
        "--t2": "#475569", // Slate Text Secondary
        "--t3": "#64748B", // Muted Hint Text

        "--green": "#16A34A",
        "--amber": secondaryHex || "#F59E0B",
        "--cyan": "#0284C7",
        "--red": "#DC2626",
        "--purple": "#7C3AED",

        "--chart-primary": primaryHex,
        "--chart-secondary": secondaryHex,
        "--chart-grid": "#E2E8F0",
        "--chart-label": "#64748B",

        "--header-bg": platformHeaderBg,
        "--header-border": platformHeaderBorder,
      };
      break;
    }

    case "light-tinted": {
      // 2. LIGHT TINTED (Subtle Organization Hue across surfaces)
      tokens = {
        "--brand": primaryHex,
        "--brand-h": brandHover,
        "--brand-soft": `rgba(${hexToRgb(primaryHex).r}, ${hexToRgb(primaryHex).g}, ${hexToRgb(primaryHex).b}, 0.12)`,
        "--brand-text": brandText,
        "--brand-dark": hslToHex(h, 45, 12),

        "--s0": hslToHex(h, Math.min(s * 0.35, 26), 97), // E.g., #F3F8F5 for Emerald
        "--s1": hslToHex(h, Math.min(s * 0.25, 20), 99), // #F7FBF9
        "--s2": "#FFFFFF",
        "--s3": hslToHex(h, Math.min(s * 0.35, 24), 96), // #EFF8F3
        "--s4": hslToHex(h, Math.min(s * 0.45, 32), 92), // #E4F5EC

        "--b": hslToHex(h, Math.min(s * 0.35, 28), 86), // #D7E9E0
        "--b-soft": hslToHex(h, Math.min(s * 0.25, 22), 91),
        "--bh": primaryHex,

        "--t1": hslToHex(h, 45, 15), // Deep tinted dark heading
        "--t2": hslToHex(h, 25, 35),
        "--t3": hslToHex(h, 20, 52),

        "--green": "#059669",
        "--amber": secondaryHex || "#D97706",
        "--cyan": "#0891B2",
        "--red": "#DC2626",
        "--purple": "#7C3AED",

        "--chart-primary": primaryHex,
        "--chart-secondary": secondaryHex,
        "--chart-grid": hslToHex(h, 25, 88),
        "--chart-label": hslToHex(h, 20, 48),

        "--header-bg": platformHeaderBg,
        "--header-border": platformHeaderBorder,
      };
      break;
    }

    case "dark": {
      // 3. NEUTRAL DARK (Charcoal / Slate Modern Dark SaaS + Brand Accent)
      tokens = {
        "--brand": primaryHex,
        "--brand-h": brandHover,
        "--brand-soft": brandSoft,
        "--brand-text": brandText,
        "--brand-dark": "#0B0F17",

        "--s0": "#0F141B", // Dark App BG
        "--s1": "#111820", // Neutral Dark Sidebar
        "--s2": "#171E27", // Main Card Surface
        "--s3": "#1C2430", // Elevated Card Surface
        "--s4": "#222C38", // Hover Surface

        "--b": "#2A3441", // Neutral Border
        "--b-soft": "#222B35",
        "--bh": primaryHex,

        "--t1": "#F3F6F8",
        "--t2": "#C2CBD3",
        "--t3": "#87939E",

        "--green": "#10B981",
        "--amber": secondaryHex || "#F59E0B",
        "--cyan": "#38BDF8",
        "--red": "#EF4444",
        "--purple": "#A855F7",

        "--chart-primary": primaryHex,
        "--chart-secondary": secondaryHex,
        "--chart-grid": "#222B35",
        "--chart-label": "#87939E",

        "--header-bg": platformHeaderBg,
        "--header-border": platformHeaderBorder,
      };
      break;
    }

    case "dark-tinted":
    default: {
      // 4. DARK TINTED (Deep Branded Enterprise Dark - e.g. Deep Emerald #061713)
      tokens = {
        "--brand": primaryHex,
        "--brand-h": brandHover,
        "--brand-soft": brandSoft,
        "--brand-text": brandText,
        "--brand-dark": hslToHex(h, 45, 6),

        "--s0": hslToHex(h, Math.min(s * 0.45, 22), 6), // #061713
        "--s1": hslToHex(h, Math.min(s * 0.5, 24), 7.5), // #071E18
        "--s2": hslToHex(h, Math.min(s * 0.55, 26), 10.5), // #0A211A
        "--s3": hslToHex(h, Math.min(s * 0.6, 28), 14), // #0D2920
        "--s4": hslToHex(h, Math.min(s * 0.65, 30), 18), // #103127

        "--b": hslToHex(h, Math.min(s * 0.55, 30), 22), // #164638
        "--b-soft": hslToHex(h, Math.min(s * 0.5, 26), 18), // #12382F
        "--bh": primaryHex,

        "--t1": hslToHex(h, 15, 96), // #F2F7F5
        "--t2": hslToHex(h, 12, 70), // #C2CBD3 / #A3B7B0
        "--t3": hslToHex(h, 10, 50), // #718982

        "--green": primaryHex,
        "--amber": secondaryHex || "#FFB000",
        "--cyan": hslToHex((h + 40) % 360, 85, 55),
        "--red": "#FF4D5D",
        "--purple": "#8B7CFF",

        "--chart-primary": primaryHex,
        "--chart-secondary": secondaryHex || "#FFB000",
        "--chart-grid": hslToHex(h, 25, 16), // #14382F
        "--chart-label": hslToHex(h, 10, 50),

        "--header-bg": platformHeaderBg,
        "--header-border": platformHeaderBorder,
      };
      break;
    }
  }

  // Merge any custom overrides from advanced settings
  if (options.customTokens) {
    Object.entries(options.customTokens).forEach(([key, val]) => {
      if (val && typeof val === "string" && val.trim().length > 0) {
        tokens[key] = val.trim();
      }
    });
  }

  return tokens;
}
