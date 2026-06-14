import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
const STORAGE_KEY = 'safevault-theme';
const LIGHT = 'safevault';
const DARK = 'safevault-dark';

function resolveInitial(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(resolveInitial);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      mode === 'dark' ? DARK : LIGHT,
    );
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggle = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'));
  return { mode, toggle };
}
