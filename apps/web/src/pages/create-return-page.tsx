import type { ReturnReason } from '@veyora/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { SiteHeader } from '../components/site-header';
import { getApiErrorMessage } from '../lib/api-error';
import { orderQueryKeys, ordersApi } from '../lib/orders-api';
import { returnsApi } from '../lib/returns-api';

const reasons: ReturnReason[] = [
  'DAMAGED',
  'DEFECTIVE',
  'WRONG_ITEM',
  'NOT_AS_DESCRIBED',
  'SIZE_OR_FIT',
  'CHANGED_MIND',
  'OTHER',
];

export const CreateReturnPage = () => {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const order = useQuery({
    enabled: Boolean(orderId),
    queryFn: () => ordersApi.getOrder(orderId),
    queryKey: orderQueryKeys.detail(orderId),
  });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [itemReasons, setItemReasons] = useState<Record<string, ReturnReason>>({});
  const [note, setNote] = useState('');
  const create = useMutation({
    mutationFn: () =>
      returnsApi.create({
        orderId,
        ...(note.trim() ? { customerNote: note.trim() } : {}),
        items: (order.data?.order.items ?? [])
          .filter((item) => (quantities[item.id] ?? 0) > 0)
          .map((item) => ({
            orderItemId: item.id,
            quantity: quantities[item.id] ?? 0,
            reason: itemReasons[item.id] ?? 'DAMAGED',
          })),
      }),
    onSuccess: ({ returnRequest }) => navigate(`/returns/${returnRequest.id}`),
  });
  const selected = Object.values(quantities).some((quantity) => quantity > 0);
  return (
    <>
      <Helmet>
        <title>Request a return — Veyora</title>
      </Helmet>
      <main className="bg-porcelain min-h-screen px-4 py-8 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-5xl">
          <SiteHeader />
          <section className="py-14">
            <p className="text-champagne text-xs font-bold uppercase">
              Return merchandise authorization
            </p>
            <h1 className="font-display mt-3 text-5xl">Request a return</h1>
            {order.isPending ? (
              <div className="bg-mist mt-8 h-64 animate-pulse rounded-2xl" />
            ) : null}
            {order.isError ? (
              <div className="mt-8 rounded-xl bg-red-50 p-5">{getApiErrorMessage(order.error)}</div>
            ) : null}
            {order.data ? (
              <form
                className="mt-8 space-y-6"
                onSubmit={(event) => {
                  event.preventDefault();
                  create.mutate();
                }}
              >
                <section className="border-ink/10 rounded-2xl border bg-white p-6">
                  <p className="text-sm font-semibold">Order {order.data.order.orderNumber}</p>
                  <div className="mt-5 space-y-5">
                    {order.data.order.items.map((item) => (
                      <div
                        className="grid gap-3 border-t pt-5 first:border-0 first:pt-0 sm:grid-cols-[1fr_8rem_14rem]"
                        key={item.id}
                      >
                        <div>
                          <p className="font-semibold">{item.productName}</p>
                          <p className="text-ink/50 text-sm">Purchased quantity: {item.quantity}</p>
                        </div>
                        <label className="text-sm">
                          Quantity
                          <input
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            max={item.quantity}
                            min={0}
                            onChange={(event) =>
                              setQuantities((value) => ({
                                ...value,
                                [item.id]: Number(event.target.value),
                              }))
                            }
                            type="number"
                            value={quantities[item.id] ?? 0}
                          />
                        </label>
                        <label className="text-sm">
                          Reason
                          <select
                            className="mt-1 w-full rounded-lg border px-3 py-2"
                            onChange={(event) =>
                              setItemReasons((value) => ({
                                ...value,
                                [item.id]: event.target.value as ReturnReason,
                              }))
                            }
                            value={itemReasons[item.id] ?? 'DAMAGED'}
                          >
                            {reasons.map((reason) => (
                              <option key={reason} value={reason}>
                                {reason.replaceAll('_', ' ')}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ))}
                  </div>
                </section>
                <label className="block text-sm font-semibold">
                  Additional details
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-xl border bg-white px-4 py-3 font-normal"
                    maxLength={1000}
                    onChange={(event) => setNote(event.target.value)}
                    value={note}
                  />
                </label>
                {create.isError ? (
                  <p className="rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert">
                    {getApiErrorMessage(create.error)}
                  </p>
                ) : null}
                <button
                  className="bg-ink rounded-xl px-6 py-3 font-semibold text-white disabled:opacity-40"
                  disabled={!selected || create.isPending}
                >
                  {create.isPending ? 'Submitting…' : 'Submit return request'}
                </button>
              </form>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
};
