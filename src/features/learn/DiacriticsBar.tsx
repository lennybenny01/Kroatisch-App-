import type { RefObject } from 'react';

const CHARS = ['č', 'ć', 'š', 'ž', 'đ'];

/** Inserts Croatian special characters at the cursor without closing the keyboard. */
export function DiacriticsBar({ inputRef, onInsert }: { inputRef: RefObject<HTMLInputElement | null>; onInsert: (value: string) => void }) {
  const insert = (ch: string) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    // Capitalise if the user is at the very start and typed nothing yet? Keep lowercase – answers are case-insensitive.
    const value = el.value.slice(0, start) + ch + el.value.slice(end);
    onInsert(value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  };
  return (
    <div className="diacritics-bar" role="toolbar" aria-label="Sonderzeichen">
      {CHARS.map((ch) => (
        <button
          key={ch}
          type="button"
          // preventDefault keeps focus (and the keyboard) in the input
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => insert(ch)}
          aria-label={`${ch} einfügen`}
        >
          {ch}
        </button>
      ))}
    </div>
  );
}
