import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { APP_VERSION } from '../../version';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = {
    hasError: false,
    error: null,
    copied: false,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleCopyDiagnostics = async () => {
    const info = [
      `Blackbook Version: ${APP_VERSION}`,
      `Time: ${new Date().toISOString()}`,
      `Error: ${this.state.error?.message ?? 'Unknown error'}`,
      `Stack: ${this.state.error?.stack ?? 'No stack available'}`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
    ].join('\n');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(info);
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      }
    } catch {
      // ignore
    }
  };

  handleReload = () => {
    if (this.props.onReset) {
      this.props.onReset();
      this.setState({ hasError: false, error: null, copied: false });
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-[#121215] p-8 shadow-2xl space-y-6">
            <div className="space-y-2">
              <h1 className="font-mono text-xl font-bold tracking-tight text-white">Something went wrong</h1>
              <p className="text-sm text-zinc-400">
                Blackbook encountered an unexpected error. Your saved sessions, attempts, and settings are preserved on disk.
              </p>
            </div>

            {this.state.error && (
              <div className="rounded-lg border border-red-950 bg-red-950/20 p-4 font-mono text-xs text-red-300 break-words max-h-48 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-100 text-zinc-900 hover:bg-white transition-colors"
              >
                Reload app
              </button>
              <button
                type="button"
                onClick={this.handleCopyDiagnostics}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 transition-colors"
              >
                {this.state.copied ? 'Copied to clipboard' : 'Copy diagnostics'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
