import { test, expect, type Page } from '@playwright/test';

const USER_A = { email: 'ozlemnurnazlioglu2002@gmail.com', password: 'test123' };
const USER_B = { email: 'ozlemtest@gmail.com', password: 'test123' };

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // After login the server action server-redirects, so this is a hard nav.
  await expect(page).toHaveURL(/\/(dashboard|pay)/, { timeout: 15_000 });
}

async function createRequest(page: Page, recipient: string, dollars: string, note: string) {
  await page.goto('/requests/new');
  await page.getByTestId('recipient-email').fill(recipient);
  await page.getByTestId('amount-input').fill(dollars);
  await page.getByTestId('note-input').fill(note);
  await page.getByTestId('submit-request').click();
  await expect(page).toHaveURL(/\/requests\/[0-9a-f-]+/, { timeout: 15_000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('PayRequest — happy path: create → share → pay', () => {
  let shareLinkPath: string;

  test('A signs in and creates a request for B', async ({ page }) => {
    await login(page, USER_A.email, USER_A.password);
    await expect(page).toHaveURL(/\/dashboard/);

    // Navigate directly instead of depending on a client-side Link click
    // (keeps the suite robust against hot-reload state).
    await page.goto('/requests/new');
    await expect(page).toHaveURL(/\/requests\/new/);

    const note = `Dinner ${Date.now()}`;
    await page.getByTestId('recipient-email').fill(USER_B.email);
    await page.getByTestId('amount-input').fill('25.00');
    await page.getByTestId('note-input').fill(note);
    await page.getByTestId('submit-request').click();

    await expect(page).toHaveURL(/\/requests\/[0-9a-f-]+\?created=1/, { timeout: 15_000 });
    await expect(page.getByTestId('status-badge')).toHaveAttribute('data-status', 'pending');
    await expect(page.getByTestId('counterparty-email')).toHaveText(USER_B.email);
    await expect(page.getByTestId('amount')).toHaveAttribute('data-cents', '2500');
    await expect(page.getByTestId('request-note')).toHaveText(note);

    const linkText = (await page.getByTestId('share-link-url').innerText()).trim();
    const url = new URL(linkText, 'http://localhost:3100');
    shareLinkPath = url.pathname;
    expect(shareLinkPath).toMatch(/^\/pay\/[0-9a-f-]+$/);
  });

  test('guest sees a read-only public view of the shared link', async ({ browser }) => {
    const ctx = await browser.newContext({ recordVideo: { dir: 'test-results/videos' } });
    const page = await ctx.newPage();
    await page.goto(shareLinkPath);

    await expect(page.getByTestId('public-sender-email')).toHaveText(USER_A.email);
    await expect(page.getByTestId('amount')).toHaveAttribute('data-cents', '2500');
    await expect(page.getByTestId('public-signin-cta')).toBeVisible();

    await ctx.close();
  });

  test('B signs in via the share link and pays (2s processing, then paid)', async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ recordVideo: { dir: 'test-results/videos' } });
    const page = await ctx.newPage();

    await page.goto(shareLinkPath);
    await page.getByTestId('public-signin-cta').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    await page.fill('input[name="email"]', USER_B.email);
    await page.fill('input[name="password"]', USER_B.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // After login the server action redirects us back to ?next=<share link>
    await expect(page).toHaveURL(new RegExp(shareLinkPath.replace(/\//g, '\\/')), {
      timeout: 15_000,
    });
    await expect(page.getByTestId('pay-button')).toBeVisible();

    const startedAt = Date.now();
    await page.getByTestId('pay-button').click();
    await expect(page.getByTestId('pay-loading')).toBeVisible();

    await expect(page.getByTestId('status-badge')).toHaveAttribute('data-status', 'paid', {
      timeout: 15_000,
    });
    // Pay route sleeps 2s server-side — confirm it actually happened.
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1800);

    await ctx.close();
  });

  test('A sees the request as paid in their outgoing tab', async ({ browser }) => {
    const ctx = await browser.newContext({ recordVideo: { dir: 'test-results/videos' } });
    const page = await ctx.newPage();
    await login(page, USER_A.email, USER_A.password);
    await page.goto('/dashboard?tab=outgoing');

    const paidCard = page
      .locator('[data-testid="request-card"][data-request-status="paid"]')
      .first();
    await expect(paidCard).toBeVisible({ timeout: 10_000 });

    await ctx.close();
  });
});

test.describe('PayRequest — decline flow', () => {
  let detailUrl: string;

  test('A creates a fresh request', async ({ browser }) => {
    const ctx = await browser.newContext({ recordVideo: { dir: 'test-results/videos' } });
    const page = await ctx.newPage();
    await login(page, USER_A.email, USER_A.password);
    await createRequest(page, USER_B.email, '10.00', `Decline me ${Date.now()}`);
    detailUrl = page.url();
    await ctx.close();
  });

  test('B opens the request and declines it', async ({ browser }) => {
    const ctx = await browser.newContext({ recordVideo: { dir: 'test-results/videos' } });
    const page = await ctx.newPage();
    await login(page, USER_B.email, USER_B.password);
    await page.goto(detailUrl);

    await page.getByTestId('decline-button').click();
    await expect(page.getByTestId('status-badge')).toHaveAttribute('data-status', 'declined', {
      timeout: 10_000,
    });

    await ctx.close();
  });
});

test.describe('PayRequest — cancel flow', () => {
  test('A creates and cancels their own pending request', async ({ browser }) => {
    const ctx = await browser.newContext({ recordVideo: { dir: 'test-results/videos' } });
    const page = await ctx.newPage();
    await login(page, USER_A.email, USER_A.password);
    await createRequest(page, USER_B.email, '5.00', `Cancel me ${Date.now()}`);

    await page.getByTestId('cancel-button').click();
    await expect(page.getByTestId('status-badge')).toHaveAttribute('data-status', 'cancelled', {
      timeout: 10_000,
    });

    await ctx.close();
  });
});

test.describe('PayRequest — validation', () => {
  test('cannot request money from yourself', async ({ browser }) => {
    const ctx = await browser.newContext({ recordVideo: { dir: 'test-results/videos' } });
    const page = await ctx.newPage();
    await login(page, USER_A.email, USER_A.password);
    await page.goto('/requests/new');

    await page.getByTestId('recipient-email').fill(USER_A.email);
    await page.getByTestId('amount-input').fill('1.00');
    await page.getByTestId('submit-request').click();

    await expect(page.getByTestId('form-error')).toBeVisible();
    await expect(page.getByTestId('form-error')).toContainText(/yourself/i);

    await ctx.close();
  });
});
