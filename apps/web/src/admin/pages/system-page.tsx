import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { getApiErrorMessage } from '../../lib/api-error';
import { adminApi, adminQueryKeys } from '../../lib/admin-api';
import { formatDate } from '../../lib/format-date';
import {
  AdminBadge,
  AdminErrorState,
  AdminLoadingState,
  AdminPageHeader,
} from '../components/admin-ui';

export const AdminSystemPage = () => {
  const system = useQuery({ queryFn: adminApi.getSystemOverview, queryKey: adminQueryKeys.system });
  return (
    <>
      <Helmet>
        <title>System Overview — Veyora Administration</title>
      </Helmet>
      <AdminPageHeader
        description="Safe runtime and database readiness information. Credentials and secret configuration are never exposed."
        eyebrow="Operations"
        title="System overview"
      />
      <div className="mt-8">
        {system.isPending ? <AdminLoadingState rows={3} /> : null}
        {system.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(system.error)}
            retry={() => void system.refetch()}
          />
        ) : null}
        {system.data ? (
          <dl className="border-ink/10 grid overflow-hidden rounded-2xl border bg-white sm:grid-cols-2">
            {[
              ['Service', system.data.service],
              ['API version', system.data.apiVersion],
              ['Environment', system.data.environment],
              ['Node.js', system.data.nodeVersion],
              ['Database', system.data.database],
              ['Server time', formatDate(system.data.timestamp)],
              ['Uptime', `${system.data.uptimeSeconds.toLocaleString()} seconds`],
            ].map(([label, value]) => (
              <div className="border-ink/10 border-b p-5 odd:sm:border-r" key={label}>
                <dt className="text-ink/45 text-xs font-semibold tracking-[0.1em] uppercase">
                  {label}
                </dt>
                <dd className="mt-2 font-semibold">
                  {label === 'Database' ? <AdminBadge tone="good">{value}</AdminBadge> : value}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </>
  );
};
