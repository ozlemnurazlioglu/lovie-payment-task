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
    .select('id, sender_id, status')
    .eq('id', params.id)
    .maybeSingle();
  if (fetchErr) return errorJson('server');
  if (!row) return errorJson('not_found');

  if (row.sender_id !== user.id) return errorJson('forbidden');
  if (row.status !== 'pending')
    return errorJson('conflict', { status: row.status as RequestStatus });

  const { data: updated, error: updateErr } = await supabase
    .from('payment_requests')
    .update({ status: 'cancelled' })
    .eq('id', params.id)
    .eq('sender_id', user.id)
    .eq('status', 'pending')
    .select(
      'id, sender_id, sender:profiles!payment_requests_sender_id_fkey(email), recipient_email, recipient_id, amount_cents, note, status, created_at, expires_at, paid_at, shareable_link',
    )
    .maybeSingle();

  if (updateErr) return errorJson('server');
  if (!updated) {
    const { data: latest } = await supabase
      .from('payment_requests')
      .select('status')
      .eq('id', params.id)
      .maybeSingle();
    if (!latest) return errorJson('not_found');
    return errorJson('conflict', { status: latest.status as RequestStatus });
  }

  return okJson(updated);
}
