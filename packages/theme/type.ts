export type ThemeVars = Record<string, string>;
export interface IThemeManager<Name extends string> {
  readonly current: Name;
  getTheme(): ThemeVars;
  setTheme(name: Name): void;
  createLocal(overrides: Partial<ThemeVars>): ThemeVars;
  exportTheme(): string;
  importTheme(vars: ThemeVars): void;
  readonly themes: Array<{ value: Name; label?: string; labelKey?: string }>;
}
export type Palette = {
  primary: string; secondary: string; accent: string; success: string; warning: string; danger: string;
  bg: string; text: string; surface: string; border: string; muted: string; btnText: string;
};
export type ThemeLabel = { label: string; labelKey?: never } | { labelKey: string; label?: never };
export type ThemeItem<Name extends string> = { value: Name; palette: Palette } & ThemeLabel;
