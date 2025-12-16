/**
 * Debug test for admin login issue
 */

import { test, expect } from '@playwright/test';

const ADMIN_MNEMONIC = 'loyal bench cheap find pause draft various chief slide lunar sight useless';
const EXPECTED_PUBKEY = 'd2508ff0e0f4f0791d25fac8a8e400fa2930086c2fe50c7dbb7f265aeffe2031';

test.describe('Debug Admin Login', () => {
  test('login with admin mnemonic and check pubkey', async ({ page }) => {
    // Clear storage
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());

    // Navigate to login page and wait for full load
    await page.goto('/login', { waitUntil: 'networkidle' });

    // Wait for hydration - look for any interactive element
    await page.waitForFunction(() => document.querySelector('textarea') !== null, { timeout: 15000 });
    await page.waitForTimeout(500);

    // Take screenshot
    await page.screenshot({ path: 'test-results/debug-1-login-page.png', fullPage: true });

    // The login page has tabs: "Paste Phrase", "Enter Words", "Private Key"
    // Default is "Paste Phrase" with a textarea
    const textarea = page.locator('textarea');
    console.log('Textarea visible:', await textarea.isVisible().catch(() => false));

    if (await textarea.isVisible().catch(() => false)) {
      console.log('Found textarea, pasting mnemonic');
      await textarea.fill(ADMIN_MNEMONIC);
    }

    await page.screenshot({ path: 'test-results/debug-2-after-mnemonic-entry.png', fullPage: true });

    // Look for the Restore Account button
    const restoreButton = page.getByRole('button', { name: /restore account/i });
    console.log('Restore button visible:', await restoreButton.isVisible().catch(() => false));

    if (await restoreButton.isVisible().catch(() => false)) {
      await restoreButton.click();
      console.log('Clicked restore button');
    }

    // Wait for restoration to complete (may redirect to /chat)
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'test-results/debug-3-after-restore.png', fullPage: true });

    // Check current URL
    console.log('Current URL after restore:', page.url());

    // Check localStorage for stored data
    const storedKeys = await page.evaluate(() => {
      const result: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          result[key] = localStorage.getItem(key) || '';
        }
      }
      return result;
    });

    console.log('LocalStorage keys:', Object.keys(storedKeys));

    // Extract pubkey from stored data
    const mainKey = storedKeys['Nostr-BBS_keys'];
    if (mainKey) {
      try {
        const parsed = JSON.parse(mainKey);
        console.log('Stored publicKey:', parsed.publicKey);
        console.log('Expected pubkey:', EXPECTED_PUBKEY);
        console.log('Pubkeys match:', parsed.publicKey === EXPECTED_PUBKEY);

        // Check if it's 64 characters hex
        console.log('Pubkey length:', parsed.publicKey?.length);
      } catch (e) {
        console.log('Error parsing stored keys:', e);
      }
    } else {
      console.log('No Nostr-BBS_keys found in localStorage');
      console.log('Full localStorage:', storedKeys);
    }

    // Check if admin link is visible in navigation
    const adminLink = page.getByRole('link', { name: /admin/i });
    const adminButton = page.locator('a[href*="admin"]');
    console.log('Admin link visible:', await adminLink.isVisible().catch(() => false));
    console.log('Admin href link visible:', await adminButton.isVisible().catch(() => false));

    await page.screenshot({ path: 'test-results/debug-4-chat-page.png', fullPage: true });

    // Try navigating to admin
    await page.goto('/admin');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'test-results/debug-5-admin-page.png', fullPage: true });

    // Check current URL
    console.log('Current URL at admin page:', page.url());

    // Check if we see admin dashboard content
    const dashboardText = page.getByText(/admin dashboard/i);
    const createChannelButton = page.getByRole('button', { name: /create channel/i });
    console.log('Dashboard text visible:', await dashboardText.isVisible().catch(() => false));
    console.log('Create channel button visible:', await createChannelButton.isVisible().catch(() => false));

    // Get page text content for debugging
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log('Page body text (first 500 chars):', bodyText.substring(0, 500));
  });
});
