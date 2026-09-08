import type { AdminCategory, AdminCategoryWriteRequest } from '@aurelia/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { FiPlus } from 'react-icons/fi';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../lib/api-error';
import {
  adminApi,
  adminQueryKeys,
  type ActivityFilter,
  type AdminCategoryListParameters,
} from '../../lib/admin-api';
import { formatDate } from '../../lib/format-date';
import {
  AdminBadge,
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
  AdminModal,
  AdminPageHeader,
  AdminPagination,
  AdminSearchBar,
  AdminTable,
  AdminTableHead,
  ConfirmDialog,
} from '../components/admin-ui';
import { useAdminListFilters } from '../use-admin-list-filters';

const pageSize = 20;
const emptyForm: AdminCategoryWriteRequest = {
  description: '',
  isActive: true,
  name: '',
  slug: '',
};

export const AdminCategoriesPage = () => {
  const filters = useAdminListFilters();
  const queryClient = useQueryClient();
  const status = (filters.searchParams.get('status') || 'all') as ActivityFilter;
  const parameters: AdminCategoryListParameters = {
    page: filters.page,
    pageSize,
    status,
    ...(filters.query ? { q: filters.query } : {}),
  };
  const categories = useQuery({
    queryFn: () => adminApi.listCategories(parameters),
    queryKey: adminQueryKeys.categories(parameters),
  });
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);
  const [archiving, setArchiving] = useState<AdminCategory | null>(null);
  const [form, setForm] = useState<AdminCategoryWriteRequest>(emptyForm);
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] }),
      queryClient.invalidateQueries({ queryKey: ['catalog', 'categories'] }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboard }),
    ]);
  const save = useMutation({
    mutationFn: () => {
      const { slug, ...fields } = form;
      const input = { ...fields, ...(slug?.trim() ? { slug: slug.trim() } : {}) };
      return editing === 'new'
        ? adminApi.createCategory(input)
        : adminApi.updateCategory(editing?.id ?? '', input);
    },
    onSuccess: async () => {
      toast.success(editing === 'new' ? 'Category created.' : 'Category updated.');
      setEditing(null);
      await invalidate();
    },
  });
  const archive = useMutation({
    mutationFn: () => adminApi.archiveCategory(archiving?.id ?? ''),
    onSuccess: async () => {
      toast.success('Category archived.');
      setArchiving(null);
      await invalidate();
    },
  });
  const restore = useMutation({
    mutationFn: adminApi.restoreCategory,
    onSuccess: async () => {
      toast.success('Category restored.');
      await invalidate();
    },
  });
  const openNew = () => {
    setForm(emptyForm);
    save.reset();
    setEditing('new');
  };
  const openEdit = (category: AdminCategory) => {
    setForm({
      description: category.description ?? '',
      isActive: category.isActive,
      name: category.name,
      slug: category.slug,
    });
    save.reset();
    setEditing(category);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <>
      <Helmet>
        <title>Categories — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        actions={
          <button
            className="bg-ink flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white"
            onClick={openNew}
            type="button"
          >
            <FiPlus /> New category
          </button>
        }
        description="Create, edit, archive, restore, and review category product counts."
        eyebrow="Catalog"
        title="Categories"
      />
      <div className="mt-8 flex flex-col gap-3 lg:flex-row">
        <AdminSearchBar
          onChange={filters.setSearch}
          onSubmit={() => filters.updateFilters({ q: filters.search.trim() || undefined })}
          placeholder="Search categories"
          value={filters.search}
        />
        <select
          aria-label="Filter category status"
          className="border-ink/15 rounded-xl border bg-white px-4 py-2.5 text-sm"
          onChange={(event) => filters.updateFilters({ status: event.target.value })}
          value={status}
        >
          <option value="all">All categories</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div className="mt-6">
        {categories.isPending ? <AdminLoadingState /> : null}
        {categories.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(categories.error)}
            retry={() => void categories.refetch()}
          />
        ) : null}
        {categories.data?.items.length === 0 ? (
          <AdminEmptyState
            message="Create a category or adjust your filters."
            title="No categories found"
          />
        ) : null}
        {categories.data?.items.length ? (
          <div className="space-y-5">
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Active products</th>
                  <th className="px-5 py-3">Total products</th>
                  <th className="px-5 py-3">Updated</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </AdminTableHead>
              <tbody className="divide-ink/10 divide-y">
                {categories.data.items.map((category) => (
                  <tr key={category.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{category.name}</p>
                      <p className="text-ink/45 text-xs">/{category.slug}</p>
                    </td>
                    <td className="px-5 py-4">
                      <AdminBadge tone={category.isActive ? 'good' : 'neutral'}>
                        {category.isActive ? 'Active' : 'Archived'}
                      </AdminBadge>
                    </td>
                    <td className="px-5 py-4">{category.activeProductCount}</td>
                    <td className="px-5 py-4">{category.productCount}</td>
                    <td className="text-ink/50 px-5 py-4">{formatDate(category.updatedAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-3">
                        <button
                          className="font-semibold underline"
                          onClick={() => openEdit(category)}
                          type="button"
                        >
                          Edit
                        </button>
                        {category.isActive ? (
                          <button
                            className="font-semibold text-red-700 underline"
                            onClick={() => setArchiving(category)}
                            type="button"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            className="font-semibold text-emerald-700 underline"
                            disabled={restore.isPending}
                            onClick={() => restore.mutate(category.id)}
                            type="button"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
            <AdminPagination
              isFetching={categories.isFetching}
              onPageChange={(page) => filters.updateFilters({ page: String(page) })}
              page={categories.data.pagination.page}
              totalPages={categories.data.pagination.totalPages}
            />
          </div>
        ) : null}
      </div>
      {editing ? (
        <AdminModal
          onClose={() => setEditing(null)}
          title={editing === 'new' ? 'Create category' : 'Edit category'}
        >
          <form className="space-y-4" onSubmit={submit}>
            <label className="block text-sm font-semibold">
              Name
              <input
                className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                maxLength={120}
                minLength={2}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                required
                value={form.name}
              />
            </label>
            <label className="block text-sm font-semibold">
              Slug
              <input
                className="border-ink/15 mt-2 w-full rounded-xl border px-4 py-3 font-normal"
                maxLength={140}
                onChange={(event) =>
                  setForm((current) => ({ ...current, slug: event.target.value }))
                }
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="Generated from the name when empty"
                value={form.slug ?? ''}
              />
            </label>
            <label className="block text-sm font-semibold">
              Description
              <textarea
                className="border-ink/15 mt-2 min-h-28 w-full rounded-xl border px-4 py-3 font-normal"
                maxLength={10000}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                value={form.description ?? ''}
              />
            </label>
            <label className="flex items-center gap-3 text-sm font-semibold">
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
              <p className="text-sm text-red-700" role="alert">
                {getApiErrorMessage(save.error)}
              </p>
            ) : null}
            <div className="flex justify-end gap-3">
              <button
                className="border-ink/15 rounded-xl border px-4 py-2"
                onClick={() => setEditing(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="bg-ink rounded-xl px-4 py-2 font-semibold text-white disabled:opacity-40"
                disabled={save.isPending}
                type="submit"
              >
                {save.isPending ? 'Saving…' : 'Save category'}
              </button>
            </div>
          </form>
        </AdminModal>
      ) : null}
      {archiving ? (
        <ConfirmDialog
          confirmLabel="Archive category"
          description={`Archive ${archiving.name}? Its products will no longer be publicly available until the category is restored.`}
          isPending={archive.isPending}
          onCancel={() => setArchiving(null)}
          onConfirm={() => archive.mutate()}
          title="Archive category"
        />
      ) : null}
    </>
  );
};
