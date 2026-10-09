import { test, expect } from '@playwright/test';

test.describe('Missiq Local-First Privacy & UI Shell', () => {
  test('loads homepage cleanly and displays brand identity', async ({ page }) => {
    await page.goto('/');

    // Verify brand identity
    await expect(page).toHaveTitle(/Missiq — Your private chat intelligence/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Miss less. Know more.');

    // Verify honest status chip
    await expect(page.getByRole('status')).toContainText('Ready — nothing loaded');

    // Verify Privacy Guarantee section
    await expect(page.getByText('Privacy Guarantee')).toBeVisible();
    await expect(page.getByText(/Missiq analyzes your conversation in your browser/).first()).toBeVisible();
  });

  test('verifies zero outbound network requests containing sensitive data', async ({ page }) => {
    const outgoingRequests: string[] = [];

    page.on('request', (request) => {
      outgoingRequests.push(request.url());
    });

    await page.goto('/');

    // Filter requests to external non-localhost hosts
    const externalRequests = outgoingRequests.filter(
      (url) => !url.includes('localhost') && !url.includes('127.0.0.1')
    );

    expect(externalRequests).toHaveLength(0);
  });
});
