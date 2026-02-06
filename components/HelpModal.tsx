
import React from 'react';
import { X, Sparkles, FileArchive, Code2, Download, MousePointer2, Zap, MessageSquare, Lightbulb, ArrowRight } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
  onTryPrompt: (prompt: string) => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose, onTryPrompt }) => {
  const examples = [
    { title: 'システム構成', prompt: 'AWSを使ったスケーラブルなWebアプリの構成図', icon: <Zap className="w-4 h-4 text-amber-500" /> },
    { title: 'スケジュール', prompt: '3ヶ月の開発ロードマップ。1月：設計、2月：実装、3月：テスト', icon: <Zap className="w-4 h-4 text-blue-500" /> },
    { title: 'マインドマップ', prompt: '新サービス「AI旅行ガイド」のアイデア出し。ターゲット、機能、競合', icon: <Zap className="w-4 h-4 text-purple-500" /> },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-3xl bg-white rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-none">Archy 使い方ガイド</h2>
              <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">AI Diagram Assistant</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-10 scrollbar-hide">
          {/* Section 1: Basic Usage */}
          <section>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> 基本的な使い方
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <p className="text-sm font-bold text-slate-700 mb-2">1. 入力して生成</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  下の入力欄に作りたい図の内容を入力してください。日本語で「〜の構成図」や「〜の流れ」と書くだけでAIが最適な図を作成します。
                </p>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <p className="text-sm font-bold text-slate-700 mb-2">2. 表示 / 編集を切替</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  生成後は「表示」でMermaid図を確認できます。「編集」に切替えるとブロックを直接操作して調整できます。
                </p>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <p className="text-sm font-bold text-slate-700 mb-2">3. 追加指示で調整</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  「DBを追加して」「全体を横向きにして」など、短い指示を重ねて整えられます。
                </p>
              </div>
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <p className="text-sm font-bold text-slate-700 mb-2">4. PNGで保存</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  保存ボタンでPNG画像としてダウンロードできます。高解像度・他形式はProで対応予定です。
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Features */}
          <section>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" /> 高度な機能
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">プロジェクト解析 (ZIP/ドキュメント)</p>
                  <p className="text-xs text-slate-500 mt-1">
                    ZIPファイルやドキュメントをアップロードすると、AIが中身をスキャンして全体のアーキテクチャやドキュメント構造を自動で図解します。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">スマート・エディタ</p>
                  <p className="text-xs text-slate-500 mt-1">
                    右側のエディタで直接コード（Mermaid記法）を編集できます。AIが文脈を読み取り、ノード名やキーワードを補完（Autocomplete）します。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">エクスポートと操作</p>
                  <p className="text-xs text-slate-500 mt-1">
                    完成した図はPNGで保存可能。プレビューエリアでは拡大・縮小・パン操作ができます。
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Try it */}
          <section>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <MousePointer2 className="w-4 h-4" /> 試してみる
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {examples.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { onTryPrompt(ex.prompt); onClose(); }}
                  className="flex flex-col items-start p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-400 hover:shadow-lg hover:shadow-blue-50 transition-all text-left group"
                >
                  <div className="mb-3">{ex.icon}</div>
                  <p className="text-xs font-black text-slate-900 mb-1">{ex.title}</p>
                  <p className="text-[10px] text-slate-400 leading-tight group-hover:text-blue-600 flex items-center gap-1">
                    このプロンプトを使う <ArrowRight className="w-2 h-2" />
                  </p>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
          <p className="text-xs text-slate-400 font-medium">
            ヒント: エディタで <b>Tab</b> または <b>Enter</b> を押すと、予測候補を確定できます。
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
