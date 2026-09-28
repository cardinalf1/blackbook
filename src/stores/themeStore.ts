import { create } from 'zustand';

export type ThemeMode = 'stealth' | 'raw';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const saved = (localStorage.getItem('blackbook_theme') as ThemeMode) || 'stealth';
  return {
    theme: saved,
    setTheme: (theme) => {
      localStorage.setItem('blackbook_theme', theme);
      set({ theme });
    },
    toggleTheme: () => {
      set((state) => {
        const next = state.theme === 'stealth' ? 'raw' : 'stealth';
        localStorage.setItem('blackbook_theme', next);
        return { theme: next };
      });
    },
  };
});
