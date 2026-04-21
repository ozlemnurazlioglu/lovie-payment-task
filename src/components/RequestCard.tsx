import Link from 'next/link';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { AmountDisplay } from '@/components/AmountDisplay';
import { StatusBadge } from '@/components/StatusBadge';
import type { PaymentRequest } from '@/lib/types';
import { cn } from '@/lib/utils';

export function RequestCard({
  request,
  viewpoint,
}: {
  request: PaymentRequest;
  viewpoint: 'outgoing' | 'incoming';
}) {
  const counterpartyEmail =
    viewpoint === 'outgoing' ? request.recipient_email : request.sender_email;
  const Icon = viewpoint === 'outgoing' ? ArrowUpRight : ArrowDownLeft;

  return (
    <Link
      href={`/requests/${request.id}`}
      className={cn(
        'group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-foreground/20',
      )}
      data-testid="request-card"
      data-request-id={request.id}
      data-request-status={request.status}
      data-request-viewpoint={viewpoint}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{counterpartyEmail}</div>
        {request.note ? (
          <div className="truncate text-xs text-muted-foreground">{request.note}</div>
        ) : (
          <div className="text-xs text-muted-foreground/70">
            {viewpoint === 'outgoing' ? 'You requested' : 'Requested from you'}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <AmountDisplay cents={request.amount_cents} size="md" className="font-medium" />
        <StatusBadge status={request.status} />
      </div>
    </Link>
  );
}
