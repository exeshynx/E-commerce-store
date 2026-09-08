import { expect, test } from '@playwright/test';
import { apiLogin, authorizedRequest, expectData } from './support/api.js';
import { e2eData } from './support/test-data.js';

interface ProductListItem {
  category: { name: string; slug: string };
  id: string;
  name: string;
  slug: string;
}

test('customer can complete the storefront and after-sales journey', async ({ page, request }) => {
  test.setTimeout(180_000);
  const catalogResponse = await request.get('/api/v1/search', {
    params: { availability: 'in_stock', pageSize: 20 },
  });
  const catalog = await expectData<{ items: ProductListItem[] }>(catalogResponse);
  const product = catalog.items[0];
  expect(product).toBeDefined();
  if (!product) throw new Error('The deterministic seed must provide an in-stock product.');

  await test.step('registration, profile update, logout, and login', async () => {
    await page.goto('/register');
    await page.getByLabel('First name').fill(e2eData.customer.firstName);
    await page.getByLabel('Last name').fill(e2eData.customer.lastName);
    await page.getByLabel('Email').fill(e2eData.customer.email);
    await page.getByLabel('Password').fill(e2eData.customer.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: /Welcome, E2E/ })).toBeVisible();

    await page.getByLabel('Phone').fill('+92 300 1234567');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile updated.')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(e2eData.customer.email);
    await page.getByLabel('Password').fill(e2eData.customer.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: /Welcome, E2E/ })).toBeVisible();
  });

  await test.step('browse, search, filter, wishlist, and cart', async () => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'Find your next piece.' })).toBeVisible();
    await page.getByLabel('Category').selectOption(product.category.slug);
    await expect(page).toHaveURL(new RegExp(`category=${product.category.slug}`));
    await page.getByLabel('Availability').selectOption('in_stock');
    await page.getByLabel('Search products').fill(product.name);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByRole('link', { name: product.name }).first()).toBeVisible();
    await page.getByRole('link', { name: product.name }).first().click();
    await expect(page.getByRole('heading', { name: product.name })).toBeVisible();

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved to your wishlist.')).toBeVisible();
    await page.goto('/wishlist');
    await expect(page.getByRole('heading', { name: 'Your wishlist' })).toBeVisible();
    await expect(page.getByRole('link', { name: product.name }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Move to cart' }).click();
    await expect(page.getByText('Moved to your cart.')).toBeVisible();

    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Shopping cart' })).toBeVisible();
    await expect(page.getByRole('link', { name: product.name }).first()).toBeVisible();
    const cartItem = page
      .getByRole('article')
      .filter({ has: page.getByRole('link', { name: product.name }) });
    await page.getByRole('button', { name: `Increase ${product.name} quantity` }).click();
    await expect(cartItem.getByText('2', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Decrease ${product.name} quantity` }).click();
  });

  await test.step('save an address and checkout with a coupon', async () => {
    await page.goto('/account/addresses');
    await page.getByRole('button', { name: 'Add address' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add address' });
    await dialog.getByLabel('Label').fill('E2E Home');
    await dialog.getByLabel('Full name').fill('E2E Customer');
    await dialog.getByLabel('Phone').fill('+92 300 1234567');
    await dialog.getByLabel('Email').fill(e2eData.customer.email);
    await dialog.getByLabel('Country').fill('Pakistan');
    await dialog.getByLabel('Province / state').fill('Punjab');
    await dialog.getByLabel('City').fill('Lahore');
    await dialog.getByLabel('Postal code').fill('54660');
    await dialog.getByLabel('Complete address').fill('18 E2E Commerce Street');
    await dialog.getByLabel('Default shipping').check();
    await dialog.getByRole('button', { name: 'Save address' }).click();
    await expect(page.getByText('Address saved.')).toBeVisible();

    await page.goto('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await page.getByLabel('Coupon').fill(e2eData.couponCode);
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText(e2eData.couponCode, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Thank you.' })).toBeVisible();
  });

  const orderMatch = page.url().match(/\/orders\/([^/]+)\/confirmation/);
  expect(orderMatch?.[1]).toBeTruthy();
  const orderId = orderMatch?.[1];
  if (!orderId) throw new Error('Checkout did not navigate to an order confirmation URL.');

  await test.step('exercise the mocked Safepay customer state', async () => {
    await page.route(`**/api/v1/orders/${orderId}/payments/safepay`, async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          data: { checkoutUrl: null, orderStatus: 'AWAITING_PAYMENT', payment: null },
          requestId: 'playwright-safepay-mock',
        }),
        contentType: 'application/json',
        status: 201,
      });
    });
    await page.getByRole('link', { name: 'Continue to payment' }).click();
    await page.getByRole('button', { name: 'Pay securely with Safepay' }).click();
    await expect(page.getByText('Payment is waiting for confirmation.')).toBeVisible();
    await page.unroute(`**/api/v1/orders/${orderId}/payments/safepay`);
  });

  const customerSession = await apiLogin(request, e2eData.customer);
  const adminSession = await apiLogin(request, e2eData.admin);
  const customerToken = customerSession.data.accessToken;
  const adminToken = adminSession.data.accessToken;

  await test.step('settle payment and deliver the order through authenticated APIs', async () => {
    await expectData(
      await authorizedRequest(request, adminToken, `/api/v1/admin/orders/${orderId}/status`, {
        data: { note: 'E2E payment requested', status: 'AWAITING_PAYMENT' },
        method: 'patch',
      }),
    );
    const manualAttempt = await expectData<{ payment: { id: string } }>(
      await authorizedRequest(request, customerToken, `/api/v1/orders/${orderId}/payments/manual`, {
        method: 'post',
      }),
    );
    await expectData(
      await authorizedRequest(
        request,
        adminToken,
        `/api/v1/admin/payments/${manualAttempt.payment.id}/status`,
        { data: { status: 'SUCCEEDED' }, method: 'patch' },
      ),
    );
    const shipment = await expectData<{ shipment: { id: string } }>(
      await authorizedRequest(request, adminToken, `/api/v1/admin/orders/${orderId}/shipments`, {
        data: { courier: 'Veyora E2E Courier', trackingNumber: 'E2E-TRACK-001' },
        method: 'post',
      }),
    );
    for (const status of ['READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
      await expectData(
        await authorizedRequest(
          request,
          adminToken,
          `/api/v1/admin/shipments/${shipment.shipment.id}/events`,
          {
            data: { location: 'Lahore', message: `E2E ${status}`, status },
            method: 'post',
          },
        ),
      );
    }
  });

  await test.step('view orders, tracking, payment, review, and return states', async () => {
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByRole('heading', { name: 'Order details' })).toBeVisible();
    await expect(page.getByText('Succeeded', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'View tracking' }).click();
    await expect(page.getByRole('heading', { name: 'Track your shipment' })).toBeVisible();
    await expect(page.getByText('Veyora E2E Courier')).toBeVisible();
    await expect(page.getByText('DELIVERED', { exact: true }).first()).toBeVisible();

    await page.goto(`/products/${product.slug}`);
    await page.getByLabel('Title').fill('Excellent E2E piece');
    await page
      .getByLabel('Review', { exact: true })
      .fill('A deterministic verified purchase review.');
    await page.getByRole('button', { name: 'Submit review' }).click();
    await expect(page.getByText('Review submitted for moderation.')).toBeVisible();

    await page.goto(`/orders/${orderId}`);
    await page.getByRole('link', { name: 'Start a return' }).click();
    await page.getByLabel('Quantity').fill('1');
    await page.getByLabel('Additional details').fill('Return created by the Playwright journey.');
    await page.getByRole('button', { name: 'Submit return request' }).click();
    await expect(page.getByText('REQUESTED', { exact: true })).toBeVisible();
  });

  await test.step('open a customer support ticket', async () => {
    await page.goto('/support');
    await page.getByRole('button', { name: 'Create ticket' }).click();
    await page.getByLabel('Subject').fill('E2E order assistance');
    await page.getByLabel('Message').fill('This deterministic ticket verifies customer support.');
    await page.getByLabel(/Order ID/).fill(orderId);
    await page.getByRole('button', { name: 'Create support ticket' }).click();
    await expect(page.getByRole('heading', { name: 'E2E order assistance' })).toBeVisible();
  });
});
