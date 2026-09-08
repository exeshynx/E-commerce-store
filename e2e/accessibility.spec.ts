import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { e2eData } from './support/test-data.js';

const expectNoWcagViolations = async (page: Page) => {
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      const iterations = animation.effect?.getComputedTiming().iterations;
      if (iterations !== Infinity) animation.finish();
    }
  });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
};

const loginAsAdministrator = async (page: Page) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(e2eData.admin.email);
  await page.getByLabel('Password').fill(e2eData.admin.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/account$/);
};

test('public storefront pages meet automated WCAG A/AA checks', async ({ page }) => {
  for (const path of ['/', '/products', '/login']) {
    await page.goto(path);
    await page
      .locator('[aria-busy="true"]')
      .waitFor({ state: 'detached' })
      .catch(() => undefined);
    await expectNoWcagViolations(page);
  }
});

test('keyboard navigation exposes the skip link and moves focus to content', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'Find your next piece.' })).toBeVisible();
  await page.locator('body').focus();
  await page.keyboard.press('Tab');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('administrator shell is accessible on desktop and mobile', async ({ page }) => {
  await loginAsAdministrator(page);

  for (const [path, heading] of [
    ['/admin', 'Dashboard'],
    ['/admin/products', 'Products'],
    ['/admin/payments', 'Payments'],
    ['/admin/audit', 'Administrator audit'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expectNoWcagViolations(page);
  }

  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Open administration navigation' }).click();
    const drawer = page.getByRole('dialog', { name: 'Administration navigation drawer' });
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Open administration navigation' }),
    ).toBeFocused();
  }

  await page.goto('/admin/products');
  const newProductButton = page.getByRole('button', { name: 'New product' });
  await newProductButton.click();
  await expect(page.getByRole('dialog', { name: 'Create product' })).toBeVisible();
  await expectNoWcagViolations(page);
  await page.keyboard.press('Escape');
  await expect(newProductButton).toBeFocused();
});

test('authenticated customer states and address dialog meet WCAG A/AA checks', async ({ page }) => {
  await loginAsAdministrator(page);
  for (const [path, heading] of [
    ['/account', /Welcome/],
    ['/account/addresses', 'Saved addresses'],
    ['/cart', 'Shopping cart'],
    ['/wishlist', 'Your wishlist'],
    ['/orders', 'Your orders'],
    ['/returns', 'My returns'],
    ['/support', 'Support tickets'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expectNoWcagViolations(page);
  }

  await page.goto('/account/addresses');
  const addAddressButton = page.getByRole('button', { name: 'Add address' });
  await addAddressButton.click();
  await expect(page.getByRole('dialog', { name: 'Add address' })).toBeVisible();
  await expectNoWcagViolations(page);
  await page.keyboard.press('Escape');
  await expect(addAddressButton).toBeFocused();
});
