import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logError } from '../utils/errors';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Something went wrong',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, {
      source: 'react',
      action: 'Component render crash',
      component: info.componentStack?.trim(),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-theme-bg px-4">
          <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface p-8 text-center shadow-panel">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
              !
            </div>
            <h1 className="text-lg font-semibold text-theme-fg">Something went wrong</h1>
            <p className="mt-2 text-sm text-theme-secondary">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary mt-6 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
