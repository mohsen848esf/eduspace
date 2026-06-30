# Phase 6 — Reusable UI Components

This catalog documents the reusable core design library components used to enforce visual consistency in EduSpace.

---

## 1. Button Component (`src/components/ui/Button.tsx`)
* **Purpose**: Primary call to action.
* **Props**:
  * `variant` (primary, secondary, danger, ghost, link)
  * `size` (sm, md, lg)
  * `fullWidth` (boolean)
  * `loading` (boolean)
  * `icon` (ReactNode)
* **Variants**: 
  * `primary`: Glassmorphic indigo gradient background.
  * `secondary`: Translucent border with hover background highlight.
* **Mobile Behavior**: Expands to `fullWidth` automatically under mobile viewports.

---

## 2. Modal Component (`src/components/ui/Modal.tsx`)
* **Purpose**: Focus overlays (e.g. confirm delete, image cropper, settings).
* **Props**:
  * `open` (boolean)
  * `onOpenChange` (callback)
  * `panelClassName` (styling)
  * `dismissable` (boolean)
* **Design Consistency**: Dark glassmorphic backdrop with blur-sm overlay. Fade-in and zoom-in animations.
* **Accessibility**: Fully keyboard navigable, focus trapped on open, and closes on Escape press.

---

## 3. Spinner Component (`src/components/ui/Spinner.tsx`)
* **Purpose**: Loading indicators.
* **Props**:
  * `size` (sm, md, lg)
  * `light` (boolean)
* **Design Consistency**: Smooth SVG loop spinning with speed-controlled rotation.

---

## 4. Inspection Drawer (`src/components/ui/InspectionDrawer.tsx`)
* **Purpose**: Detail inspector panel sliding from the right of the screen.
* **Props**:
  * `open` (boolean)
  * `onClose` (callback)
  * `title` (string)
  * `children` (ReactNode)
* **Animations**: Translate X transition (slide-in from right).
