export type Platform = 'ios' | 'android' | 'desktop';
export type Browser = 'safari' | 'chrome' | 'firefox' | 'samsung' | 'edge' | 'other';

export interface PlatformInfo {
  platform: Platform;
  browser: Browser;
  /** Started from the home screen (installed PWA). */
  standalone: boolean;
}

/** Detects platform and browser from a user agent string (pure – testable). */
export function detectPlatform(ua: string, standalone = false, maxTouchPoints = 0): PlatformInfo {
  // iPadOS 13+ reports itself as Macintosh – touch points give it away.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  const android = /Android/.test(ua);
  let browser: Browser = 'other';
  if (/SamsungBrowser/.test(ua)) browser = 'samsung';
  else if (/Edg\//.test(ua)) browser = 'edge';
  else if (/Firefox|FxiOS/.test(ua)) browser = 'firefox';
  else if (/Chrome|CriOS/.test(ua)) browser = 'chrome';
  else if (/Safari/.test(ua)) browser = 'safari';
  return { platform: ios ? 'ios' : android ? 'android' : 'desktop', browser, standalone };
}

export function currentPlatform(): PlatformInfo {
  if (typeof navigator === 'undefined') return { platform: 'desktop', browser: 'other', standalone: false };
  const standalone =
    (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectPlatform(navigator.userAgent, standalone, navigator.maxTouchPoints ?? 0);
}
