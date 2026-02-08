import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, Send, Download, Share2, Menu, Zap, Code2, X, Check, ChevronRight } from 'lucide-react';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  highlight?: string; // CSS selector or area name
  position: 'center' | 'top' | 'bottom' | 'left' | 'right';
  icon: React.ReactNode;
  action?: string; // label for the interactive action
}

const STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Archyへようこそ！🎉',
    description: 'AIで図解をかんたんに作れるアプリです。\n使い方を30秒で紹介します。',
    position: 'center',
    icon: <Sparkles className="w-8 h-8 text-blue-500" />,
  },
  {
    id: 'prompt',
    title: '① テキストを入力',
    description: '画面下のバーに「ログイン画面の流れ」のように、作りたい図の内容を入力します。',
    position: 'bottom',
    highlight: 'prompt-bar',
    icon: <Send className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'generate',
    title: '② 送信ボタンをタップ',
    description: 'AIが数秒で図を自動作成します。テンプレートから選ぶこともできます。',
    position: 'bottom',
    highlight: 'prompt-bar',
    icon: <Sparkles className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'diagram',
    title: '③ 図を操作',
    description: '作成された図はピンチで拡大縮小、スワイプで移動できます。',
    position: 'center',
    icon: <ArrowRight className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'actions',
    title: '④ 保存 & 共有',
    description: '図を画像で保存したり、SNSに共有できます。\n下のバーからアクセスできます。',
    position: 'bottom',
    highlight: 'bottom-bar',
    icon: <Share2 className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'modify',
    title: '⑤ 修正もかんたん',
    description: '「もっと詳しく」「色を変えて」など追加で指示すると、AIが修正してくれます。',
    position: 'center',
    icon: <Send className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'sidebar',
    title: '⑥ 履歴 & メニュー',
    description: '左上のメニューから過去の図を開いたり、テンプレートを選べます。',
    position: 'top',
    highlight: 'sidebar-btn',
    icon: <Menu className="w-6 h-6 text-blue-500" />,
  },
  {
    id: 'credits',
    title: '⑦ 無料枠について',
    description: '無料プランでは回数制限があります。毎日ログインで+5回もらえます！',
    position: 'center',
    icon: <Zap className="w-6 h-6 text-amber-500" />,
  },
  {
    id: 'devmode',
    title: '⑧ 開発者モード',
    description: 'Mermaidコードを直接編集したい方は「開発モード」に切り替えできます。',
    position: 'center',
    icon: <Code2 className="w-6 h-6 text-emerald-500" />,
  },
  {
    id: 'done',
    title: '準備完了！✨',
    description: 'さっそく図を作ってみましょう。\n下の入力バーに文章を入力して始めてください。',
    position: 'center',
    icon: <Check className="w-8 h-8 text-green-500" />,
  },
];

interface TutorialOverlayProps {
  onComplete: () => void;
  isDev?: boolean;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ onComplete, isDev }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  useEffect(() => {
    // Fade in on mount
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const goNext = () => {
    if (isAnimating) return;
    if (isLast) {
      setIsVisible(false);
      setTimeout(onComplete, 300);
      return;
    }
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev + 1);
      setIsAnimating(false);
    }, 200);
  };

  const goBack = () => {
    if (isAnimating || currentStep === 0) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(prev => prev - 1);
      setIsAnimating(false);
    }, 200);
  };

  const skip = () => {
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  // Determine card position style
  const getCardPosition = (): React.CSSProperties => {
    switch (step.position) {
      case 'top':
        return { top: '15%', left: '50%', transform: 'translateX(-50%)' };
      case 'bottom':
        return { bottom: '20%', left: '50%', transform: 'translateX(-50%)' };
      default:
        return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={goNext}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 z-10 h-1 bg-black/20">
        <div
          className="h-full bg-blue-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Skip button */}
      <button
        onClick={(e) => { e.stopPropagation(); skip(); }}
        className="absolute top-4 right-4 z-10 px-3 py-1.5 text-xs font-bold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
      >
        スキップ
      </button>

      {/* Step counter */}
      <div className="absolute top-4 left-4 z-10 text-xs font-bold text-white/50">
        {currentStep + 1} / {STEPS.length}
      </div>

      {/* Card */}
      <div
        className={`absolute z-10 w-[calc(100%-2rem)] max-w-sm transition-all duration-200 ${
          isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        style={getCardPosition()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`rounded-3xl p-6 shadow-2xl border ${
          isDev
            ? 'bg-[#161b22] border-[#30363d] text-slate-200'
            : 'bg-white border-slate-200 text-slate-800'
        }`}>
          {/* Icon */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto ${
            isDev ? 'bg-[#0d1117]' : 'bg-blue-50'
          }`}>
            {step.icon}
          </div>

          {/* Title */}
          <h3 className={`text-lg font-black text-center mb-2 ${
            isDev ? 'text-white' : 'text-slate-900'
          }`}>
            {step.title}
          </h3>

          {/* Description */}
          <p className={`text-sm text-center leading-relaxed whitespace-pre-line mb-6 ${
            isDev ? 'text-slate-400' : 'text-slate-500'
          }`}>
            {step.description}
          </p>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); goBack(); }}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  isDev
                    ? 'bg-[#0d1117] text-slate-400 hover:text-white'
                    : 'bg-slate-100 text-slate-500 hover:text-slate-700'
                }`}
              >
                戻る
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-1.5 transition-colors ${
                isDev
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLast ? '始める！' : '次へ'}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? `w-6 ${isDev ? 'bg-emerald-400' : 'bg-blue-500'}`
                    : i < currentStep
                      ? `w-1.5 ${isDev ? 'bg-emerald-600' : 'bg-blue-300'}`
                      : `w-1.5 ${isDev ? 'bg-slate-600' : 'bg-slate-200'}`
                }`}
              />
            ))}
          </div>
        </div>

        {/* Tap hint */}
        <p className={`text-center text-[10px] font-bold mt-3 ${
          isDev ? 'text-slate-500' : 'text-white/50'
        }`}>
          画面タップでも進めます
        </p>
      </div>
    </div>
  );
};

export default TutorialOverlay;
