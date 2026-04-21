import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createRequestSchema } from '@/lib/validators';
import { errorJson, okJson } from '@/lib/api-error';
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

function matchesQuery(row: PaymentRequest, q: string | null): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.recipient_email.toLowerCase().includes(needle) ||
    row.sender_email.toLowerCase().includes(needle) ||
    (row.note ?? '').toLowerCase().includes(needle)
  );
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorJson('unauthenticated');

  const statusParam = req.nextUrl.searchParams.get('status');
  const q = req.nextUrl.searchParams.get('q');

  let query = supabase
    .from('payment_requests')
    .select(
      'id, sender_id, recipient_email, recipient_id, amount_cents, note, status, created_at, expires_at, paid_at, shareable_link, sender:profiles!payment_requests_sender_id_fkey(email)',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  const ALLOWED: RequestStatus[] = ['pending', 'paid', 'declined', 'cancelled', 'expired'];
  if (statusParam && (ALLOWED as string[]).includes(statusParam)) {
    query = query.eq('status', statusParam);
  }

  const { data, error } = await query;
  if (error) return errorJson('server');

  const rows = (data ?? []) as unknown as Row[];
  const all = rows.map(toApi);
  const userEmail = (user.email ?? '').toLowerCase();

  const outgoing = all
    .filter((r) => r.sender_id === user.id)
    .filter((r) => matchesQuery(r, q));
  const incoming = all
    .filter(
      (r) => r.recipient_id === user.id || r.recipient_email.toLowerCase() === userEmail,
    )
    .filter((r) => r.sender_id !== user.id)
    .filter((r) => matchesQuery(r, q));

  return okJson({ outgoing, incoming });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorJson('unauthenticated');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorJson('validation', { issues: [{ path: 'body', message: 'Malformed JSON' }] });
  }

  const parsed = createRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson('validation', {
      issues: parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  const { recipient_email, amount_cents, note } = parsed.data;

  if ((user.email ?? '').toLowerCase() === recipient_email) {
    return errorJson('validation', {
      issues: [
        { path: 'recipient_email', message: 'Cannot request money from yourself' },
      ],
    });
  }

  // Resolve recipient_id if a profile with this email already exists.
  const { data: recipientProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', recipient_email)
    .maybeSingle();

  const { data: inserted, error: insertError } = await supabase
    .from('payment_requests')
    .insert({
      sender_id: user.id,
      recipient_email,
      recipient_id: recipientProfile?.id ?? null,
      amount_cents,
      note,
    })
    .select(
      'id, sender_id, recipient_email, recipient_id, amount_cents, note, status, created_at, expires_at, paid_at, shareable_link, sender:profiles!payment_requests_sender_id_fkey(email)',
    )
    .single();

  if (insertError || !inserted) return errorJson('server');

  return okJson(toApi(inserted as unknown as Row), 201);
}
