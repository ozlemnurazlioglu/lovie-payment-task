import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AmountDisplay } from '@/components/AmountDisplay';
import { StatusBadge } from '@/components/StatusBadge';
import { ExpirationCountdown } from '@/components/ExpirationCountdown';
import { RequestActions } from '@/components/RequestActions';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators';
import type { PublicRequestView, RequestStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PublicPayPage({ params }: { params: { link: string } }) {
  if (!uuidSchema.safeParse(params.link).success) notFound();

  const supabase = createClient();

  const { data: publicRow } = await supabase.rpc('get_public_request', {
    link_id: params.link,
  });
  const publicView: PublicRequestView | null = Array.isArray(publicRow)
    ? (publicRow[0] ?? null)
    : (publicRow ?? null);
  if (!publicView) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If the viewer is signed in AND a party to the request, RLS will return the full row.
  const { data: privateRow } = user
    ? await supabase
        .from('payment_requests')
        .select('id, sender_id, recipient_id, recipient_email, status, expires_at')
        .eq('shareable_link', params.link)
        .maybeSingle()
    : { data: null };

  const userEmail = (user?.email ?? '').toLowerCase();
  const isRecipient =
    !!privateRow &&
    (privateRow.recipient_id === user?.id ||
      privateRow.recipient_email.toLowerCase() === userEmail);
  const isSender = !!privateRow && privateRow.sender_id === user?.id;

  const isExpired =
    publicView.status === 'pending' &&
    new Date(publicView.expires_at).getTime() <= Date.now();
  const status: RequestStatus = isExpired ? 'expired' : publicView.status;

  return (
    <main className="grain relative min-h-dvh bg-[radial-gradient(1200px_600px_at_50%_-200px,hsl(160_84%_95%),transparent)]">
      <div className="mx-auto max-w-lg px-6 py-12">
        <div className="mb-8 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/20">
            <span className="font-mono text-[10px] font-semibold tracking-tight text-primary">
              PR
            </span>
          </span>
          <span className="text-sm font-semibold tracking-tight">PayRequest</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">From</span>
            <StatusBadge status={status} />
          </div>
          <div
            className="mt-1 text-base font-medium"
            data-testid="public-sender-email"
          >
            {publicView.sender_email}
          </div>

          <div className="mt-8">
            <AmountDisplay cents={publicView.amount_cents} size="xl" />
          </div>

          {publicView.note ? (
            <p className="mt-4 text-sm text-muted-foreground">{publicView.note}</p>
          ) : null}

          <div className="mt-6 border-t border-border pt-4 text-xs">
            {status === 'pending' ? (
              <ExpirationCountdown expiresAt={publicView.expires_at} />
            ) : (
              <span className="text-muted-foreground">This request is closed.</span>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm">
          {!user ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Sign in to pay or decline this request.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(`/pay/${params.link}`)}`}
                data-testid="public-signin-cta"
                className={cn(buttonVariants({ size: 'lg' }), 'w-full')}
              >
                Sign in to continue
              </Link>
            </div>
          ) : isRecipient && privateRow ? (
            <RequestActions
              requestId={privateRow.id}
              role="recipient"
              status={isExpired ? 'expired' : privateRow.status}
            />
          ) : isSender ? (
            <p className="text-sm text-muted-foreground">
              You sent this request. Track it from your{' '}
              <Link href="/dashboard?tab=outgoing" className="text-foreground underline">
                dashboard
              </Link>
              .
            </p>
          ) : (
            <p
              className="text-sm text-muted-foreground"
              data-testid="public-wrong-recipient"
            >
              This request isn't addressed to the email you're signed in with.
            </p>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          You're viewing a shared request link.
        </p>
      </div>
    </main>
  );
}
