export type RequestStatus = 'pending' | 'paid' | 'declined' | 'cancelled' | 'expired';

export type PaymentRequest = {
  id: string;
  sender_id: string;
  sender_email: string;
  recipient_email: string;
  recipient_id: string | null;
  amount_cents: number;
  note: string | null;
  status: RequestStatus;
  created_at: string;
  expires_at: string;
  paid_at: string | null;
  shareable_link: string;
};

export type PublicRequestView = {
  amount_cents: number;
  note: string | null;
  sender_email: string;
  status: RequestStatus;
  expires_at: string;
};
