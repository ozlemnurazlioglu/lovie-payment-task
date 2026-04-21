import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators';
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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!uuidSchema.safeParse(params.id).success) return errorJson('not_found');

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return errorJson('unauthenticated');

  const { data, error } = await supabase
    .from('payment_requests')
    .select(
      'id, sender_id, recipient_email, recipient_id, amount_cents, note, status, created_at, expires_at, paid_at, shareable_link, sender:profiles!payment_requests_sender_id_fkey(email)',
    )
    .eq('id', params.id)
    .maybeSingle();

  if (error) return errorJson('server');
  if (!data) return errorJson('not_found');

  return okJson(toApi(data as unknown as Row));
}
