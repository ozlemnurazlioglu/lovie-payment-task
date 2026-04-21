import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

export function AmountDisplay({
  cents,
  className,
  size = 'md',
}: {
  cents: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizeClass = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl tracking-tight',
    xl: 'text-4xl font-semibold tracking-tight',
  }[size];
  return (
    <span
      className={cn('tabular-nums', sizeClass, className)}
      data-testid="amount"
      data-cents={cents}
    >
      {formatCents(cents)}
    </span>
  );
}
