
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component to catch rendering errors and display a fallback UI.
 */
// Use React.Component explicitly to ensure proper inheritance in all environments
export class ErrorBoundary extends React.Component<Props, State> {
  // Use property initializer for state to avoid constructor boilerplate
  public state: State = {
    hasError: false,
    error: null
  };

  /**
   * Static method called after an error is thrown in a child component.
   * Updates state so the next render will show the fallback UI.
   */
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Method called to log error information or send to an error reporting service.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  /**
   * Renders either the children or the error fallback UI.
   */
  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[2rem] shadow-2xl p-8 border border-slate-200 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">問題が発生しました</h1>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              アプリケーションの実行中に予期しないエラーが発生しました。ページを再読み込みしてください。
            </p>
            <div className="bg-slate-50 rounded-xl p-4 mb-8 text-left border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Error Message</p>
              <p className="text-xs font-mono text-red-600 break-words">{this.state.error?.message || 'Unknown error'}</p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                <RefreshCw size={18} />
                再読み込みする
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
              >
                <Home size={18} />
                トップに戻る
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Correctly accessing inherited 'props' from React.Component
    return this.props.children;
  }
}
