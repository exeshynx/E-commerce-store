import { useEffect, useRef } from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const useDialogFocus = <T extends HTMLElement>({
  active,
  lockBody = true,
  onClose,
}: {
  active: boolean;
  lockBody?: boolean;
  onClose: () => void;
}) => {
  const containerRef = useRef<T>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const restoreFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    if (lockBody) document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      const first = containerRef.current?.querySelector<HTMLElement>(focusableSelector);
      (first ?? containerRef.current)?.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) return;
      const focusable = [...containerRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      if (!focusable.length) {
        event.preventDefault();
        containerRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      if (lockBody) document.body.style.overflow = previousOverflow;
      restoreFocus?.focus();
    };
  }, [active, lockBody]);

  return containerRef;
};
