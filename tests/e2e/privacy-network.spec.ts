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

  test('completes full user journey: import sample -> analyze -> view results -> inspect source -> clear data', async ({ page }) => {
    await page.goto('/');

    // 1. Click "Try synthetic sample"
    await page.getByRole('button', { name: 'Try synthetic sample' }).click();

    // 2. Arrives at Import view with sample loaded
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Import Conversation');
    await expect(page.getByRole('button', { name: 'Analyze messages' })).toBeEnabled();

    // 3. Click "Analyze messages"
    await page.getByRole('button', { name: 'Analyze messages' }).click();

    // 4. Arrives at Results view
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Conversation Briefing');
    await expect(page.getByRole('heading', { name: 'Needs Attention' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tasks & Deadlines' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Important Decisions' })).toBeVisible();

    // 5. Open source inspection drawer
    const sourceButton = page.getByRole('button', { name: /Inspect source/i }).first();
    await sourceButton.click();
    await expect(page.getByRole('heading', { name: 'Source Message Inspection' })).toBeVisible();

    // 6. Close source drawer
    await page.getByRole('button', { name: 'Close source drawer' }).click();
    await expect(page.getByRole('heading', { name: 'Source Message Inspection' })).not.toBeVisible();

    // 7. Clear all data
    await page.getByRole('button', { name: 'Clear all imported data and results' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your data was cleared.');
    await expect(page.getByRole('status')).toContainText('Data cleared');

    // 8. Assert zero persistent storage per PRD §18.2, §18.5
    const storageState = await page.evaluate(() => ({
      // eslint-disable-next-line no-restricted-globals
      localStorageCount: localStorage.length,
      // eslint-disable-next-line no-restricted-globals
      sessionStorageCount: sessionStorage.length,
      cookie: document.cookie,
    }));

    expect(storageState.localStorageCount).toBe(0);
    expect(storageState.sessionStorageCount).toBe(0);
    expect(storageState.cookie).toBe('');
  });

  test('verifies transcript content with sentinel string is never sent over network', async ({ page }) => {
    const sentinel = 'MISSIQ_SENTINEL_SECRET_TOKEN_998877';
    let sentinelLeaked = false;

    page.on('request', (request) => {
      const url = request.url();
      const postData = request.postData() || '';
      if (url.includes(sentinel) || postData.includes(sentinel)) {
        sentinelLeaked = true;
      }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Start a briefing' }).click();

    // Paste custom transcript containing sentinel
    const textarea = page.getByPlaceholder(/Paste your chat messages here/i);
    await textarea.fill(`[10/03/2026, 09:12] Priya: ${sentinel} must be submitted by tomorrow.`);

    await page.getByRole('button', { name: 'Analyze messages' }).click();

    // Verify briefing renders
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Conversation Briefing');

    // Clear data
    await page.getByRole('button', { name: 'Clear all imported data and results' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your data was cleared.');

    expect(sentinelLeaked).toBe(false);
  });
});
