import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { ArrowLeft } from 'lucide-react';
import { AmountDisplay } from '@/components/AmountDisplay';
import { StatusBadge } from '@/components/StatusBadge';
import { ExpirationCountdown } from '@/components/ExpirationCountdown';
import { RequestActions } from '@/components/RequestActions';
import { ShareLinkCopy } from '@/components/ShareLinkCopy';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators';
import type { PaymentRequest, RequestStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  sender_id: string;
  recipient_email: string;
  recipient_id: string | null;
  amount_cents: number;
  note: string | null;
  status: RequestStatus;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  shareable_link: string;
  sender: { email: string } | null;
};

function toApi(row: Row): PaymentRequest {
  return {
    id: row.id,
    sender_id: row.sender_id,
    sender_email: row.sender?.email ?? '',
    recipient_email: row.recipient_email,
    recipient_id: row.recipient_id,
    amount_cents: row.amount_cents,
    note: row.note,
    status: row.status,
    created_at: row.created_at,
    expires_at: row.expires_at,
    paid_at: row.paid_at,
    shareable_link: row.shareable_link,
  };
}

export default async function RequestDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string };
}) {
  if (!uuidSchema.safeParse(params.id).success) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('payment_requests')
    .select(
      'id, sender_id, recipient_email, recipient_id, amount_cents, note, status, created_at, expires_at, paid_at, shareable_link, sender:profiles!payment_requests_sender_id_fkey(email)',
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data) notFound();
  const r = toApi(data as unknown as Row);

  const isSender = r.sender_id === user?.id;
  const isRecipient =
    r.recipient_id === user?.id ||
    (user?.email ?? '').toLowerCase() === r.recipient_email.toLowerCase();

  const role = isSender ? ('sender' as const) : ('recipient' as const);
  const counterpartyLabel = isSender ? 'To' : 'From';
  const counterpartyEmail = isSender ? r.recipient_email : r.sender_email;

  // Build the share URL from request headers so it is always absolute
  // regardless of env-var state. Falls back to NEXT_PUBLIC_APP_URL if set
  // (trimmed to defend against accidental trailing whitespace/newlines).
  const h = headers();
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const shareBase = envBase && envBase.length > 0 ? envBase : `${proto}://${host}`;
  const shareUrl = `${shareBase}/pay/${r.shareable_link}`;

  const isExpired =
    r.status === 'pending' && new Date(r.expires_at).getTime() <= Date.now();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {searchParams.created ? (
        <div
          className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-primary"
          data-testid="created-banner"
        >
          Request created. Share the link below with{' '}
          <span className="font-medium">{r.recipient_email}</span>.
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {counterpartyLabel}
          </span>
          <StatusBadge status={isExpired ? 'expired' : r.status} />
        </div>

        <div className="mt-1 text-base font-medium" data-testid="counterparty-email">
          {counterpartyEmail}
        </div>

        <div className="mt-8">
          <AmountDisplay cents={r.amount_cents} size="xl" />
        </div>

        {r.note ? (
          <p className="mt-4 text-sm text-muted-foreground" data-testid="request-note">
            {r.note}
          </p>
        ) : null}

        <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs">
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="mt-0.5 font-mono tabular-nums">
              {new Date(r.created_at).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{r.status === 'paid' ? 'Paid' : 'Expires'}</dt>
            <dd className="mt-0.5 font-mono tabular-nums">
              {r.status === 'paid' && r.paid_at
                ? new Date(r.paid_at).toLocaleString()
                : r.status === 'pending'
                  ? <ExpirationCountdown expiresAt={r.expires_at} />
                  : '—'}
            </dd>
          </div>
        </dl>
      </div>

      {isSender ? (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Shareable link
          </div>
          <ShareLinkCopy url={shareUrl} />
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <RequestActions requestId={r.id} role={role} status={isExpired ? 'expired' : r.status} />
      </div>
    </div>
  );
}
