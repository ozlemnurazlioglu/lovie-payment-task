'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import type { RequestStatus } from '@/lib/types';

type Role = 'sender' | 'recipient';

export function RequestActions({
  requestId,
  role,
  status,
}: {
  requestId: string;
  role: Role;
  status: RequestStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<null | 'pay' | 'decline' | 'cancel'>(null);
  const [error, setError] = React.useState<string | null>(null);

  const disabled = status !== 'pending' || busy !== null;

  async function call(action: 'pay' | 'decline' | 'cancel') {
    setError(null);
    setBusy(action);
    try {
      const res = await fetch(`/api/requests/${requestId}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'server' }));
        const msg =
          body.error === 'expired'
            ? 'This request has expired.'
            : body.error === 'conflict'
              ? `This request is already ${body.status ?? 'closed'}.`
              : body.error === 'forbidden'
                ? 'You cannot take this action.'
                : body.error === 'not_found'
                  ? 'Request not found.'
                  : 'Something went wrong.';
        setError(msg);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(null);
    }
  }

  if (status !== 'pending') {
    return (
      <p className="text-sm text-muted-foreground">
        This request is {status}. No further actions.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {role === 'recipient' ? (
        <div className="flex gap-2">
          <Button
            type="button"
            size="lg"
            className="flex-1"
            disabled={disabled}
            onClick={() => call('pay')}
            data-testid="pay-button"
          >
            {busy === 'pay' ? <PayingLabel /> : 'Pay'}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="flex-1"
            disabled={disabled}
            onClick={() => call('decline')}
            data-testid="decline-button"
          >
            {busy === 'decline' ? 'Declining…' : 'Decline'}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={disabled}
          onClick={() => call('cancel')}
          data-testid="cancel-button"
        >
          {busy === 'cancel' ? 'Cancelling…' : 'Cancel request'}
        </Button>
      )}
      {error ? (
        <p
          role="alert"
          className="border-l-2 border-destructive pl-3 text-sm text-destructive"
          data-testid="action-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PayingLabel() {
  return (
    <span className="inline-flex items-center gap-2" data-testid="pay-loading">
      <span className="relative flex h-3 w-3">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-primary-foreground" />
      </span>
      Processing…
    </span>
  );
}
