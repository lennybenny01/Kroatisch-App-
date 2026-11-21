import { useEffect } from 'react';

/**
 * Exposes the visual viewport (the area not covered by the on-screen keyboard)
 * as CSS variables: --vv-height, --vv-top and --kb-open (0/1).
 * Needed on iOS, where the keyboard overlays the page instead of resizing it.
 */
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv) return;
    const update = () => {
      root.style.setProperty('--vv-height', `${vv.height}px`);
      root.style.setProperty('--vv-top', `${vv.offsetTop}px`);
      root.style.setProperty('--kb-open', window.innerHeight - vv.height > 120 ? '1' : '0');
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--vv-height');
      root.style.removeProperty('--vv-top');
      root.style.removeProperty('--kb-open');
    };
  }, []);
}
