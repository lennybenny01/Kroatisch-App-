import { useEffect } from 'react';
import { useSettings } from './useSettings';

/** Applies the chosen theme to <html data-theme>. "system" follows the OS setting via CSS. */
export function useTheme() {
  const { theme } = useSettings();
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      if (theme !== 'system') m.setAttribute('content', dark ? '#0f1115' : '#f6f4ef');
    });
  }, [theme]);
}
