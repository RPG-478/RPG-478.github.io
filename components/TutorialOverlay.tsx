import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Send, Share2, Menu, Zap, Code2, X, Check, ChevronRight, SlidersHorizontal, MousePointer2, ArrowDown } from 'lucide-react';

// ─── Step definitions ───

interface TutorialStep {
  id: string;
  title: string;
  body: string;
  /** data-tour="xxx" on the target element */
  target?: string;
  /** Where to put the tooltip relative to the target */
  placement: 'center' | 'above' | 'below' | 'left' | 'right';
  /** If set, wait for the user to click the actual target element before advancing */
  waitForClick?: boolean;
  /** CTA text shown on the button */
  cta?: string;
  icon: React.ReactNode;
}

const STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Archyへようこそ！ 🎉',
    body: 'テキストからAIが図を自動作成するアプリです。\n30秒でサクッと使い方を紹介します！',
    placement: 'center',
    cta: 'はじめる',
    icon: <Sparkles className="w-7 h-7" />,
  },
  {
    id: 'input-bar',
    title: '① ここに入力してみよう',
    body: '作りたい図の内容を入力します。\n例：「ログイン画面の流れ」「カレーの作り方」',
    target: 'tour-input',
    placement: 'above',
    cta: '次へ',
    icon: <Send className="w-5 h-5" />,
  },
  {
    id: 'send-btn',
    title: '② 送信！',
    body: 'このボタンでAIが図を作ってくれます。\nテンプレートから選ぶこともOK 👌',
    target: 'tour-send',
    placement: 'above',
    cta: '次へ',
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    id: 'settings-btn',
    title: '③ 設定で図をカスタマイズ',
    body: 'シンプル〜くわしい、ノード数、図の種類など\n自由に調整できます。\n「くわしい」モードは無料枠を多く使います⚡',
    target: 'tour-settings',
    placement: 'above',
    cta: '次へ',
    icon: <SlidersHorizontal className="w-5 h-5" />,
  },
  {
    id: 'menu',
    title: '④ メニュー',
    body: '履歴やテンプレートはここから。\n過去に作った図をいつでも呼び出せます📁',
    target: 'tour-menu',
    placement: 'below',
    cta: '次へ',
    icon: <Menu className="w-5 h-5" />,
  },
  {
    id: 'credits',
    title: '⑤ 無料枠',
    body: '無料プランでは回数制限があります。\n毎日ログインで +5回 もらえます！🎁',
    target: 'tour-credits',
    placement: 'below',
    cta: '次へ',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    id: 'mode-switch',
    title: '⑥ 開発者モードを試してみよう',
    body: 'Mermaidコードを直接編集したい方はここから\n「開発モード」に切り替えできます💻\n下のボタンか、光っているボタンを押してみて！',
    target: 'tour-mode',
    placement: 'below',
    waitForClick: true,
    cta: 'ここを押してみよう！',
    icon: <Code2 className="w-5 h-5" />,
  },
  {
    id: 'done',
    title: '準備完了！ ✨',
    body: 'さっそく図を作ってみましょう。\n下の入力バーに文章を入力して始めてください！',
    placement: 'center',
    cta: '始める！',
    icon: <Check className="w-7 h-7" />,
  },
];

// ─── Spotlight mask (SVG cutout) ───

interface SpotlightRect {
  x: number; y: number; w: number; h: number; r: number;
}

const SpotlightMask: React.FC<{ rect: SpotlightRect | null; pulse?: boolean }> = ({ rect, pulse }) => {
  if (!rect) {
    return <div className="absolute inset-0 bg-black/60 transition-all duration-500" />;
  }

  const pad = 6;
  const r = rect.r + 4;
  const x = rect.x - pad;
  const y = rect.y - pad;
  const w = rect.w + pad * 2;
  const h = rect.h + pad * 2;

  return (
    <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#tour-mask)" />
      </svg>

      <div
        className={`absolute border-2 border-blue-400 pointer-events-none transition-all duration-500 ${pulse ? 'animate-pulse' : ''}`}
        style={{
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: r,
          boxShadow: '0 0 0 4px rgba(59,130,246,0.25), 0 0 20px 4px rgba(59,130,246,0.15)',
          zIndex: 1,
        }}
      />
    </>
  );
};

// ─── Tooltip card ───

interface TooltipProps {
  step: TutorialStep;
  rect: SpotlightRect | null;
  stepIndex: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
  onBack: () => void;
  animating: boolean;
}

