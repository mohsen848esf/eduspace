# Phase 10 — Design System Audit

A technical breakdown of all styling tokens, CSS variables, radii, elevations, and design system controls utilized across the application.

---

## 1. Color Palette (Tokens)
### Dark Theme (Default)
* `--s0` (Main background): `#0f0f17` (Deep obsidian)
* `--s1` (Card/Primary surface): `#16161f` (Dark gray-blue)
* `--s2` (Sub-surface/Modals): `#1e1e2a` (Slate gray)
* `--s3` (Selected/Header hover): `#272735` (Accent gray)
* `--b` (Primary border): `rgba(255, 255, 255, 0.07)` (Semi-translucent white)
* `--bh` (Border hover): `rgba(99, 102, 241, 0.3)` (Brand tinted translucent)
* `--t1` (Primary text): `#f0f0f8` (Off-white)
* `--t2` (Secondary text): `#8888a8` (Muted violet-gray)
* `--t3` (Disabled/Hint text): `#4a4a6a` (Deep violet-gray)
* `--brand` (Indigo primary): `#6366f1`
* `--brand-h` (Indigo hover): `#4f46e5`

### Light Theme
* `--s0`: `#f0f0f7`
* `--s1`: `#ffffff`
* `--s2`: `#f7f7fc`
* `--s3`: `#eaeaf5`
* `--b`: `rgba(0, 0, 0, 0.07)`
* `--t1`: `#18181f`
* `--t2`: `#5a5a7a`
* `--t3`: `#a0a0c0`

---

## 2. Spacing & Borders
* **Grid Layouts**: Scoped to standard Tailwind layout units (gap-3, gap-4, gap-6).
* **Radii**:
  * Buttons: `8px` (`rounded-lg`)
  * Organization Logos / Card Viewports: `16px` (`rounded-2xl`)
* **Elevations & Shadows**:
  * Modals / Popovers: `box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.3)`

---

## 3. Motion & Transition Keyframes
* **Fade-in (`.fade-in`)**: `180ms ease-out both`
* **Tile entrance (`.tile-enter`)**: `220ms cubic-bezier(0.2, 0.7, 0.2, 1.05) both`
* **Slide up (`.slide-up`)**: `240ms cubic-bezier(0.16, 1, 0.3, 1) both`
* **Reduced Motion**: All animations are optimized using `@media (prefers-reduced-motion: reduce)` to drop translation transforms and execute in `1ms`.
