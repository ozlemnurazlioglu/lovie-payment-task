'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

function format(msRemaining: number): { label: string; expired: boolean } {
  if (msRemaining <= 0) return { label: 'Expired', expired: true };
  const totalSeconds = Math.floor(msRemaining / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return { label: `Expires in ${days}d ${hours}h`, expired: false };
  if (hours > 0) return { label: `Expires in ${hours}h ${minutes}m`, expired: false };
  return { label: `Expires in ${minutes}m`, expired: false };
}

export function ExpirationCountdown({
  expiresAt,
  className,
}: {
  expiresAt: string;
  className?: string;
}) {
  const target = React.useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [now, setNow] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const { label, expired } = format(target - now);
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        expired ? 'text-muted-foreground' : 'text-muted-foreground',
        className,
      )}
      data-testid="expiration-countdown"
      data-expired={expired ? 'true' : 'false'}
    >
      {label}
    </span>
  );
}
