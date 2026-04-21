import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn } from './actions';

export const dynamic = 'force-dynamic';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const err = searchParams.error;
  const next = searchParams.next ?? '/dashboard';

  return (
    <main className="grain relative flex min-h-dvh items-center justify-center bg-[radial-gradient(1200px_600px_at_50%_-200px,hsl(160_84%_95%),transparent)] px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <span className="font-mono text-xs font-semibold tracking-tight text-primary">PR</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">PayRequest</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <form action={signIn} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>

          {err ? (
            <p
              role="alert"
              className="border-l-2 border-destructive pl-3 text-sm text-destructive"
              data-testid="login-error"
            >
              {err}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full">
            Sign in
          </Button>
        </form>

        <div className="mt-8 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <div className="mb-1 font-medium uppercase tracking-wider text-foreground/80">
            Demo credentials
          </div>
          <div className="font-mono">ozlemnurnazlioglu2002@gmail.com</div>
          <div className="font-mono">ozlemtest@gmail.com</div>
          <div className="mt-1 font-mono">password: test123</div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="https://github.com/ozlemnurazlioglu/lovie-payment-task" className="hover:text-foreground">
            View source
          </Link>
        </p>
      </div>
    </main>
  );
}
