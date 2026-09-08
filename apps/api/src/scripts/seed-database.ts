import { Prisma } from '@prisma/client';
import { prisma } from '../infrastructure/database/prisma.js';
import {
  bootstrapConfiguredAdmin,
  hasCompleteAdminBootstrapConfiguration,
} from './admin-bootstrap.js';
import {
  developmentPlaceholderPath,
  developmentSeedCatalog,
  type DevelopmentSeedProduct,
} from './development-catalog.seed-data.js';

const stockForProduct = (product: DevelopmentSeedProduct, index: number) => {
  const hash = [...product.sku].reduce((total, character) => total + character.charCodeAt(0), 0);
  if (index % 8 === 0) return 0;
  if (index % 5 === 0) return 1 + (hash % 4);
  return 8 + (hash % 43);
};

const seedDevelopmentCatalog = async () => {
  let productIndex = 0;
  const reusedCategoryNames = new Set<string>();
  const stockLevels: number[] = [];

  await prisma.$transaction(
    async (transaction) => {
      await transaction.product.updateMany({
        data: { isActive: false, isFeatured: false },
        where: { sku: { startsWith: 'DEV-' } },
      });
      await transaction.category.updateMany({
        data: { isActive: false },
        where: { slug: { startsWith: 'dev-' } },
      });

      for (const category of developmentSeedCatalog) {
        const existingSeedCategory = await transaction.category.findUnique({
          where: { slug: category.slug },
        });
        const existingNamedCategory = existingSeedCategory
          ? null
          : await transaction.category.findUnique({ where: { name: category.name } });
        if (existingNamedCategory) reusedCategoryNames.add(existingNamedCategory.name);

        const categoryRecord = existingSeedCategory
          ? await transaction.category.update({
              data: {
                description: category.description,
                isActive: true,
                name: category.name,
              },
              where: { id: existingSeedCategory.id },
            })
          : (existingNamedCategory ??
            (await transaction.category.create({
              data: {
                description: category.description,
                isActive: true,
                name: category.name,
                slug: category.slug,
              },
            })));

        for (const product of category.products) {
          const sellableQuantity = stockForProduct(product, productIndex);
          const isFeatured = product.sku.endsWith('001');
          stockLevels.push(sellableQuantity);
          productIndex += 1;

          const productRecord = await transaction.product.upsert({
            create: {
              categoryId: categoryRecord.id,
              currency: 'PKR',
              description: product.description,
              isActive: true,
              isFeatured,
              name: product.name,
              price: new Prisma.Decimal(product.price),
              sku: product.sku,
              slug: product.slug,
            },
            update: {
              categoryId: categoryRecord.id,
              currency: 'PKR',
              description: product.description,
              isActive: true,
              isFeatured,
              name: product.name,
              price: new Prisma.Decimal(product.price),
              slug: product.slug,
            },
            where: { sku: product.sku },
          });

          const currentInventory = await transaction.inventory.findUnique({
            select: { reservedQuantity: true },
            where: { productId: productRecord.id },
          });
          const availableQuantity = sellableQuantity + (currentInventory?.reservedQuantity ?? 0);

          await transaction.inventory.upsert({
            create: { availableQuantity, productId: productRecord.id },
            update: { availableQuantity },
            where: { productId: productRecord.id },
          });

          await transaction.productImage.upsert({
            create: {
              altText: `${product.name} development placeholder`,
              path: developmentPlaceholderPath,
              position: 0,
              productId: productRecord.id,
            },
            update: {
              altText: `${product.name} development placeholder`,
              path: developmentPlaceholderPath,
            },
            where: {
              productId_position: { position: 0, productId: productRecord.id },
            },
          });
        }
      }
    },
    { timeout: 30_000 },
  );

  return {
    categoryCount: developmentSeedCatalog.length,
    inStockCount: stockLevels.filter((quantity) => quantity >= 5).length,
    lowStockCount: stockLevels.filter((quantity) => quantity > 0 && quantity < 5).length,
    outOfStockCount: stockLevels.filter((quantity) => quantity === 0).length,
    productCount: stockLevels.length,
    reusedCategoryNames: [...reusedCategoryNames],
  };
};

const bootstrapAdminWhenConfigured = async () => {
  const adminExists = await prisma.user.findFirst({
    select: { id: true },
    where: { role: 'ADMIN' },
  });
  if (adminExists) {
    console.info('Administrator check: an ADMIN account already exists; no changes made.');
    return;
  }

  if (hasCompleteAdminBootstrapConfiguration()) {
    console.info('Administrator check: using the configured admin bootstrap.');
    await bootstrapConfiguredAdmin();
    return;
  }

  console.warn(
    'Administrator check: no ADMIN exists. Configure all ADMIN_* variables and run npm run admin:bootstrap.',
  );
};

const run = async () => {
  console.info('Seeding the namespaced development catalog...');
  const result = await seedDevelopmentCatalog();
  console.info(
    `Catalog seed complete: ${result.categoryCount} categories, ${result.productCount} products ` +
      `(${result.inStockCount} in stock, ${result.lowStockCount} low stock, ` +
      `${result.outOfStockCount} out of stock).`,
  );
  if (result.reusedCategoryNames.length > 0) {
    console.info(
      `Reused existing categories without overwriting them: ${result.reusedCategoryNames.join(', ')}.`,
    );
  }
  await bootstrapAdminWhenConfigured();
};

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
