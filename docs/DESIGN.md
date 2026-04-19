# DBT Leakage Detection System - Design Tokens & Specification

## 1. Typography Tokens
*   **Font Family:** PUBLIC SANS
*   **Headline Font:** PUBLIC SANS
*   **Body Font:** PUBLIC SANS
*   **Label Font:** INTER
*   **Fallback Font (Gujarati):** NOTO SANS

## 2. Core Color Palette Tokens
*   **Theme Mode:** LIGHT
*   **Custom Color (Global Base):** `#0D1B2A`
*   **Primary Override:** `#1B3A5B`
*   **Secondary Override:** `#6B7280`
*   **Tertiary Override:** `#F5A623`
*   **Neutral Override:** `#0D1B2A`

## 3. Extracted Semantic Colors
*   **Background:** `#f8f9ff`
*   **Surface:** `#f8f9ff`
*   **Surface Container Lowest:** `#ffffff`
*   **Surface Container Low:** `#eef4ff`
*   **Surface Container:** `#e5efff`
*   **Surface Container High:** `#dbe9fe`
*   **Surface Container Highest:** `#d6e4f9`
*   **Primary:** `#000000`
*   **On Primary:** `#ffffff`
*   **Primary Container:** `#001c37`
*   **On Primary Container:** `#6986ab`
*   **Secondary:** `#585f6c`
*   **On Secondary:** `#ffffff`
*   **Secondary Container:** `#dce2f3`
*   **On Secondary Container:** `#5e6572`
*   **Tertiary:** `#000000`
*   **On Tertiary:** `#ffffff`
*   **Error:** `#ba1a1a`
*   **On Error:** `#ffffff`
*   **On Background:** `#0f1c2c`
*   **On Surface:** `#0f1c2c`
*   **On Surface Variant:** `#44474c`
*   **Outline:** `#74777d`
*   **Outline Variant:** `#c4c6cc`

---

# Design System Specification: The Sovereign Lens

## 1. Overview & Creative North Star
**The Sovereign Lens** is the design philosophy driving this system. In the context of government leakage detection, the UI must transition from "software tool" to "authoritative intelligence ledger." We reject the cluttered, line-heavy aesthetic of legacy government portals in favor of **Structural Editorialism**.

**Creative North Star: The Sovereign Lens**
This system treats data as a high-value asset. We achieve authority through:
*   **Intentional Asymmetry:** Breaking the grid to draw eyes to critical leakages.
*   **Tonal Depth:** Replacing 1px borders with subtle shifts in surface luminance.
*   **Command Contrast:** High-density white workspace modules set against a deep, infinite navy void.

This is not a dashboard; it is a high-fidelity instrument for fiscal integrity.

---

## 2. Colors: Tonal Architecture
We utilize a sophisticated "Inverted Shell" strategy. While the global environment is a deep, authoritative navy, the analytical workspace utilizes a tiered white-to-blue-grey palette for maximum legibility.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. Boundaries must be defined solely through background color shifts. 
*   Use `surface_container_low` (`#eef4ff`) to define sections on a `surface` (`#f8f9ff`) background.
*   Use `surface_container_highest` (`#d6e4f9`) for inset areas or "wells" within a card.

### Surface Hierarchy & Nesting
Treat the UI as layered sheets of "Fine Paper" floating over a "Navy Command Shell":
1.  **Level 0 (Command Shell):** `#0D1B2A` (Global Background/Navigation).
2.  **Level 1 (Workspace):** `surface` (`#f8f9ff`).
3.  **Level 2 (Analytical Cards):** `surface_container_lowest` (`#ffffff`).
4.  **Level 3 (Data Sub-sections):** `surface_container_low` (`#eef4ff`).

### Glass & Gradient (The Soul of the UI)
To avoid a flat, "out-of-the-box" appearance:
*   **Floating Navigation:** Apply Glassmorphism using `surface` colors at 80% opacity with a `20px` backdrop blur.
*   **Action Tones:** Primary CTAs should utilize a subtle vertical gradient from `primary` (`#000000`) to `primary_container` (`#001c37`) to add "heft" and professional polish.

---

