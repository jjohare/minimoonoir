import { test, expect } from '@playwright/test';

const ADMIN_MNEMONIC = 'trim deny glow firm panic salute wife endorse hunt then require decorate';
const SCREENSHOT_DIR = '/tmp/ui-test-screenshots-live';
const BASE_URL = 'https://jjohare.github.io/Nostr-BBS';

test.describe('Nostr-BBS Nostr UI/UX Testing', () => {
  test.beforeAll(async () => {
    // Screenshots will be saved to SCREENSHOT_DIR
    // Directory will be created automatically if needed
  });

  test('1. Landing Page - Visual Quality', async ({ page }) => {
    // Navigate to homepage
    await page.goto(BASE_URL);

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Let animations settle

    // Full page screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-landing-page.png`,
      fullPage: true
    });

    // Check for key UI elements
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });

  test('2. Login Page - Security UX', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-login-page.png`,
      fullPage: true
    });

    // Check for login form
    await expect(page.locator('form')).toBeVisible();
  });

  test('3. Admin Login Flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Screenshot before login
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03a-admin-login-form.png`,
      fullPage: true
    });

    // Find and click mnemonic option if available
    const mnemonicButton = page.locator('button:has-text("Mnemonic")');
    if (await mnemonicButton.isVisible()) {
      await mnemonicButton.click();
      await page.waitForTimeout(300);
    }

    // Enter admin mnemonic
    const mnemonicInput = page.locator('textarea, input[type="text"]').first();
    await mnemonicInput.fill(ADMIN_MNEMONIC);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03b-admin-mnemonic-entered.png`,
      fullPage: true
    });

    // Click login button
    const loginButton = page.locator('button:has-text("Login"), button[type="submit"]').first();
    await loginButton.click();

    // Wait for navigation
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03c-admin-logged-in.png`,
      fullPage: true
    });
  });

  test('4. Navigation - Hamburger Menu (Mobile)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04a-mobile-view.png`,
      fullPage: true
    });

    // Look for hamburger menu
    const hamburger = page.locator('[aria-label*="menu" i], button:has-text("Menu")');
    if (await hamburger.isVisible()) {
      await hamburger.click();
      await page.waitForTimeout(300);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/04b-mobile-menu-open.png`,
        fullPage: true
      });
    }
  });

  test('5. Accessibility - Skip to Main', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Tab to skip link
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-skip-to-main-focused.png`,
      fullPage: true
    });

    // Check if skip link is visible on focus
    const skipLink = page.locator('a:has-text("Skip to main")');
    if (await skipLink.count() > 0) {
      await expect(skipLink.first()).toBeFocused();
    }
  });

  test('6. Visual Polish - Gradients and Animations', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-gradient-backgrounds.png`,
      fullPage: true
    });
  });

  test('7. Demo Page - Visual Showcase', async ({ page }) => {
    await page.goto(`${BASE_URL}/demo/visual-polish`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07-visual-polish-demo.png`,
      fullPage: true
    });
  });

  test('8. Icon Examples Page', async ({ page }) => {
    // Try to navigate to icon examples
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Check if we can find any Lucide icons
    const icons = await page.locator('svg').count();

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/08-icons-check.png`,
      fullPage: true
    });

    console.log(`Found ${icons} SVG icons on page`);
  });

  test('9. Color Contrast Check', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Get computed styles of primary button
    const button = page.locator('button').first();
    const bgColor = await button.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09-color-contrast.png`,
      fullPage: true
    });

    console.log(`Primary button background: ${bgColor}`);
  });

  test('10. Full User Journey', async ({ page, context }) => {
    // Start from homepage
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/10a-journey-start.png`,
      fullPage: true
    });

    // Navigate to login
    const loginLink = page.locator('a:has-text("Login"), button:has-text("Login")').first();
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/10b-journey-login-page.png`,
        fullPage: true
      });
    }

    // Try signup page
    const signupLink = page.locator('a:has-text("Sign"), button:has-text("Sign")').first();
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/10c-journey-signup-page.png`,
        fullPage: true
      });
    }
  });
});
