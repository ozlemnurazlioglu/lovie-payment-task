'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import type { RequestStatus } from '@/lib/types';

const STATUSES: Array<RequestStatus | 'all'> = [
  'all',
  'pending',
  'paid',
  'declined',
  'cancelled',
  'expired',
];

export function SearchFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStatus = (searchParams.get('status') ?? 'all') as RequestStatus | 'all';
  const currentQ = searchParams.get('q') ?? '';
  const [q, setQ] = React.useState(currentQ);

  // Debounce q → URL.
  React.useEffect(() => {
    const h = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (q) next.set('q', q);
      else next.delete('q');
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 250);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setStatus(s: RequestStatus | 'all') {
    const next = new URLSearchParams(searchParams.toString());
    if (s === 'all') next.delete('status');
    else next.set('status', s);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search email or note"
        className="sm:max-w-xs"
        data-testid="filter-q"
      />
      <div
        className="flex flex-wrap gap-1"
        role="tablist"
        aria-label="Filter by status"
        data-testid="filter-status"
      >
        {STATUSES.map((s) => {
          const active = s === currentStatus;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              data-active={active ? 'true' : 'false'}
              data-value={s}
              className={
                active
                  ? 'rounded-full border border-foreground/20 bg-foreground px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-background'
                  : 'rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:border-foreground/20 hover:text-foreground'
              }
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