## 3. Typography: The Editorial Ledger
The typography system uses **Public Sans** for structural clarity and **Inter** for data precision. For Gujarati script support, **Noto Sans** is the mandatory fallback to maintain the system's weight and personality.

*   **Display (The Overview):** Large, low-tracking Public Sans for KPI totals. It conveys "The Big Picture."
*   **Headline & Title:** Used for narrative sections. High contrast (Bold weight) vs. the surrounding data.
*   **Labels (Inter):** All data points, table headers, and metadata must use **Inter**. The slightly taller x-height of Inter ensures high-density data remains legible at small sizes (`label-sm`: `0.6875rem`).
*   **Localization:** Noto Sans Gujarati must match the line-height of the Public Sans body text to prevent layout "jumping" in multi-lingual views.

---

## 4. Elevation & Depth
In this system, depth is a functional tool, not a decoration.

### Tonal Layering (Primary Hierarchy)
Stack surfaces to create "Natural Lift." Place a `surface_container_lowest` card on a `surface_container_low` background. The `0.125rem` shift in hex value provides a cleaner, more professional separation than a stroke.

### Ambient Shadows
Shadows are reserved for "Active" elements only (e.g., a dragged card or a triggered menu).
*   **Value:** 0px 8px 24px
*   **Color:** 8% opacity of `on_surface` (`#0f1c2c`). 
*   **Note:** Never use pure black shadows. Shadows must be "tinted" with the navy-on-surface color to mimic natural light refraction.

### The "Ghost Border" Fallback
If accessibility requirements (WCAG) demand a border, use a **Ghost Border**:
*   `outline_variant` (`#c4c6cc`) at **15% opacity**. This provides a visual hint without cluttering the data-dense environment.

---

## 5. Components

### KPI Cards (The Sovereign Metrics)
*   **Style:** No borders. `surface_container_lowest` background. 
*   **Edge:** `lg` (`0.5rem`) corner radius.
*   **Detail:** Use a 4px left-accent bar using semantic colors (Amber, Red, Green) to denote the risk category of the metric.

### Data Tables (The Dense Grid)
*   **Separation:** Forbid horizontal divider lines. Use alternating row fills: `surface_container_lowest` for even rows and `surface_container_low` for odd rows.
*   **Header:** `title-sm` typography, `on_surface_variant` color, uppercase with 0.05em tracking.
*   **Typography:** Use Inter for all cell values to ensure tabular lining (numbers align vertically).

### Leakage Type Badges
Badges are "Pills" with `full` (`9999px`) roundedness.
*   **Deceased:** Red (`#E63946`) background, white text.
*   **Duplicate:** Orange/Amber (`#F5A623`) background, `on_tertiary_fixed` text.
*   **Undrawn:** Yellow/Tertiary (`#ffddb4`) background, `on_tertiary_fixed` text.
*   **Cross-scheme:** Blue (`#abc9f1`) background, `on_primary_fixed` text.

### Risk Score Bars
A `0.5rem` height bar with a `full` radius.
*   **Fill:** A linear gradient from `Green` (`#2DC653`) to `Amber` (`#F5A623`) to `Red` (`#E63946`).
*   **Indicator:** A 2px wide `on_surface` "needle" that floats above the bar to indicate the current score.

---

## 6. Do’s and Don’ts

### Do:
*   **Embrace White Space:** In a data-dense tool, white space is a separator. Use `1.5rem` padding inside cards as a standard.
*   **Use Subtle Micro-interactions:** Buttons should shift from `primary` to `primary_container` on hover—a tonal "sink" rather than a bright "flash."
*   **Align to the Baseline:** Ensure all data in a row aligns to the same baseline, regardless of script (English/Gujarati).

### Don’t:
*   **Don’t use "Pure" Colors:** Avoid #000000 for text; use `on_surface` (`#0f1c2c`) for a softer, premium feel.
*   **Don’t use Grid Lines:** Never use vertical or horizontal lines to separate table columns or sidebar sections.
*   **Don’t use Drop Shadows on Cards:** Rely on tonal shifts between the `surface` levels to create hierarchy. Shadows are for overlays and modals only.
