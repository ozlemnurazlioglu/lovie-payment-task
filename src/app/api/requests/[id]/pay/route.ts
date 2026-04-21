import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators';
import { errorJson, okJson } from '@/lib/api-error';
import type { RequestStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!uuidSchema.safeParse(params.id).success) return errorJson('not_found');

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorJson('unauthenticated');

  const { data: row, error: fetchErr } = await supabase
    .from('payment_requests')
    .select('id, sender_id, recipient_id, recipient_email, status, expires_at')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchErr) return errorJson('server');
  if (!row) return errorJson('not_found');

  const userEmail = (user.email ?? '').toLowerCase();
  const isRecipient =
    row.recipient_id === user.id || row.recipient_email.toLowerCase() === userEmail;
  if (!isRecipient) return errorJson('forbidden');

  if (row.status !== 'pending')
    return errorJson('conflict', { status: row.status as RequestStatus });
  if (new Date(row.expires_at).getTime() <= Date.now()) return errorJson('expired');

  // Constitution Principle 4: simulate the payment first, then do a race-safe update.
  await new Promise((r) => setTimeout(r, 2000));

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from('payment_requests')
    .update({ status: 'paid', paid_at: nowIso })
    .eq('id', params.id)
    .eq('status', 'pending')
    .gt('expires_at', nowIso)
    .select(
      'id, sender_id, sender:profiles!payment_requests_sender_id_fkey(email), recipient_email, recipient_id, amount_cents, note, status, created_at, expires_at, paid_at, shareable_link',
    )
    .maybeSingle();

  if (updateErr) return errorJson('server');
  if (!updated) {
    // Race: someone declined / cancelled / it expired during our sleep.
    const { data: latest } = await supabase
      .from('payment_requests')
      .select('status, expires_at')
      .eq('id', params.id)
      .maybeSingle();
    if (!latest) return errorJson('not_found');
    if (new Date(latest.expires_at).getTime() <= Date.now()) return errorJson('expired');
    return errorJson('conflict', { status: latest.status as RequestStatus });
  }

  return okJson(updated);
}
