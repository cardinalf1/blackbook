import { useState } from 'react';
import { T } from './tokens';

/**
 * A date input that reads like a normal field when empty: it shows a plain placeholder until it is
 * focused or has a value, instead of the browser's raw "dd-----yyyy" mask. Value is yyyy-mm-dd or ''.
 */
export function DateField({ id, value, onChange, placeholder = 'Any date', label }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  const [focused, setFocused] = useState(false);
  const asDate = focused || value !== '';
  return (
    <input
      id={id}
      aria-label={label}
      type={asDate ? 'date' : 'text'}
      value={value}
      placeholder={asDate ? undefined : placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => onChange(e.target.value)}
      className={`${T.input} w-40 placeholder:text-zinc-500`}
    />
  );
}
