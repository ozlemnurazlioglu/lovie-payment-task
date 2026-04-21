'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AmountInput } from '@/components/AmountInput';
import { createRequest, type CreateResult } from './actions';

const initialState: CreateResult | null = null;

export function NewRequestForm() {
  const [state, formAction] = useFormState<CreateResult | null, FormData>(
    createRequest,
    initialState,
  );
  const [amount, setAmount] = React.useState('');

  const err = state && !state.ok ? state : null;

  return (
    <form action={formAction} className="space-y-5" data-testid="create-request-form">
      <div className="space-y-1.5">
        <Label htmlFor="recipient_email">Recipient email</Label>
        <Input
          id="recipient_email"
          name="recipient_email"
          type="email"
          autoComplete="off"
          required
          placeholder="friend@example.com"
          aria-invalid={err?.field === 'recipient_email' ? 'true' : undefined}
          data-testid="recipient-email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount</Label>
        <AmountInput
          value={amount}
          onChange={setAmount}
          aria-invalid={err?.field === 'amount' ? 'true' : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">
          Note <span className="normal-case text-muted-foreground/70">(optional)</span>
        </Label>
        <Textarea
          id="note"
          name="note"
          rows={3}
          maxLength={280}
          placeholder="What's this for?"
          data-testid="note-input"
        />
      </div>

      {err ? (
        <p
          role="alert"
          className="border-l-2 border-destructive pl-3 text-sm text-destructive"
          data-testid="form-error"
        >
          {err.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      className="w-full"
      disabled={pending}
      data-testid="submit-request"
    >
      {pending ? 'Creating…' : 'Send request'}
    </Button>
  );
}
