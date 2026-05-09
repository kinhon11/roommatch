# Design System

## Theme

Light. Vietnamese tenants browse rooms on phones in well-lit cafes, dorm rooms, and offices. Landlords manage listings at a desk. Bright, airy surfaces let room photos breathe and prices pop.

## Color Strategy

Restrained. Tinted neutrals with a single teal accent. Amber reserved for warnings and secondary emphasis only.

### Palette

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Primary | `--primary` | `#0d9488` | CTAs, active states, links |
| Primary light | `--primary-light` | `#14b8a6` | Hover states, price emphasis |
| Primary dark | `--primary-dark` | `#0f766e` | Active text, selected tabs |
| Primary tint | `--primary-50` | `#f0fdfa` | Selected backgrounds, badges |
| Primary wash | `--primary-100` | `#ccfbf1` | Subtle highlights |
| Accent | `--accent` | `#f59e0b` | Stars, warnings, sparingly |
| Surface | `--bg-surface` | `#ffffff` | Cards, panels |
| Base | `--bg-base` | `#f7f8fa` | Page background |
| Hover | `--bg-hover` | `#f1f5f9` | Hover rows, hover states |
| Text primary | `--text-primary` | `#1e293b` | Headings, body |
| Text secondary | `--text-secondary` | `#64748b` | Supporting text, labels |
| Text muted | `--text-muted` | `#94a3b8` | Placeholders, timestamps |
| Border | `--border` | `#e2e8f0` | Dividers, card borders |
| Success | `--success` | `#16a34a` | Approved, online |
| Danger | `--danger` | `#dc2626` | Errors, rejected, reports |
| Warning | `--warning` | `#ea580c` | Pending states |
| Info | `--info` | `#0ea5e9` | Informational badges |

### Neutrals

All neutrals carry a subtle slate tint (no pure gray). `#f7f8fa` base, `#e2e8f0` border, `#1e293b` text.

## Typography

| Element | Size | Weight | Line height |
|---------|------|--------|-------------|
| Page title (h1) | 28px | 800 | 1.2 |
| Section title (h2) | 20px | 700 | 1.3 |
| Card title (h3) | 16px | 700 | 1.4 |
| Body | 14px | 400 | 1.6 |
| Label | 13px | 600 | 1.4 |
| Caption/meta | 12px | 500 | 1.4 |
| Small | 11px | 500 | 1.3 |

Font: Be Vietnam Pro (300-900). System fallback stack.

## Spacing Scale

4px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. No off-scale values.

## Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 8px | Inputs, small buttons, tags |
| `--radius-md` | 12px | Cards, panels |
| `--radius-lg` | 16px | Modals, sections |
| `--radius-xl` | 20px | Hero elements |
| `--radius-full` | 9999px | Avatars, pills, badges |

## Elevation

Soft, layered shadows. No heavy drop shadows.

| Token | Usage |
|-------|-------|
| `--shadow-xs` | Subtle lift (badges) |
| `--shadow-sm` | Default card |
| `--shadow-md` | Hover cards |
| `--shadow-lg` | Dropdowns, popovers |
| `--shadow-xl` | Modals |

## Motion

- Default: 200ms cubic-bezier(0.4, 0, 0.2, 1)
- Slow: 350ms same curve
- Entry animations: slideUp, fadeIn, scaleIn
- No bounce, no elastic, no orchestrated sequences
- Respect `prefers-reduced-motion`

## Components

### Buttons
Four variants: primary (teal fill), secondary (teal tint), ghost (transparent), danger (red tint). Sizes: sm, default, lg. All have hover, active (scale 0.97), disabled (opacity 0.5), focus-visible.

### Cards
White surface, 1px border, radius-lg, shadow-card. Hover: border darkens, shadow grows, subtle translateY(-3px).

### Badges
Pill shape (radius-full), 12px font, status-colored backgrounds with matching borders. Status set: pending (amber), approved (green), rejected (red), admin (teal), landlord (blue), tenant (green).

### Forms
Inputs: 14px, 12px 16px padding, 1.5px border, radius-md. Focus: teal border + 3px teal glow. Error: red border.

### Empty States
Centered, icon + heading + description + action button. Dashed border, radius-xl.
