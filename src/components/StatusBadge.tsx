import { Badge } from '@/components/ui/badge';
import type { RequestStatus } from '@/lib/types';

const TONE: Record<RequestStatus, 'success' | 'warning' | 'danger' | 'muted'> = {
  paid: 'success',
  pending: 'warning',
  declined: 'danger',
  expired: 'muted',
  cancelled: 'muted',
};

const LABEL: Record<RequestStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  declined: 'Declined',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge tone={TONE[status]} data-testid="status-badge" data-status={status}>
      {LABEL[status]}
    </Badge>
  );
}
