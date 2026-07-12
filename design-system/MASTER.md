# Design System — Master File

> **Project:** Masjid Daar Us Sunnah — Entrance Signage TV
> **Generated with:** ui-ux-pro-max skill (`npx ui-ux-pro-max-cli init --ai claude`) + `design_system.py`
> **Brief:** Digital signage / kiosk · dark + gold · glanceable at a distance
> **LOGIC:** All styling (`style.css`) is built from the tokens below. No colour, spacing,
> shadow or type value is hand-picked in components — components reference these tokens only.

---

## Color Palette

Sourced from the skill colour database (`data/colors.csv`) dark + gold rows —
*Luxury/Premium Brand* (`#A16207` / `#D4AF37` gold), *Fintech* (dark-bg gold `#FBBF24`),
*Banking/Traditional Finance* (near-black `#020617` on dark). Gold is the brand/CTA role.

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Background (near-black) | `#020617` | `--color-background` |
| Surface / card | `#0F172A` | `--color-surface` |
| Surface raised / muted | `#1A1E2F` | `--color-surface-2` |
| Border | `#334155` | `--color-border` |
| Foreground (primary text) | `#F8FAFC` | `--color-foreground` |
| Muted foreground (support) | `#94A3B8` | `--color-muted` |
| Gold — hero | `#D4AF37` | `--color-gold` |
| Gold — bright highlight | `#FBBF24` | `--color-gold-bright` |
| Gold — deep | `#A16207` | `--color-gold-deep` |
| On-gold (text on gold fill) | `#0F172A` | `--color-on-gold` |

**Notes:** High-contrast dark + gold brand accent. Gold-on-background contrast ≈ 8.9:1
(exceeds skill Accessibility rule 4.5:1 body / 3:1 large). Gold reserved for the single
hero element per screen (Von Restorff).

## Typography

- **Display / hero (Latin):** Playfair Display *(skill typography match: editorial, luxury, type-as-hero)*
- **UI / numerals (Latin):** Inter *(skill heading font — glanceable, tabular numerals)*
- **Arabic / Qur'an:** Amiri Quran, Amiri *(Qur'anic-grade glyph coverage — no tofu)*
- **CSS Variables:** `--font-display`, `--font-ui`, `--font-arabic`

**Google Fonts import**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Amiri:ital,wght@0,400;0,700;1,400&family=Amiri+Quran&display=swap');
```

### Type Scale — signage (glanceable at distance)
Skill Style rule: *"large type (32px+)"*. Sizes are viewport-height based so the board
scales to any TV. Tokens (`--text-*`) are the only sizes components may use.

| Token | Value | Usage |
|-------|-------|-------|
| `--text-label` | `2.2vh` | eyebrow labels, kickers |
| `--text-body` | `2.6vh` | supporting body |
| `--text-h2` | `3.2vh` | slide section titles |
| `--text-time` | `4.6vh` | prayer times |
| `--text-verse-en` | `3vh` | verse translation |
| `--text-verse-ar` | `5.6vh` | verse Arabic (hero) |
| `--text-countdown` | `12vh` | countdown (hero) |

## Spacing Variables
*(skill `design_system.py` — Standard density scale)*

| Token | Value |
|-------|-------|
| `--space-xs` | `4px` |
| `--space-sm` | `8px` |
| `--space-md` | `16px` |
| `--space-lg` | `24px` |
| `--space-xl` | `32px` |
| `--space-2xl` | `48px` |
| `--space-3xl` | `64px` |

**Shared layout rhythm:** `--pad-x: 4vw` (gutter shared by header + every slide);
`--rhythm: 2.4vh` (vertical baseline unit).

## Shadow Depths
*(skill `design_system.py`)*

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` |
| `--glow-gold` | `0 18px 60px -18px rgba(212,175,55,0.55)` | *(hero emphasis, gold)* |

## Radius
| Token | Value |
|-------|-------|
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-pill` | `999px` |

---

## Impeccable Anti-Patterns (filter — do NOT ship)
*(skill Pre-Delivery + Anti-Pattern rules; "no animation work" applies here.)*

- ❌ Emojis as icons — use SVG or typographic marks
- ❌ Low-contrast text — maintain ≥ 4.5:1 (≥ 3:1 large)
- ❌ Raw hex in components — reference `--color-*` tokens only
- ❌ Text < 12px / non-glanceable sizes on a signage board
- ❌ Empty-state / "loading" / "no data" text — hide the block, drop it from rotation
- ❌ Gray-on-gray, more than one hero per screen
- ❌ Layout-shifting hovers, decorative-only animation (no animation added by design)
- ❌ Tofu (□) / broken glyphs in Arabic — use Amiri Quran, RTL isolated

## Behavioural Hierarchy (glance model)
1. **One hero per slide**, isolated in gold (Von Restorff): countdown (prayers) / verse (reminders).
2. Supporting data in muted foreground.
3. Strong figure/ground contrast for distance legibility.
