import { expect, test } from '@playwright/test';
import { e2eData } from './support/test-data.js';

test('administrator can access every protected management area', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(e2eData.admin.email);
  await page.getByLabel('Password').fill(e2eData.admin.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/account$/);

  const areas = [
    ['/admin', 'Dashboard'],
    ['/admin/products', 'Products'],
    ['/admin/categories', 'Categories'],
    ['/admin/inventory', 'Inventory'],
    ['/admin/orders', 'Orders'],
    ['/admin/payments', 'Payments'],
    ['/admin/shipments', 'Shipments'],
    ['/admin/returns', 'Returns'],
    ['/admin/reviews', 'Reviews'],
    ['/admin/coupons', 'Coupons'],
    ['/admin/support', 'Support'],
  ] as const;

  for (const [path, heading] of areas) {
    await test.step(`open ${heading}`, async () => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Administration' })).toBeVisible();
    });
  }
});
