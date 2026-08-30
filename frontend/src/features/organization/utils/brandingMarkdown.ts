import type { OrganizationBranding } from "../../auth/api/auth.api";
import { PRESET_PALETTES } from "../../../lib/themeGenerator";

/**
 * Generates an AI-Ready Markdown Configuration Template for the Organization.
 * The user can download this file, give it to any AI (ChatGPT, Claude, Gemini),
 * and get back a structured markdown that can be directly uploaded to EduSpace.
 */
export function generateBrandingMarkdownTemplate(
  orgName: string = "JobzLingo Academy",
  branding?: OrganizationBranding
): string {
  const primary = branding?.primary_color || "#00D084";
  const secondary = branding?.secondary_color || "#FFB000";
  const theme = branding?.default_theme || "dark-tinted";
  const slogan = branding?.slogan || "English for Better Opportunities";

  return `---
# ==============================================================================
# EduSpace White-Label Visual Identity & Theme Configuration Template
# ==============================================================================
# You can customize your Organization's colors and theme below, or pass this
# entire file to an AI assistant with your brand guidelines to generate it for you!
# ==============================================================================

organization_name: "${orgName}"
slogan: "${slogan}"

# --- 1. Core Brand Colors (Hex Codes) ---
primary_color: "${primary}"
secondary_color: "${secondary}"

# --- 2. Workspace Theme Mode ---
# Options:
#  - "dark-tinted"  : Deep branded enterprise dark (e.g., Deep Emerald)
#  - "dark"         : Neutral charcoal/slate dark SaaS with brand accents
#  - "light-tinted" : Subtle brand-tinted soft surfaces with brand accents
#  - "light"        : Crisp neutral white SaaS dashboard with brand accents
default_theme: "${theme}"
is_tinted: ${theme.includes("tinted")}

# --- 3. Optional Advanced Custom Tokens (Overrides) ---
# Leave empty or omit to use automatic mathematical HSL token derivation.
# Only specify properties you wish to manually override!
custom_tokens:
  --s0: "${branding?.custom_tokens?.["--s0"] || ""}"
  --s1: "${branding?.custom_tokens?.["--s1"] || ""}"
  --s2: "${branding?.custom_tokens?.["--s2"] || ""}"
  --s3: "${branding?.custom_tokens?.["--s3"] || ""}"
  --b: "${branding?.custom_tokens?.["--b"] || ""}"
---

# 🤖 System Prompt for AI Assistant:
> "Act as a Lead Design System Architect. I want you to configure the EduSpace White-Label visual identity for my organization named **${orgName}**.
> Please read my brand requirements below and update the YAML frontmatter at the top of this markdown document.
> Keep the YAML keys exact (\`primary_color\`, \`secondary_color\`, \`default_theme\`, \`slogan\`, and optional \`custom_tokens\`)."

---

## 🎨 Sample Inspiration Palettes:
${PRESET_PALETTES.map(
  (p) =>
    `- **${p.nameEn} (${p.nameFa})**: Primary: \`${p.primary}\`, Secondary: \`${p.secondary}\``
).join("\n")}

---

## 📐 Token Reference Guide:
- **\`primary_color\`**: Used for primary action buttons, active navigation indicators, key metrics, and glowing badges.
- **\`secondary_color\`**: Used for status accents, financial expense curves, and secondary charts.
- **\`default_theme\`**:
  - \`dark-tinted\`: Premium deep atmospheric dark (e.g. Deep Emerald #061713).
  - \`dark\`: Clean slate/navy neutral dark (#0F141B).
  - \`light-tinted\`: Refreshing soft-tinted light (#F3F8F5).
  - \`light\`: Standard enterprise white SaaS (#FFFFFF / #F7F9FC).
- **EduSpace Platform Header**: Always remains independent Dark Navy (\`#08131F\`) for platform consistency.
`;
}

/**
 * Parses user-uploaded Markdown file client-side (Zero database storage for raw md).
 * Extracts YAML frontmatter or JSON code blocks and returns sanitized OrganizationBranding.
 */
