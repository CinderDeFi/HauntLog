import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the real stack to the console for debugging.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 py-8">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 mb-6">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-xs font-mono text-red-400 tracking-widest mb-2">
            // SOMETHING BROKE
          </div>
          <h1 className="text-3xl font-medium tracking-tighter mb-3">
            Unexpected error.
          </h1>
          <p className="text-white/60 mb-6 leading-relaxed">
            HauntLog hit a snag. Try reloading. If it keeps happening, the
            error details below help us debug.
          </p>

          <details className="text-left bg-zinc-900 border border-white/10 rounded-2xl p-4 mb-6">
            <summary className="text-xs font-mono text-white/40 tracking-widest cursor-pointer">
              ERROR DETAILS
            </summary>
            <pre className="mt-3 text-xs text-red-300 whitespace-pre-wrap break-words font-mono">
              {this.state.error.message}
              {this.state.error.stack && (
                <>
                  {'\n\n'}
                  {this.state.error.stack}
                </>
              )}
            </pre>
          </details>

          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => {
                this.reset();
                window.location.reload();
              }}
              className="px-5 py-3 bg-haunt-red hover:bg-red-600 text-white rounded-xl font-mono tracking-widest text-sm flex items-center gap-x-2"
            >
              <RefreshCw className="w-4 h-4" /> RELOAD
            </button>
            <button
              onClick={() => {
                this.reset();
                window.location.href = '/';
              }}
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-mono tracking-widest text-sm flex items-center gap-x-2"
            >
              <Home className="w-4 h-4" /> GO HOME
            </button>
          </div>
        </div>
      </div>
    );
  }
}
