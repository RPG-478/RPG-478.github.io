import React, { useState } from 'react';
import { Sparkles, Heart, Code2, ArrowRight, Smartphone, Palette, Zap, Terminal, GitBranch, Braces } from 'lucide-react';

export type UserMode = 'beginner' | 'developer';

interface ModeSelectProps {
  onSelect: (mode: UserMode) => void;
}

const ModeSelect: React.FC<ModeSelectProps> = ({ onSelect }) => {
  const [hoveredMode, setHoveredMode] = useState<UserMode | null>(null);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-blue-50 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-40 float-slow" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-purple-100 rounded-full blur-3xl opacity-30 float-slower" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-50 rounded-full blur-3xl opacity-30" />
      </div>

      <div className="relative z-10 w-full max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-blue-600 text-white rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-blue-200 float-gentle">
            <Sparkles className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 mb-3 tracking-tight">
            Archy へようこそ！
          </h1>
          <p className="text-sm sm:text-lg text-slate-500 font-medium">
            あなたに合ったモードを選んでください
          </p>
        </div>

        {/* Mode Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Beginner Card */}
          <button
            onClick={() => onSelect('beginner')}
            onMouseEnter={() => setHoveredMode('beginner')}
            onMouseLeave={() => setHoveredMode(null)}
            className={`group relative bg-white rounded-3xl p-6 sm:p-8 text-left transition-all duration-300 border-2 overflow-hidden
              ${hoveredMode === 'beginner'
                ? 'border-blue-400 shadow-2xl shadow-blue-100 scale-[1.02]'
                : 'border-slate-200 shadow-lg hover:shadow-xl'
              }`}
          >
            {/* Cute gradient bg */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100 via-slate-50 to-transparent rounded-bl-full opacity-60 transition-opacity group-hover:opacity-100" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <Heart className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">はじめての方</h2>
                  <p className="text-xs text-blue-500 font-bold">かんたんモード</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-5 leading-relaxed">
                やさしいガイド付きで、<strong className="text-blue-600">誰でもかんたん</strong>に図が作れます。
                むずかしいコードは一切不要！
              </p>

              <div className="space-y-2.5 mb-6">
                <div className="flex items-center gap-2.5 text-xs text-slate-500">
                  <Palette className="w-4 h-4 text-blue-400" />
                  <span>やさしい色合いのデザイン</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-500">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                  <span>スマホでもサクサク使える</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-500">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>テンプレートからワンタップ作成</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-black text-blue-500 group-hover:text-blue-600 transition-colors">
                このモードで始める <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          {/* Developer Card */}
          <button
            onClick={() => onSelect('developer')}
            onMouseEnter={() => setHoveredMode('developer')}
            onMouseLeave={() => setHoveredMode(null)}
            className={`group relative rounded-3xl p-6 sm:p-8 text-left transition-all duration-300 border-2 overflow-hidden
              ${hoveredMode === 'developer'
                ? 'bg-slate-900 border-emerald-500 shadow-2xl shadow-emerald-900/30 scale-[1.02]'
                : 'bg-slate-900 border-slate-700 shadow-lg hover:shadow-xl'
              }`}
          >
            {/* Grid/matrix bg */}
            <div className="absolute inset-0 opacity-10">
              <div className="dev-grid-bg w-full h-full" />
            </div>
            {/* Glow effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/20 via-cyan-500/10 to-transparent rounded-bl-full" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-900/40">
                  <Terminal className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white">開発者ですか？</h2>
                  <p className="text-xs text-emerald-400 font-bold font-mono">developer mode</p>
                </div>
              </div>

              <p className="text-sm text-slate-400 mb-5 leading-relaxed">
                <span className="text-emerald-400 font-mono">Mermaid</span> コードを直接編集。
                ターミナル風UIでガリガリ書ける。
              </p>

              <div className="space-y-2.5 mb-6">
                <div className="flex items-center gap-2.5 text-xs text-slate-500">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-slate-400">ダークテーマのコードエディタ</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-500">
                  <GitBranch className="w-4 h-4 text-cyan-400" />
                  <span className="text-slate-400">バージョン管理 & 差分表示</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-slate-500">
                  <Braces className="w-4 h-4 text-yellow-400" />
                  <span className="text-slate-400">オートコンプリート & スニペット</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm font-black text-emerald-400 group-hover:text-emerald-300 transition-colors font-mono">
                $ start --mode=dev <span className="animate-pulse">▊</span>
              </div>
            </div>
          </button>
        </div>

        {/* Hint */}
        <p className="text-center text-xs text-slate-400">
          あとからいつでも切り替えられます
        </p>
      </div>
    </div>
  );
};

export default ModeSelect;
