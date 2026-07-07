---
name: EduSpace Design System
colors:
  surface: '#16161f'
  surface-dim: '#13131b'
  surface-bright: '#393841'
  surface-container-lowest: '#0d0d15'
  surface-container-low: '#1b1b23'
  surface-container: '#1f1f27'
  surface-container-high: '#292932'
  surface-container-highest: '#34343d'
  on-surface: '#e4e1ed'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e4e1ed'
  inverse-on-surface: '#302f38'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#c7c5d5'
  on-secondary: '#2f2f3c'
  secondary-container: '#464553'
  on-secondary-container: '#b5b3c3'
  tertiary: '#ffb783'
  on-tertiary: '#4f2500'
  tertiary-container: '#d97721'
  on-tertiary-container: '#452000'
  error: '#ef4444'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e3e0f1'
  secondary-fixed-dim: '#c7c5d5'
  on-secondary-fixed: '#1a1a26'
  on-secondary-fixed-variant: '#464553'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703700'
  background: '#13131b'
  on-background: '#e4e1ed'
  surface-variant: '#34343d'
  elevated: '#1e1e2a'
  border-translucent: rgba(255, 255, 255, 0.08)
  text-primary: '#f8fafc'
  text-secondary: '#94a3b8'
  success: '#10b981'
  warning: '#f59e0b'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.01em
  mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  element-gap: 16px
  grid-gutter: 20px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style

This design system is engineered for a premium, enterprise-grade educational environment. It balances the precision of developer tools with the approachability required for modern learning. The brand personality is **Professional, Technical, and Sophisticated**, aiming to evoke a sense of focused calm and high-performance utility.

The visual direction follows a **High-Density Glassmorphic** style. It leverages deep space aesthetics (dark-first) combined with translucent layering to create a sense of depth without physical heaviness. The interface takes inspiration from the functional clarity of Stripe, the streamlined efficiency of Linear, and the versatile structure of Notion.

**Key Stylistic Pillars:**
- **Refined Transparency:** Use of 1px translucent borders and subtle backdrop blurs to define hierarchy.
- **Geometric Harmony:** A strict 2:1 relationship between container radii (24px) and element radii (12px).
- **Data-First Clarity:** High-contrast typography and generous whitespace within high-density data views to ensure readability during long study sessions.

## Colors

The palette is strictly "dark-first," utilizing a multi-layered grayscale to establish depth. The primary brand color, **Indigo (#6366f1)**, is used sparingly for high-intent actions, progress indicators, and brand touchpoints to maintain its visual impact.

**Color Application:**
- **Background (#0f0f17):** The canvas for the entire application.
- **Surface (#16161f):** Used for the main content areas and sidebars.
- **Elevated (#1e1e2a):** Reserved for hover states, floating menus, and modal dialogs.
- **Translucent Borders:** Instead of solid colors, use `rgba(255, 255, 255, 0.08)` for borders to allow underlying background tones to bleed through slightly, reinforcing the glassmorphic effect.

## Typography

This design system utilizes **Inter** as the primary typeface for its exceptional legibility and neutral, technical character. For RTL localization and specific multilingual contexts, **Vazirmatn** serves as the secondary stack, ensuring seamless integration of Persian/Arabic scripts with the same weight and vertical rhythm.

**Rules:**
- **Headlines:** Use tighter letter spacing (-0.01em to -0.02em) for larger sizes to maintain a compact, premium feel.
- **Data Display:** For financial ledgers and classroom analytics, use `body-md` with tabular lining figures if available.
- **Visual Hierarchy:** Contrast is achieved through weight (SemiBold/Bold for headers) and color (Primary White vs. Secondary Slate) rather than excessive size variations.

## Layout & Spacing

The layout is built on a **12-column fluid grid** for desktop and tablet, transitioning to a single-column stack for mobile. It prioritizes high-density data visualization, ensuring that WebRTC classroom controls and financial analytics are accessible without excessive scrolling.

**Grid Contexts:**
- **Classroom/Dashboard:** 12-column grid with a 24px margin. Sidebars are fixed at 280px (desktop) or collapsible to 64px.
- **Content Width:** Main reading experiences (Course materials) should be capped at a max-width of 800px for optimal line length.
- **Rhythm:** All spacing must be multiples of 4px. Use 16px as the standard gap between related elements and 24px between distinct sections.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Backdrop Blurs** rather than traditional shadows. This ensures the interface remains crisp and high-performance.

- **Level 0 (Base):** `#0f0f17`. Used for the global background.
- **Level 1 (Surface):** `#16161f`. Used for cards, sidebars, and main containers. Feature a 1px translucent border (`rgba(255, 255, 255, 0.08)`).
- **Level 2 (Elevated):** `#1e1e2a`. Used for modals and dropdowns. Apply a `backdrop-filter: blur(12px)` to any semi-transparent surfaces at this level to create the frosted glass effect.
- **Interaction:** On hover, Level 1 elements transition to Level 2 background color smoothly over 200ms.

## Shapes

The shape language is characterized by large, friendly radii that soften the technicality of the dark theme.

- **Main Containers & Cards:** Always use a **24px (rounded-xl)** radius. This includes dashboard widgets, video grids, and course modules.
- **Interactive Elements:** Buttons, input fields, and chips use a **12px (rounded-lg)** radius.
- **Small Components:** Checkboxes and small tags use a **4px (soft)** radius.

This 2:1 ratio (24px/12px) is a core geometric constraint of the design system and must be maintained to ensure visual harmony.

## Components

### Buttons
- **Primary:** Background `#6366f1`, text white, 12px radius. 
- **Secondary:** Background `rgba(255, 255, 255, 0.05)`, 1px border `rgba(255, 255, 255, 0.1)`, 12px radius.
- **Motion:** Subtle scale down (0.98) on active state; 200ms color transition on hover.

### Cards
- **Structure:** 24px radius, `#16161f` background, 1px translucent border.
- **Dashboard Widgets:** Include a header section with `label-sm` metadata and a `secondary` button for actions.

### Input Fields
- **Styling:** 12px radius, `#1e1e2a` background. Border is `rgba(255, 255, 255, 0.1)` by default, changing to `#6366f1` on focus.
- **Placeholder:** Color set to `text-secondary`.

### WebRTC Classroom Controls
- **Style:** Use a floating bar at the bottom with a Level 2 elevation and high backdrop blur. 
- **Icons:** Use 20px stroke icons with Indigo accents for "Active" states (e.g., Mic On).

### Skeletons
- All data-heavy modules (Financials, Course Lists) must use skeleton states. Use a pulse animation moving from `#16161f` to `#1e1e2a`.