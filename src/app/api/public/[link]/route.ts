import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validators';
import { errorJson, okJson } from '@/lib/api-error';
import type { PublicRequestView } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { link: string } }) {
  if (!uuidSchema.safeParse(params.link).success) return errorJson('not_found');

  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_public_request', { link_id: params.link });

  if (error) return errorJson('server');
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return errorJson('not_found');

  const view: PublicRequestView = {
    amount_cents: row.amount_cents,
    note: row.note,
    sender_email: row.sender_email,
    status: row.status,
    expires_at: row.expires_at,
  };
  return okJson(view);
}
