import React, { useMemo, useState } from 'react';
import { X, Star } from 'lucide-react';
import { submitFeedback } from '../services/feedback';
import type { UserMode } from './ModeSelect';

interface FeedbackModalProps {
  onClose: () => void;
  userMode?: UserMode;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose, userMode = 'beginner' }) => {
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const context = useMemo(() => ({
    userMode,
    ua: navigator.userAgent,
    page: window.location.pathname,
  }), [userMode]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await submitFeedback({ rating, message, context });
      setDone(true);
    } catch (e: any) {
      setError(e.message || '送信に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-slate-800">フィードバック</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="text-sm text-slate-700">
            送信しました。ご協力ありがとうございます。
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2">評価</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => setRating(v)}
                    className={`p-1 rounded ${v <= rating ? 'text-amber-500' : 'text-slate-300'}`}
                    aria-label={`rating-${v}`}
                  >
                    <Star className="w-6 h-6" fill={v <= rating ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-slate-500">何かあれば書いてください（任意）</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-2 w-full h-28 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="例: ここが分かりづらかった / こうしてほしい"
              />
            </div>
            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-2.5 rounded-xl text-sm font-black bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isSubmitting ? '送信中...' : '送信する'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;
