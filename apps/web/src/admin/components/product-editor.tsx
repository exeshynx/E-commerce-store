import type { AdminCategory, AdminProductWriteRequest, ProductImage } from '@aurelia/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { FiArrowDown, FiArrowUp, FiTrash2, FiUpload } from 'react-icons/fi';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../lib/api-error';
import { adminApi, adminQueryKeys } from '../../lib/admin-api';
import { resolveAssetUrl } from '../../lib/asset-url';
import { AdminErrorState, AdminLoadingState, AdminModal, ConfirmDialog } from './admin-ui';

const blankProduct: AdminProductWriteRequest = {
  availableQuantity: 0,
  categoryId: '',
  currency: 'PKR',
  description: '',
  isActive: true,
  name: '',
  price: 0,
  sku: '',
  slug: '',
};

const ImagesManager = ({ images, productId }: { images: ProductImage[]; productId: string }) => {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [deleting, setDeleting] = useState<ProductImage | null>(null);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.product(productId) }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
    ]);
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Select an image first.');
      return adminApi.uploadProductImage(productId, file, altText);
    },
    onSuccess: async () => {
      toast.success('Image uploaded.');
      setFile(null);
      setAltText('');
      await refresh();
    },
  });
  const reorder = useMutation({
    mutationFn: ({ imageId, position }: { imageId: string; position: number }) =>
      adminApi.updateProductImage(productId, imageId, { position }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => adminApi.deleteProductImage(productId, deleting?.id ?? ''),
    onSuccess: async () => {
      toast.success('Image deleted.');
      setDeleting(null);
      await refresh();
    },
  });
  return (
    <section className="border-ink/10 mt-8 border-t pt-6">
      <h3 className="font-display text-2xl">Product images</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {images.map((image, index) => (
          <article className="border-ink/10 flex gap-3 rounded-xl border p-3" key={image.id}>
            <img
              alt={image.altText ?? 'Product'}
              className="size-20 rounded-lg object-cover"
              decoding="async"
              loading="lazy"
              src={resolveAssetUrl(image.url)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-ink/55 truncate text-xs">{image.altText || 'No alt text'}</p>
              <div className="mt-3 flex gap-1">
                <button
                  aria-label="Move image up"
                  className="border-ink/10 rounded-lg border p-2 disabled:opacity-30"
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => {
                    const target = images[index - 1];
                    if (target) reorder.mutate({ imageId: image.id, position: target.position });
                  }}
                  type="button"
                >
                  <FiArrowUp />
                </button>
                <button
                  aria-label="Move image down"
                  className="border-ink/10 rounded-lg border p-2 disabled:opacity-30"
                  disabled={index === images.length - 1 || reorder.isPending}
                  onClick={() => {
                    const target = images[index + 1];
                    if (target) reorder.mutate({ imageId: image.id, position: target.position });
                  }}
                  type="button"
                >
                  <FiArrowDown />
                </button>
                <button
                  aria-label="Delete image"
                  className="rounded-lg border border-red-200 p-2 text-red-700"
                  onClick={() => setDeleting(image)}
                  type="button"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!images.length ? (
        <p className="text-ink/50 mt-3 text-sm">No images have been uploaded.</p>
      ) : null}
      <div className="bg-mist/50 mt-5 grid gap-3 rounded-xl p-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Image
          <input
            accept="image/jpeg,image/png,image/webp"
            className="mt-2 block w-full text-sm"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        <label className="text-sm font-semibold">
          Alt text
          <input
            className="border-ink/15 mt-2 w-full rounded-xl border bg-white px-3 py-2 font-normal"
            maxLength={160}
            onChange={(event) => setAltText(event.target.value)}
            value={altText}
          />
        </label>
        <div className="sm:col-span-2">
          {upload.isError ? (
            <p className="mb-3 text-sm text-red-700">{getApiErrorMessage(upload.error)}</p>
          ) : null}
          <button
            className="bg-ink flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            disabled={!file || upload.isPending}
            onClick={() => upload.mutate()}
            type="button"
          >
            <FiUpload /> {upload.isPending ? 'Uploading…' : 'Upload image'}
          </button>
        </div>
      </div>
      {deleting ? (
        <ConfirmDialog
          confirmLabel="Delete image"
          description="Delete this image permanently from the product and local image storage?"
          isPending={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove.mutate()}
          title="Delete product image"
        />
      ) : null}
    </section>
  );
};

const ProductForm = ({
  categories,
  images,
  initial,
  onClose,
  productId,
}: {
  categories: AdminCategory[];
  images: ProductImage[];
  initial: AdminProductWriteRequest;
  onClose: () => void;
  productId: string | null;
}) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdminProductWriteRequest>(initial);
  const save = useMutation({
    mutationFn: () => {
      const { slug, ...fields } = form;
      const input: AdminProductWriteRequest = {
        ...fields,
        currency: form.currency?.trim().toUpperCase() || 'PKR',
        name: form.name.trim(),
        sku: form.sku.trim().toUpperCase(),
        description: form.description.trim(),
        ...(slug?.trim() ? { slug: slug.trim() } : {}),
      };
      return productId ? adminApi.updateProduct(productId, input) : adminApi.createProduct(input);
    },
    onSuccess: async () => {
      toast.success(productId ? 'Product updated.' : 'Product created.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] }),
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
      ]);
      if (productId)
        await queryClient.invalidateQueries({ queryKey: adminQueryKeys.product(productId) });
      else onClose();
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-semibold sm:col-span-2">
          Name
          <input
            className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
            maxLength={180}
            minLength={2}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
            value={form.name}
          />
        </label>
        <label className="text-sm font-semibold">
          Slug
          <input
            className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
            onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="Generated when empty"
            value={form.slug ?? ''}
          />
        </label>
        <label className="text-sm font-semibold">
          SKU
          <input
            className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal uppercase"
            maxLength={64}
            onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
            required
            value={form.sku}
          />
        </label>
        <label className="text-sm font-semibold">
          Category
          <select
            className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
            onChange={(event) =>
              setForm((current) => ({ ...current, categoryId: event.target.value }))
            }
            required
            value={form.categoryId}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.isActive ? '' : ' (archived)'}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Currency
          <input
            className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal uppercase"
            maxLength={3}
            minLength={3}
            onChange={(event) =>
              setForm((current) => ({ ...current, currency: event.target.value }))
            }
            required
            value={form.currency ?? 'PKR'}
          />
        </label>
        <label className="text-sm font-semibold">
          Price
          <input
            className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
            min="0.01"
            onChange={(event) =>
              setForm((current) => ({ ...current, price: Number(event.target.value) }))
            }
            required
            step="0.01"
            type="number"
            value={form.price}
          />
        </label>
        <label className="text-sm font-semibold">
          Total stock
          <input
            className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
            min="0"
            onChange={(event) =>
              setForm((current) => ({ ...current, availableQuantity: Number(event.target.value) }))
            }
            required
            step="1"
            type="number"
            value={form.availableQuantity ?? 0}
          />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Description
          <textarea
            className="border-ink/15 mt-2 min-h-32 w-full rounded-xl border px-4 py-3 font-normal"
            maxLength={50000}
            minLength={1}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            required
            value={form.description}
          />
        </label>
        <label className="flex items-center gap-3 text-sm font-semibold sm:col-span-2">
          <input
            checked={form.isActive ?? true}
            onChange={(event) =>
              setForm((current) => ({ ...current, isActive: event.target.checked }))
            }
            type="checkbox"
          />{' '}
          Active
        </label>
        {save.isError ? (
          <p className="text-sm text-red-700 sm:col-span-2" role="alert">
            {getApiErrorMessage(save.error)}
          </p>
        ) : null}
        <div className="flex justify-end gap-3 sm:col-span-2">
          <button
            className="border-ink/15 rounded-xl border px-4 py-2"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="bg-ink rounded-xl px-4 py-2 font-semibold text-white disabled:opacity-40"
            disabled={save.isPending || categories.length === 0}
            type="submit"
          >
            {save.isPending ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </form>
      {productId ? <ImagesManager images={images} productId={productId} /> : null}
    </>
  );
};

export const ProductEditor = ({
  categories,
  onClose,
  productId,
}: {
  categories: AdminCategory[];
  onClose: () => void;
  productId: string | null;
}) => {
  const productQuery = useQuery({
    enabled: Boolean(productId),
    queryFn: () => adminApi.getProduct(productId ?? ''),
    queryKey: adminQueryKeys.product(productId ?? 'new'),
  });
  const product = productQuery.data?.product;
  const initial = product
    ? {
        availableQuantity: product.inventory.totalQuantity,
        categoryId: product.categoryId,
        currency: product.currency,
        description: product.description,
        isActive: product.isActive,
        name: product.name,
        price: Number(product.price),
        sku: product.sku,
        slug: product.slug,
      }
    : { ...blankProduct, categoryId: categories.find((item) => item.isActive)?.id ?? '' };
  return (
    <AdminModal onClose={onClose} title={productId ? 'Edit product' : 'Create product'}>
      {productId && productQuery.isPending ? <AdminLoadingState rows={4} /> : null}
      {productQuery.isError ? (
        <AdminErrorState
          message={getApiErrorMessage(productQuery.error)}
          retry={() => void productQuery.refetch()}
        />
      ) : null}
      {!productId || product ? (
        <ProductForm
          categories={categories}
          images={product?.images ?? []}
          initial={initial}
          key={product?.updatedAt ?? 'new'}
          onClose={onClose}
          productId={productId}
        />
      ) : null}
    </AdminModal>
  );
};
