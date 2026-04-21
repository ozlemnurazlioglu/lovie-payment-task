'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createRequestSchema } from '@/lib/validators';
import { toCents } from '@/lib/money';

export type CreateResult = { ok: true } | { ok: false; message: string; field?: string };

export async function createRequest(_prev: unknown, formData: FormData): Promise<CreateResult> {
  const email = String(formData.get('recipient_email') ?? '').trim();
  const amountRaw = String(formData.get('amount') ?? '').trim();
  const noteRaw = String(formData.get('note') ?? '').trim();

  const cents = toCents(amountRaw);
  if (cents === null) {
    return { ok: false, message: 'Enter an amount greater than zero.', field: 'amount' };
  }

  const parsed = createRequestSchema.safeParse({
    recipient_email: email,
    amount_cents: cents,
    note: noteRaw,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, message: first.message, field: String(first.path[0] ?? '') };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'You are signed out.' };

  if ((user.email ?? '').toLowerCase() === parsed.data.recipient_email) {
    return {
      ok: false,
      message: 'Cannot request money from yourself.',
      field: 'recipient_email',
    };
  }

  const { data: recipientProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', parsed.data.recipient_email)
    .maybeSingle();

  const { data: inserted, error } = await supabase
    .from('payment_requests')
    .insert({
      sender_id: user.id,
      recipient_email: parsed.data.recipient_email,
      recipient_id: recipientProfile?.id ?? null,
      amount_cents: parsed.data.amount_cents,
      note: parsed.data.note,
    })
    .select('id')
    .single();

  if (error || !inserted) return { ok: false, message: 'Could not create request. Try again.' };

  redirect(`/requests/${inserted.id}?created=1`);
}
