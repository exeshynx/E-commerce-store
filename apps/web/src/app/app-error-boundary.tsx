import { Component, type ErrorInfo, type PropsWithChildren } from 'react';

export class AppErrorBoundary extends Component<
  PropsWithChildren<{ pathname: string }>,
  { error: Error | null }
> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, details: ErrorInfo) {
    console.error('Storefront render failure', error, details.componentStack);
  }

  override componentDidUpdate(previous: Readonly<PropsWithChildren<{ pathname: string }>>) {
    if (previous.pathname !== this.props.pathname && this.state.error) {
      this.setState({ error: null });
    }
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="bg-porcelain grid min-h-screen place-items-center p-6">
        <section className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-xl" role="alert">
          <p className="text-champagne text-xs font-semibold tracking-wider uppercase">
            Something went wrong
          </p>
          <h1 className="font-display mt-3 text-4xl">This page could not be displayed.</h1>
          <p className="text-ink/55 mt-4 text-sm">
            Reload the page. If the problem continues, contact support with the request details.
          </p>
          <button
            className="bg-ink mt-6 rounded-full px-6 py-3 text-xs font-semibold text-white uppercase"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload page
          </button>
        </section>
      </main>
    );
  }
}
