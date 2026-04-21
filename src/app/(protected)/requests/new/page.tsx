import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { NewRequestForm } from './NewRequestForm';

export const dynamic = 'force-dynamic';

export default function NewRequestPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">New request</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask a friend for money. They'll get a shareable link.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <NewRequestForm />
      </div>
    </div>
  );
}
