'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Controlled dollar input.
 * Accepts digits, one dot, and up to 2 decimal places. Emits the raw string;
 * parsing to cents happens at submit time via `toCents()`.
 */
export function AmountInput({
  value,
  onChange,
  id = 'amount',
  name = 'amount',
  className,
  ...rest
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  name?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'id' | 'name'>) {
  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // Allow only digits and one dot, with max 2 decimal places.
    if (raw === '' || /^\d*(\.\d{0,2})?$/.test(raw)) {
      onChange(raw);
    }
  }
  return (
    <div className={cn('relative', className)}>
      <span
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
        aria-hidden
      >
        $
      </span>
      <Input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={handle}
        placeholder="0.00"
        className="pl-7 font-mono tabular-nums"
        data-testid="amount-input"
        {...rest}
      />
    </div>
  );
}
