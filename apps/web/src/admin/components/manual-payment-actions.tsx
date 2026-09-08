import type { PaymentAttempt } from '@aurelia/contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { adminApi } from '../../lib/admin-api';
import { getApiErrorMessage } from '../../lib/api-error';
import { AdminModal } from './admin-ui';

export const ManualPaymentActions = ({
  onSettled,
  payment,
}: {
  onSettled: () => Promise<void> | void;
  payment: PaymentAttempt;
}) => {
  const [outcome, setOutcome] = useState<'SUCCEEDED' | 'FAILED' | null>(null);
  const [failureReason, setFailureReason] = useState('');
  const settlement = useMutation({
    mutationFn: () => {
      if (outcome === 'FAILED') {
        return adminApi.updatePaymentStatus(payment.id, {
          failureReason: failureReason.trim(),
          status: 'FAILED',
        });
      }
      return adminApi.updatePaymentStatus(payment.id, { status: 'SUCCEEDED' });
    },
    onSuccess: async () => {
      toast.success(outcome === 'FAILED' ? 'Payment marked as failed.' : 'Payment confirmed.');
      setOutcome(null);
      setFailureReason('');
      await onSettled();
    },
  });

  if (
    payment.provider !== 'MANUAL' ||
    (payment.status !== 'PENDING' && payment.status !== 'PROCESSING')
  ) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white"
          onClick={() => setOutcome('SUCCEEDED')}
          type="button"
        >
          Confirm success
        </button>
        <button
          className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white"
          onClick={() => setOutcome('FAILED')}
          type="button"
        >
          Mark failed
        </button>
      </div>
      {outcome ? (
        <AdminModal
          onClose={() => {
            if (!settlement.isPending) setOutcome(null);
          }}
          title={outcome === 'FAILED' ? 'Record failed payment' : 'Confirm payment success'}
        >
          <p className="text-ink/60 text-sm leading-6">
            {outcome === 'FAILED'
              ? 'The attempt will remain in payment history and the order will continue awaiting payment.'
              : 'This will mark the attempt as successful and move the order into processing.'}
          </p>
          {outcome === 'FAILED' ? (
            <label className="mt-5 block text-sm font-semibold">
              Failure reason
              <textarea
                className="border-ink/15 mt-2 min-h-24 w-full rounded-xl border px-4 py-3 font-normal"
                maxLength={500}
                onChange={(event) => setFailureReason(event.target.value)}
                required
                value={failureReason}
              />
            </label>
          ) : null}
          {settlement.isError ? (
            <p className="mt-4 text-sm text-red-700" role="alert">
              {getApiErrorMessage(settlement.error)}
            </p>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <button
              className="border-ink/15 rounded-xl border px-4 py-2"
              disabled={settlement.isPending}
              onClick={() => setOutcome(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={`rounded-xl px-4 py-2 font-semibold text-white disabled:opacity-50 ${
                outcome === 'FAILED' ? 'bg-red-700' : 'bg-emerald-700'
              }`}
              disabled={
                settlement.isPending || (outcome === 'FAILED' && failureReason.trim().length === 0)
              }
              onClick={() => settlement.mutate()}
              type="button"
            >
              {settlement.isPending ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </AdminModal>
      ) : null}
    </>
  );
};
