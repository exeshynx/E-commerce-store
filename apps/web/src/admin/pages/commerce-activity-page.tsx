import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { adminApi, adminQueryKeys } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { formatDate } from '../../lib/format-date';
import { formatPrice } from '../../lib/format-price';
import { AdminErrorState, AdminLoadingState, AdminPageHeader } from '../components/admin-ui';

const Customer = ({
  user,
}: {
  user: { email: string; firstName: string; isGuest: boolean; lastName: string };
}) => (
  <div>
    <p className="font-semibold">
      {user.isGuest ? 'Guest shopper' : `${user.firstName} ${user.lastName}`}
    </p>
    <p className="text-ink/45 text-xs">
      {user.isGuest ? 'Anonymous checkout session' : user.email}
    </p>
  </div>
);

export const AdminCommerceActivityPage = () => {
  const activity = useQuery({
    queryFn: adminApi.getCommerceActivity,
    queryKey: adminQueryKeys.commerceActivity,
  });
  return (
    <>
      <Helmet>
        <title>Commerce Activity — Veyora Admin</title>
      </Helmet>
      <AdminPageHeader
        description="See exactly who has products in a cart and which customers completed paid purchases."
        eyebrow="Customer intelligence"
        title="Cart & purchase activity"
      />
      <div className="mt-8">
        {activity.isPending ? <AdminLoadingState rows={8} /> : null}
        {activity.isError ? (
          <AdminErrorState
            message={getApiErrorMessage(activity.error)}
            retry={() => void activity.refetch()}
          />
        ) : null}
        {activity.data ? (
          <div className="space-y-10">
            <section>
              <h2 className="font-display mb-5 text-3xl">
                Active carts · {activity.data.carts.length}
              </h2>
              <div className="grid gap-4 xl:grid-cols-2">
                {activity.data.carts.map((cart) => (
                  <article className="border-ink/10 rounded-2xl border bg-white p-5" key={cart.id}>
                    <div className="flex justify-between gap-4">
                      <Customer user={cart.user} />
                      <p className="text-ink/45 text-xs">{formatDate(cart.updatedAt)}</p>
                    </div>
                    <ul className="border-ink/10 mt-4 space-y-2 border-t pt-4">
                      {cart.items.map((item) => (
                        <li className="flex justify-between gap-4 text-sm" key={item.id}>
                          <Link
                            className="font-semibold hover:underline"
                            to={`/products/${item.product.slug}`}
                          >
                            {item.product.name}{' '}
                            <span className="text-ink/40">· {item.product.sku}</span>
                          </Link>
                          <span>× {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
            <section>
              <h2 className="font-display mb-5 text-3xl">
                Completed purchases · {activity.data.purchases.length}
              </h2>
              <div className="space-y-4">
                {activity.data.purchases.map((purchase) => (
                  <article
                    className="border-ink/10 rounded-2xl border bg-white p-5"
                    key={purchase.id}
                  >
                    <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                      <Customer user={purchase.user} />
                      <div>
                        <Link
                          className="font-semibold hover:underline"
                          to={`/admin/orders/${purchase.id}`}
                        >
                          {purchase.orderNumber}
                        </Link>
                        <p className="text-ink/45 text-xs">
                          {purchase.items
                            .map((item) => `${item.productName} × ${item.quantity}`)
                            .join(', ')}
                        </p>
                      </div>
                      <div className="md:text-right">
                        <p className="font-semibold">
                          {formatPrice(purchase.total, purchase.currency)}
                        </p>
                        <p className="text-ink/45 text-xs">{formatDate(purchase.createdAt)}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </>
  );
};
