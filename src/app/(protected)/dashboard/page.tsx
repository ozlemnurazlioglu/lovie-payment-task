import Link from 'next/link';
import { Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RequestCard } from '@/components/RequestCard';
import { EmptyState } from '@/components/EmptyState';
import { createClient } from '@/lib/supabase/server';
import type { PaymentRequest, RequestStatus } from '@/lib/types';
import { SearchFilter } from './SearchFilter';

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

const STATUS_VALUES: RequestStatus[] = ['pending', 'paid', 'declined', 'cancelled', 'expired'];

function matchesQuery(row: PaymentRequest, q: string | null): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.recipient_email.toLowerCase().includes(needle) ||
    row.sender_email.toLowerCase().includes(needle) ||
    (row.note ?? '').toLowerCase().includes(needle)
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { tab?: string; status?: string; q?: string };
}) {
  const tab: 'incoming' | 'outgoing' =
    searchParams.tab === 'outgoing' ? 'outgoing' : 'incoming';
  const statusFilter = STATUS_VALUES.includes(searchParams.status as RequestStatus)
    ? (searchParams.status as RequestStatus)
    : null;
  const q = searchParams.q?.trim() || null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from('payment_requests')
    .select(
      'id, sender_id, recipient_email, recipient_id, amount_cents, note, status, created_at, expires_at, paid_at, shareable_link, sender:profiles!payment_requests_sender_id_fkey(email)',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (statusFilter) query = query.eq('status', statusFilter);

  const { data, error } = await query;
  const rows: PaymentRequest[] = error ? [] : ((data ?? []) as unknown as Row[]).map(toApi);

  const userEmail = (user?.email ?? '').toLowerCase();
  const outgoingAll = rows
    .filter((r) => r.sender_id === user?.id)
    .filter((r) => matchesQuery(r, q));
  const incomingAll = rows
    .filter(
      (r) => r.recipient_id === user?.id || r.recipient_email.toLowerCase() === userEmail,
    )
    .filter((r) => r.sender_id !== user?.id)
    .filter((r) => matchesQuery(r, q));

  const list = tab === 'incoming' ? incomingAll : outgoingAll;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === 'incoming'
              ? 'Money people have asked you for.'
              : "Money you've asked for."}
          </p>
        </div>
        <Link
          href="/requests/new"
          data-testid="new-request-button"
          className={cn(buttonVariants({ size: 'sm' }))}
        >
          <Plus className="h-4 w-4" /> New request
        </Link>
      </div>

      <nav className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Request direction">
        <TabLink
          href={buildUrl({ ...searchParams, tab: 'incoming' })}
          active={tab === 'incoming'}
          testid="dashboard-tab-incoming"
        >
          Incoming
          <CountPill count={incomingAll.length} />
        </TabLink>
        <TabLink
          href={buildUrl({ ...searchParams, tab: 'outgoing' })}
          active={tab === 'outgoing'}
          testid="dashboard-tab-outgoing"
        >
          Outgoing
          <CountPill count={outgoingAll.length} />
        </TabLink>
      </nav>

      <SearchFilter />

      {list.length === 0 ? (
        <EmptyState
          title={tab === 'incoming' ? 'Nothing to pay right now' : "You haven't sent any requests"}
          description={
            tab === 'incoming'
              ? 'When someone requests money from you, it will land here.'
              : 'Create a request to ask a friend for money. You can share a link when you do.'
          }
          action={tab === 'outgoing' ? { label: 'New request', href: '/requests/new' } : undefined}
        />
      ) : (
        <ul className="space-y-3" data-testid="request-list">
          {list.map((r) => (
            <li key={r.id}>
              <RequestCard request={r} viewpoint={tab} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildUrl(p: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : '/dashboard';
}

function TabLink({
  href,
  active,
  children,
  testid,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  testid: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      data-testid={testid}
      data-active={active ? 'true' : 'false'}
      className={
        active
          ? 'inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-background px-3 py-1.5 text-sm font-medium shadow-sm'
          : 'inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
      }
    >
      {children}
    </Link>
  );
}

function CountPill({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
      {count}
    </span>
  );
}