export function parseBrandingMarkdown(content: string): {
  success: boolean;
  branding?: OrganizationBranding;
  orgName?: string;
  error?: string;
} {
  if (!content || typeof content !== "string") {
    return { success: false, error: "فایل انتخاب شده خالی است یا فرمت معتبری ندارد." };
  }

  try {
    let rawYaml = "";

    // 1. Check for YAML Frontmatter: --- ... ---
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch && frontmatterMatch[1]) {
      rawYaml = frontmatterMatch[1];
    } else {
      // 2. Check for markdown yaml / json code block: ```yaml ... ``` or ```json ... ```
      const codeBlockMatch = content.match(/```(?:yaml|json)?\s*\n([\s\S]*?)\n```/i);
      if (codeBlockMatch && codeBlockMatch[1]) {
        rawYaml = codeBlockMatch[1];
      } else {
        // Fallback: parse entire string
        rawYaml = content;
      }
    }

    // Parse simple key-value YAML line by line
    const lines = rawYaml.split("\n");
    const result: Record<string, string> = {};
    const customTokens: Record<string, string> = {};
    let inCustomTokens = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      if (line.startsWith("custom_tokens:")) {
        inCustomTokens = true;
        continue;
      }

      if (inCustomTokens) {
        if (rawLine.startsWith("  ") || rawLine.startsWith("\t")) {
          const colonIdx = line.indexOf(":");
          if (colonIdx > -1) {
            const tokenKey = line.substring(0, colonIdx).trim().replace(/['"]/g, "");
            const tokenVal = line.substring(colonIdx + 1).trim().replace(/['"]/g, "");
            if (tokenKey && tokenVal) {
              customTokens[tokenKey] = tokenVal;
            }
          }
          continue;
        } else {
          inCustomTokens = false;
        }
      }

      const colonIndex = line.indexOf(":");
      if (colonIndex > -1) {
        const key = line.substring(0, colonIndex).trim().replace(/['"]/g, "");
        const val = line.substring(colonIndex + 1).trim().replace(/['"]/g, "");
        result[key] = val;
      }
    }

    // Validate and sanitize extracted values
    const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

    let primaryColor = result["primary_color"] || result["primaryColor"] || result["brand_color"];
    if (primaryColor && !primaryColor.startsWith("#")) {
      primaryColor = `#${primaryColor}`;
    }
    if (!primaryColor || !hexRegex.test(primaryColor)) {
      primaryColor = "#00D084"; // Default fallback
    }

    let secondaryColor = result["secondary_color"] || result["secondaryColor"];
    if (secondaryColor && !secondaryColor.startsWith("#")) {
      secondaryColor = `#${secondaryColor}`;
    }
    if (!secondaryColor || !hexRegex.test(secondaryColor)) {
      secondaryColor = "#FFB000";
    }

    let defaultTheme: "light" | "light-tinted" | "dark" | "dark-tinted" = "dark-tinted";
    const rawTheme = (result["default_theme"] || result["theme"] || "").toLowerCase();
    if (rawTheme === "light" || rawTheme === "light-tinted" || rawTheme === "dark" || rawTheme === "dark-tinted") {
      defaultTheme = rawTheme;
    } else if (rawTheme.includes("light") && rawTheme.includes("tint")) {
      defaultTheme = "light-tinted";
    } else if (rawTheme.includes("light")) {
      defaultTheme = "light";
    } else if (rawTheme.includes("dark") && !rawTheme.includes("tint")) {
      defaultTheme = "dark";
    } else {
      defaultTheme = "dark-tinted";
    }

    const slogan = result["slogan"] || result["tagline"] || undefined;
    const orgName = result["organization_name"] || result["name"] || undefined;

    const branding: OrganizationBranding = {
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      default_theme: defaultTheme,
      is_tinted: defaultTheme.includes("tinted"),
      slogan,
      custom_tokens: Object.keys(customTokens).length > 0 ? customTokens : undefined,
    };

    return {
      success: true,
      branding,
      orgName,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: `خطا در پردازش فایل مارک‌داون: ${
        error instanceof Error ? error.message : "فرمت نامعتبر است."
      }`,
    };
  }
}
