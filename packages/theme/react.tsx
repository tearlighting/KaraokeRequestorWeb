import type { ReactNode } from 'react';
import { createUseReactiveStore } from '../reactiveStore';
import { createThemeManager } from './css-in-js';
import { auroraPalette, cyberPalette, monoPalette, sakuraPalette, sunsetPalette } from './palettes';
import type { ThemeVars } from './type';
import type { ThemeManager } from './css-in-js/core/ThemeManager';

export type ThemeName = 'default' | 'anisong-dark' | 'cyber' | 'sunset' | 'mono';
type ThemeState = {
  current: ThemeName;
  themes: Array<{ value: ThemeName; label?: string; labelKey?: string }>;
  manager: ThemeManager<ThemeName>;
  setTheme(name: ThemeName): void;
  exportTheme(): string;
  importTheme(theme: ThemeVars): void;
};

function storedTheme(): ThemeName {
  try {
    const value = localStorage.getItem('yukari-theme');
    return value === 'anisong-dark' || value === 'cyber' || value === 'sunset' || value === 'mono' ? value : 'default';
  } catch { return 'default'; }
}

export const useThemeStore = createUseReactiveStore<ThemeState>(setData => {
  const manager = createThemeManager()
    .register({ value: 'default', label: 'Sakura', palette: sakuraPalette })
    .register({ value: 'anisong-dark', label: 'Aurora', palette: auroraPalette })
    .register({ value: 'cyber', label: 'Cyber', palette: cyberPalette })
    .register({ value: 'sunset', label: 'Sunset', palette: sunsetPalette })
    .register({ value: 'mono', label: 'Mono', palette: monoPalette }) as ThemeManager<ThemeName>;
  const current = storedTheme();
  manager.setTheme(current);
  document.documentElement.dataset.theme = current;
  return {
    current,
    themes: manager.themes as ThemeState['themes'],
    manager,
    setTheme(name) {
      manager.setTheme(name);
      document.documentElement.dataset.theme = name;
      try { localStorage.setItem('yukari-theme', name); } catch { /* storage can be disabled */ }
      setData(state => { state.current = name; });
    },
    exportTheme: () => manager.exportTheme(),
    importTheme(theme) { manager.importTheme(theme); },
  };
});

export function useTheme() {
  const current = useThemeStore(state => state.current);
  const setTheme = useThemeStore(state => state.setTheme);
  const themes = useThemeStore(state => state.themes);
  return { theme: current, setTheme, themes };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useThemeStore(state => state.current);
  return children;
}
