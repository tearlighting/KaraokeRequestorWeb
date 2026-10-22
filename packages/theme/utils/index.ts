import type { Palette, ThemeVars } from "../type"

function clamp(x: number) {
  return Math.min(255, Math.max(0, x))
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "")
  const bigint = parseInt(clean, 16)
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")
}

function adjust(hex: string, percent: number): string {
  let [r, g, b] = hexToRgb(hex)
  const p = percent / 100
  return rgbToHex(clamp(r! + 255 * p), clamp(g! + 255 * p), clamp(b! + 255 * p))
}

export const lighten = (hex: string, p: number) => adjust(hex, p)
export const darken = (hex: string, p: number) => adjust(hex, -p)
export function generateTheme(p: Palette): ThemeVars {
  return {
    "--color-bg": p.bg,
    "--color-surface": p.surface,
    "--color-border": p.border,

    "--color-text": p.text,
    "--color-muted": p.muted,
    "--color-invert": "#fff",

    "--color-primary": p.primary,
    "--color-secondary": p.secondary,
    "--color-accent": p.accent,
    "--color-success": p.success,
    "--color-warning": p.warning,
    "--color-danger": p.danger,

    "--btn-bg": p.primary,
    "--btn-text": p.btnText,
    "--btn-hover": shadeColor(p.primary, -10),

    "--card-bg": p.surface,
    "--card-border": p.border,

    "--input-bg": p.surface,
    "--input-border": p.border,
    "--input-text": p.text,
    "--input-focus": p.primary,
    "--background": p.bg,
    "--surface": p.surface,
    "--surface-muted": shadeColor(p.surface, p.bg === '#fafafa' || p.bg === '#ffffff' ? -3 : 6),
    "--text": p.text,
    "--muted": p.muted,
    "--primary": p.primary,
    "--primary-strong": p.secondary,
    "--border": p.border,
    "--danger": p.danger,
    "--success": p.success,
    "--radius": "1.25rem",
    "--shadow": p.bg.startsWith('#f') ? "0 16px 40px rgb(27 61 71 / 8%)" : "0 18px 52px rgb(0 0 0 / 28%)",

    // ====== 结构层级（自动派生） ======

    // Level 0：页面底色
    "--surface-0": p.bg,

    // Level 1：基础面板（卡片、顶部 TagView、输入框等）
    "--surface-1": p.surface,

    // Level 2：更深的一层面板（sidebar、hover panel、modal）
    "--surface-2": shadeColor(p.surface, -6),

    // Divider
    "--divider": p.border,

    // Elevation（阴影）
    "--elevation-1": "0 2px 6px rgba(0,0,0,0.05)",
    "--elevation-2": "0 6px 16px rgba(0,0,0,0.08)",

  }
}

function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16)
  let r = (num >> 16) + percent
  let g = ((num >> 8) & 0x00ff) + percent
  let b = (num & 0x0000ff) + percent
  r = Math.min(255, Math.max(0, r))
  g = Math.min(255, Math.max(0, g))
  b = Math.min(255, Math.max(0, b))
  return "#" + (b | (g << 8) | (r << 16)).toString(16).padStart(6, "0")
}

