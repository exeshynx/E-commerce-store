import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { lazy, Suspense, useState, type PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { MotionConfig } from 'motion/react';
import { AuthBootstrap } from './auth-bootstrap';

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((module) => ({
        default: module.ReactQueryDevtools,
      })),
    )
  : null;

export const AppProviders = ({ children }: PropsWithChildren) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
            staleTime: 60_000,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <AuthBootstrap>{children}</AuthBootstrap>
          </BrowserRouter>
        </MotionConfig>
        <Toaster position="top-right" richColors />
        {ReactQueryDevtools ? (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </HelmetProvider>
  );
};
