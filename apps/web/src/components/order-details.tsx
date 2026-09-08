import type { CustomerOrder } from '@veyora/contracts';
import { formatDate } from '../lib/format-date';
import { formatPrice } from '../lib/format-price';
import { OrderStatusBadge } from './order-status-badge';

export const OrderDetails = ({ order }: { order: CustomerOrder }) => (
  <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_22rem]">
    <section className="space-y-5">
      <div className="border-ink/10 rounded-[1.5rem] border bg-white/50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-ink/45 text-xs tracking-[0.14em] uppercase">Order number</p>
            <h2 className="font-display mt-2 text-3xl">{order.orderNumber}</h2>
            <p className="text-ink/50 mt-2 text-sm">Placed {formatDate(order.createdAt)}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <div className="border-ink/10 rounded-[1.5rem] border bg-white/50 p-6">
        <h2 className="font-display text-3xl">Items</h2>
        <div className="mt-6 divide-y divide-black/10">
          {order.items.map((item) => (
            <article className="flex justify-between gap-5 py-5 first:pt-0 last:pb-0" key={item.id}>
              <div>
                <h3 className="font-display text-xl">{item.productName}</h3>
                <p className="text-ink/45 mt-1 text-xs">SKU {item.sku}</p>
                <p className="text-ink/55 mt-2 text-sm">
                  {formatPrice(item.unitPrice, item.currency)} × {item.quantity}
                </p>
              </div>
              <strong className="shrink-0 text-sm">
                {formatPrice(item.lineSubtotal, item.currency)}
              </strong>
            </article>
          ))}
        </div>
      </div>
    </section>

    <aside className="space-y-5">
      <div className="rounded-[1.5rem] bg-white/70 p-6 shadow-[0_20px_60px_rgba(65,50,30,0.07)]">
        <h2 className="font-display text-2xl">Order summary</h2>
        <dl className="mt-5 space-y-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink/55">Subtotal</dt>
            <dd>{formatPrice(order.subtotal, order.currency)}</dd>
          </div>
          {Number(order.discountAmount) > 0 ? (
            <div className="flex justify-between text-emerald-700">
              <dt>{order.coupon ? `Coupon ${order.coupon.code}` : 'Discount'}</dt>
              <dd>− {formatPrice(order.discountAmount, order.currency)}</dd>
            </div>
          ) : null}
          <div className="border-ink/10 flex justify-between border-t pt-4 text-base">
            <dt>Total</dt>
            <dd className="font-semibold">{formatPrice(order.total, order.currency)}</dd>
          </div>
        </dl>
      </div>

      {order.shippingAddress ? (
        <div className="border-ink/10 rounded-[1.5rem] border p-6 text-sm">
          <h2 className="font-display text-2xl">Shipping details</h2>
          <address className="text-ink/60 mt-4 space-y-1 leading-6 not-italic">
            <p className="text-ink font-semibold">{order.shippingAddress.fullName}</p>
            <p>{order.shippingAddress.address}</p>
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.province}{' '}
              {order.shippingAddress.postalCode}
            </p>
            <p>{order.shippingAddress.country}</p>
            <p className="pt-2">{order.shippingAddress.phone}</p>
            <p>{order.shippingAddress.email}</p>
          </address>
        </div>
      ) : null}
    </aside>
  </div>
);
