import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import type {
  ApiSuccess,
  AuthSessionData,
  CatalogCategory,
  CatalogProduct,
  CategoryListData,
  ProductDetailData,
  ProductImage,
  ProductListData,
} from '@aurelia/contracts';
import { createApp } from '../../app.js';
import { productImageStorage } from '../../infrastructure/storage/product-image.storage.js';
import { prisma } from '../../infrastructure/database/prisma.js';
import { cleanupOperationalRecords } from '../../test/test-data-cleanup.js';
import { passwordService } from '../auth/password.service.js';

const adminEmail = 'catalog.admin@aurelia.test';
const customerEmail = 'catalog.customer@aurelia.test';
const password = 'StrongPassword123';
const categorySlug = 'catalog-integration-category';
const productSlug = 'catalog-integration-product';
const productSku = 'CATALOG-TEST-001';
const server = createServer(createApp());
let baseUrl = '';
let adminAccessToken = '';
let customerAccessToken = '';

const cleanup = async () => {
  await cleanupOperationalRecords([adminEmail, customerEmail]);
  const products = await prisma.product.findMany({
    where: { sku: productSku },
    include: { images: true },
  });
  for (const product of products) {
    for (const image of product.images) {
      await productImageStorage.remove(image.path);
    }
  }
  await prisma.product.deleteMany({ where: { sku: productSku } });
  await prisma.category.deleteMany({ where: { slug: categorySlug } });
  await prisma.user.deleteMany({ where: { email: { in: [adminEmail, customerEmail] } } });
};

const login = async (email: string) => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  const payload = (await response.json()) as ApiSuccess<AuthSessionData>;
  return payload.data.accessToken;
};

const adminHeaders = () => ({
  authorization: `Bearer ${adminAccessToken}`,
  'content-type': 'application/json',
});

before(async () => {
  await cleanup();
  const passwordHash = await passwordService.hash(password);
  await prisma.user.createMany({
    data: [
      {
        email: adminEmail,
        firstName: 'Catalog',
        lastName: 'Administrator',
        passwordHash,
        role: 'ADMIN',
      },
      {
        email: customerEmail,
        firstName: 'Catalog',
        lastName: 'Customer',
        passwordHash,
      },
    ],
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  adminAccessToken = await login(adminEmail);
  customerAccessToken = await login(customerEmail);
});

after(async () => {
  await cleanup();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await prisma.$disconnect();
});

void test('admin catalog management, public browsing, inventory, and image lifecycle', async () => {
  const deniedCategory = await fetch(`${baseUrl}/admin/categories`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${customerAccessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ name: 'Denied Category' }),
  });
  assert.equal(deniedCategory.status, 403);

  const categoryResponse = await fetch(`${baseUrl}/admin/categories`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      description: 'Integration-test category.',
      name: 'Catalog Integration Category',
      slug: categorySlug,
    }),
  });
  assert.equal(categoryResponse.status, 201);
  const categoryPayload = (await categoryResponse.json()) as ApiSuccess<{
    category: CatalogCategory;
  }>;
  const category = categoryPayload.data.category;

  const productResponse = await fetch(`${baseUrl}/admin/products`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      availableQuantity: 5,
      categoryId: category.id,
      description: 'An integration-test jewelry piece.',
      name: 'Catalog Integration Product',
      price: 1250,
      sku: productSku,
      slug: productSlug,
    }),
  });
  assert.equal(productResponse.status, 201);
  const productPayload = (await productResponse.json()) as ApiSuccess<{
    product: CatalogProduct;
  }>;
  const product = productPayload.data.product;
  assert.equal(product.currency, 'PKR');
  assert.equal(product.price, '1250.00');
  assert.equal(product.inventory.availableQuantity, 5);

  const invalidInventory = await fetch(`${baseUrl}/admin/products/${product.id}`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify({ availableQuantity: -1 }),
  });
  assert.equal(invalidInventory.status, 422);

  const categoriesResponse = await fetch(`${baseUrl}/categories`);
  assert.equal(categoriesResponse.status, 200);
  const categories = (await categoriesResponse.json()) as ApiSuccess<CategoryListData>;
  assert.equal(categories.data.items.find((item) => item.id === category.id)?.productCount, 1);

  const productsResponse = await fetch(
    `${baseUrl}/products?category=${categorySlug}&q=integration&page=1&pageSize=10`,
  );
  assert.equal(productsResponse.status, 200);
  const products = (await productsResponse.json()) as ApiSuccess<ProductListData>;
  assert.equal(products.data.items.length, 1);
  assert.equal(products.data.pagination.totalItems, 1);

  const detailResponse = await fetch(`${baseUrl}/products/${productSlug}`);
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()) as ApiSuccess<ProductDetailData>;
  assert.equal(detail.data.product.id, product.id);

  const imageForm = new FormData();
  imageForm.set('altText', 'Integration image');
  imageForm.set(
    'image',
    new Blob([Buffer.from('89504e470d0a1a0a00000000', 'hex')], { type: 'image/png' }),
    'catalog-test.png',
  );
  const imageResponse = await fetch(`${baseUrl}/admin/products/${product.id}/images`, {
    method: 'POST',
    headers: { authorization: `Bearer ${adminAccessToken}` },
    body: imageForm,
  });
  assert.equal(imageResponse.status, 201);
  const imagePayload = (await imageResponse.json()) as ApiSuccess<{ image: ProductImage }>;
  const image = imagePayload.data.image;
  assert.equal(image.position, 0);

  const imageFileResponse = await fetch(
    new URL(image.url, baseUrl.replace('/api/v1', '')).toString(),
  );
  assert.equal(imageFileResponse.status, 200);

  const updateImageResponse = await fetch(
    `${baseUrl}/admin/products/${product.id}/images/${image.id}`,
    {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ altText: 'Updated integration image', position: 0 }),
    },
  );
  assert.equal(updateImageResponse.status, 200);

  const deleteImageResponse = await fetch(
    `${baseUrl}/admin/products/${product.id}/images/${image.id}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${adminAccessToken}` },
    },
  );
  assert.equal(deleteImageResponse.status, 204);

  const updateProductResponse = await fetch(`${baseUrl}/admin/products/${product.id}`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify({ availableQuantity: 8, price: 1399.5 }),
  });
  assert.equal(updateProductResponse.status, 200);
  const updatedProduct = (await updateProductResponse.json()) as ApiSuccess<{
    product: CatalogProduct;
  }>;
  assert.equal(updatedProduct.data.product.price, '1399.50');
  assert.equal(updatedProduct.data.product.inventory.availableQuantity, 8);

  const archiveProductResponse = await fetch(`${baseUrl}/admin/products/${product.id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminAccessToken}` },
  });
  assert.equal(archiveProductResponse.status, 204);

  const archivedDetailResponse = await fetch(`${baseUrl}/products/${productSlug}`);
  assert.equal(archivedDetailResponse.status, 404);

  const archiveCategoryResponse = await fetch(`${baseUrl}/admin/categories/${category.id}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${adminAccessToken}` },
  });
  assert.equal(archiveCategoryResponse.status, 204);
});
