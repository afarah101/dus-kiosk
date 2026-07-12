# Masjid Daar Us Sunnah — Signage Design System (DESIGN.md)

Single source of truth for the entrance-signage TV. Authored with the
`ui-ux-pro-max` design skill (installed at `.claude/skills/ui-ux-pro-max`).
Every value in `style.css` is a token defined here — no hand-picked values in
components. Filtered through anti-pattern rules; no animation.

## 1. Brand foundation
- **Surface tone:** charcoal, matched to the logo mount — `#2E2E2E`. Replaces the
  prior navy entirely.
- **Accent:** brand gold, sampled from the logo calligraphy (muted bronze-gold
  core ≈ `#7E612E`), read up to signage brightness on charcoal.
- **Logo:** `logo.png` — gold calligraphy, white background knocked out to
  transparent so it blends seamlessly on charcoal with no seam/box.

## 2. Colour tokens
| Token | Value | Use |
|---|---|---|
| `--color-background` | `#2E2E2E` | page background (charcoal) everywhere |
| `--color-surface`    | `#383838` | cards / panels |
| `--color-surface-2`  | `#424242` | raised / inner surfaces |
| `--color-border`     | `#4C4C4C` | hairline borders / dividers |
| `--color-foreground` | `#F5F3EE` | primary text (warm off-white) |
| `--color-muted`      | `#A8A29A` | secondary / supporting text |
| `--color-gold`       | `#B98D4E` | accent — sampled logo gold |
| `--color-gold-bright`| `#DBB768` | highlight (up-next, glow, emphasis) |
| `--color-gold-deep`  | `#8A6A3A` | deep/quiet gold |
| `--color-on-gold`    | `#2E2E2E` | text on gold fills |

## 3. Typography (official — do not change)
- **Serif — Cormorant Garamond** → prayer names, section headings, dates,
  verse translation, content titles (`--font-serif`).
- **Sans — DM Sans** → times, countdown, labels, data, day headers, captions
  (`--font-sans`).
- **Arabic — Amiri Quran** → Qur'an verses + Arabic prayer names / Hijri date
  (`--font-arabic`), RTL isolated.

Type scale (vh, tuned for a 3–5 m TV read):
`--text-badge 2` · `--text-xs 2.2` · `--text-sm 2.6` · `--text-lesson-sub 2.5`
`--text-lesson 2.9` · `--text-label 3.2` · `--text-body 3.6` · `--text-h2 4.4`
`--text-verse-en 4` · `--text-edate 6` · `--text-time 6.6` · `--text-verse-ar 6.8`
`--text-time-next 7.4` · `--text-countdown 13`

## 4. Spacing — strict 8pt grid (McKinsey/BCG rhythm)
All padding, gaps, margins are multiples of 8 (4px half-step only where optical).
`--s-half 4` · `--s1 8` · `--s2 16` · `--s3 24` · `--s4 32` · `--s5 40`
`--s6 48` · `--s8 64` · `--s10 80`
- Page gutter: `--s8` (64) · Section rhythm: `--s6` (48)
- Card padding: `--s3`–`--s4` · Card gap: `--s3` (24) · Inner stack: `--s1`/`--s2`

## 5. Radius / elevation
`--radius-md 12` · `--radius-lg 16` · `--radius-pill 999`
`--shadow-card 0 8px 24px rgba(0,0,0,.35)` · `--glow-gold 0 16px 48px -16px rgba(185,141,78,.55)`

## 6. Layout rhythm
- 4 slides, one focal point each; empty collections hidden + skipped.
- Prayer: countdown hero + Jamā'ah trigger; upcoming prayer isolated in gold.
- Verses hardcoded (4:103, 2:153, 13:28, 29:45; Fri 62:9, 33:56), Muhsin Khan
  English, Arabic on top — verse is the hero.
