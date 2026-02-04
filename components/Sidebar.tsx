
import React from 'react';
import { History, Layout, Plus, Trash2, Github, Server, Cloud, GitBranch, Database, UserCheck, Box, Workflow, FileEdit, X, BrainCircuit, Calendar, Clock, Milestone, HelpCircle, Sparkles } from 'lucide-react';
import { DiagramHistory, DiagramTemplate } from '../types';
import { DIAGRAM_TEMPLATES } from '../constants';

const IconMap: Record<string, any> = {
  Layout, Server, Cloud, GitBranch, Database, UserCheck, Box, Workflow, BrainCircuit, Calendar, Clock, Milestone
};

interface SidebarProps {
  history: DiagramHistory[];
  onSelectHistory: (item: DiagramHistory) => void;
  onSelectTemplate: (template: DiagramTemplate) => void;
  onClearHistory: () => void;
  onNew: () => void;
  onNewBlank: () => void;
  onShowHelp: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  history, 
  onSelectHistory, 
  onSelectTemplate, 
  onClearHistory,
  onNew,
  onNewBlank,
  onShowHelp,
  isOpen,
  onClose
}) => {
  return (
    <>
      {/* モバイル用背景オーバーレイ */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden" 
          onClick={onClose}
        />
      )}

      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            Archy
          </h1>
          <div className="flex gap-1">
            <button 
              onClick={onNew}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-blue-600"
              title="トップに戻る"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* 新規作成ボタン */}
          <div className="p-4 space-y-2">
            <button
              onClick={() => { onNewBlank(); onClose?.(); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded-xl text-sm font-bold text-slate-500 transition-all group"
            >
              <FileEdit className="w-4 h-4 group-hover:scale-110 transition-transform" />
              白紙から自分で作る
            </button>
          </div>

          {/* テンプレートセクション */}
          <div className="p-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">AI テンプレート</h2>
            <div className="grid grid-cols-1 gap-1">
              {DIAGRAM_TEMPLATES.map((tpl) => {
                const IconComponent = IconMap[tpl.icon] || Layout;
                return (
                  <button
                    key={tpl.name}
                    onClick={() => { onSelectTemplate(tpl); onClose?.(); }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg flex items-center gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-md bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 flex items-center justify-center transition-colors">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="font-medium">{tpl.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 履歴セクション */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">最近の作成</h2>
              {history.length > 0 && (
                <button 
                  onClick={onClearHistory}
                  className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  クリア
                </button>
              )}
            </div>
            
            <div className="space-y-1">
              {history.length === 0 ? (
                <p className="text-sm text-slate-400 italic px-2">履歴はありません</p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { onSelectHistory(item); onClose?.(); }}
                    className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-3 group transition-colors truncate"
                  >
                    <History className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                    <div className="flex flex-col truncate">
                      <span className="truncate font-medium">{item.title}</span>
                      <span className="text-[10px] text-slate-400">{item.versions.length} バージョン</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-1">
          <div className="px-3 py-2 text-[10px] text-slate-400 font-medium uppercase tracking-widest mb-1">Architecture Diagram Assistant</div>
          <button 
            onClick={onShowHelp}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all font-medium"
          >
            <HelpCircle className="w-4 h-4" />
            使い方ガイド
          </button>
          <a 
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHubで見る
          </a>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