const Tooltip: React.FC<TooltipProps> = ({ step, rect, stepIndex, total, onNext, onSkip, onBack, animating }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!ref.current) return;
    const card = ref.current;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 14;

    if (!rect || step.placement === 'center') {
      setPos({ top: '50%', left: '50%', transform: 'translate(-50%,-50%)' });
      return;
    }

    let top = 0, left = 0;

    switch (step.placement) {
      case 'above':
        top = rect.y - ch - gap;
        left = rect.x + rect.w / 2 - cw / 2;
        break;
      case 'below':
        top = rect.y + rect.h + gap;
        left = rect.x + rect.w / 2 - cw / 2;
        break;
      case 'left':
        top = rect.y + rect.h / 2 - ch / 2;
        left = rect.x - cw - gap;
        break;
      case 'right':
        top = rect.y + rect.h / 2 - ch / 2;
        left = rect.x + rect.w + gap;
        break;
    }

    left = Math.max(12, Math.min(left, vw - cw - 12));
    top = Math.max(12, Math.min(top, vh - ch - 12));

    setPos({ top, left });
  }, [rect, step.placement]);

  const progress = ((stepIndex + 1) / total) * 100;

  return (
    <div
      ref={ref}
      className={`absolute z-10 w-[calc(100%-1.5rem)] max-w-sm transition-all duration-300 ${
        animating ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
      }`}
      style={pos}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="h-1 bg-slate-100">
          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              {step.icon}
            </div>
            <h3 className="text-base font-black text-slate-900 leading-tight">{step.title}</h3>
          </div>

          <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line ml-[52px] mb-4">{step.body}</p>

          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onBack(); }}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              >
                戻る
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                step.waitForClick
                  ? 'bg-amber-500 hover:bg-amber-600 text-white animate-bounce-gentle'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {step.waitForClick && <MousePointer2 className="w-4 h-4" />}
              {step.cta || '次へ'}
              {!step.waitForClick && stepIndex < total - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-3">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === stepIndex ? 'w-5 bg-blue-500'
                    : i < stepIndex ? 'w-1.5 bg-blue-300'
                    : 'w-1.5 bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {rect && step.placement === 'above' && (
        <div className="flex justify-center -mt-1">
          <ArrowDown className="w-5 h-5 text-blue-400 animate-bounce" />
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onSkip(); }}
        className="block mx-auto mt-2 text-[11px] font-bold text-white/60 hover:text-white/90 transition-colors"
      >
        スキップ
      </button>
    </div>
  );
};

// ─── Main component ───

interface TutorialOverlayProps {
  onComplete: () => void;
  isDev?: boolean;
  onRequestSwitchMode?: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onComplete, isDev, onRequestSwitchMode }) => {
  const [step, setStep] = useState(0);
  const [anim, setAnim] = useState(false);
  const [visible, setVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const measureTarget = useCallback(() => {
    if (!current.target) { setTargetRect(null); return; }
    const el = document.querySelector(`[data-tour="${current.target}"]`);
    if (!el) { setTargetRect(null); return; }
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const radius = parseFloat(style.borderRadius) || 8;
    setTargetRect({ x: r.left, y: r.top, w: r.width, h: r.height, r: radius });
  }, [current.target]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    measureTarget();
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    return () => {
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [measureTarget]);

  useEffect(() => {
    if (!current.waitForClick || !current.target) return;
    const el = document.querySelector(`[data-tour="${current.target}"]`);
    if (!el) return;

    const handler = () => {
      if (current.id === 'mode-switch' && onRequestSwitchMode) {
        onRequestSwitchMode();
      }
      setTimeout(() => advance(), 400);
    };

    el.addEventListener('click', handler, { once: true });
    return () => el.removeEventListener('click', handler);
  }, [step, current.waitForClick, current.target]);

  const advance = useCallback(() => {
    if (anim) return;
    if (isLast) {
      setVisible(false);
      setTimeout(onComplete, 300);
      return;
    }
    setAnim(true);
    setTimeout(() => {
      setStep(s => s + 1);
      setAnim(false);
    }, 250);
  }, [anim, isLast, onComplete]);

  const goBack = useCallback(() => {
    if (anim || step === 0) return;
    setAnim(true);
    setTimeout(() => {
      setStep(s => s - 1);
      setAnim(false);
    }, 250);
  }, [anim, step]);

  const skip = useCallback(() => {
    setVisible(false);
    setTimeout(onComplete, 300);
  }, [onComplete]);

  const handleBackdropClick = () => {
    if (current.waitForClick) return;
    advance();
  };

  return (
    <div
      className={`fixed inset-0 z-[100] transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ pointerEvents: visible ? 'auto' : 'none' }}
    >
      <div
        className="absolute inset-0"
        onClick={handleBackdropClick}
        style={{ zIndex: 0 }}
      >
        <SpotlightMask rect={targetRect} pulse={current.waitForClick} />
      </div>

      {current.waitForClick && targetRect && (
        <div
          className="absolute"
          style={{
            left: targetRect.x - 6,
            top: targetRect.y - 6,
            width: targetRect.w + 12,
            height: targetRect.h + 12,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />
      )}

      <div style={{ zIndex: 10, position: 'relative' }}>
        <Tooltip
          step={current}
          rect={targetRect}
          stepIndex={step}
          total={STEPS.length}
          onNext={current.waitForClick ? () => {
            if (current.id === 'mode-switch' && onRequestSwitchMode) {
              onRequestSwitchMode();
            }
            setTimeout(() => advance(), 400);
          } : advance}
          onSkip={skip}
          onBack={goBack}
          animating={anim}
        />
      </div>

      <style>{`
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-gentle { animation: bounce-gentle 1.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default TutorialOverlay;
