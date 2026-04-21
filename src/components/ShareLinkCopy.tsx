'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

export function ShareLinkCopy({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — surface nothing */
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
      <code
        className="flex-1 truncate px-2 text-xs text-muted-foreground"
        data-testid="share-link-url"
      >
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        data-testid="share-copy-button"
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium shadow-sm transition-colors hover:bg-muted"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-primary" />
            <span className="text-primary">Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            Copy
          </>
        )}
      </button>
    </div>
  );
}
