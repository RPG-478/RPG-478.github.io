
import React from 'react';
import { History, Layout, Plus, Trash2, Github, Server, Cloud, GitBranch, Database, UserCheck, Box, Workflow, FileEdit, X, BrainCircuit, Calendar, Clock, Milestone, HelpCircle, Sparkles, Terminal, Code2, Users } from 'lucide-react';
import { DiagramHistory, DiagramTemplate } from '../types';
import { DIAGRAM_TEMPLATES, BEGINNER_TEMPLATES } from '../constants';
import type { UserMode } from './ModeSelect';

const IconMap: Record<string, any> = {
  Layout, Server, Cloud, GitBranch, Database, UserCheck, Box, Workflow, BrainCircuit, Calendar, Clock, Milestone, Users
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
  userMode?: UserMode;
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
  onClose,
  userMode = 'beginner'
}) => {
  const isDev = userMode === 'developer';
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
        fixed inset-y-0 left-0 z-50 w-80 flex flex-col transition-transform duration-300 md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isDev 
          ? 'bg-[#0d1117] border-r border-[#30363d]' 
          : 'bg-white border-r border-slate-200'}
      `}>
        {/* ヘッダー */}
        <div className={`p-6 border-b flex items-center justify-between ${
          isDev ? 'border-[#30363d]' : 'border-slate-100'
        }`}>
          <h1 className={`text-xl font-bold flex items-center gap-2 ${
            isDev ? 'text-slate-200 font-mono' : 'text-slate-900'
          }`}>
            {isDev 
              ? <><Terminal className="w-5 h-5 text-emerald-400" /><span className="text-emerald-400">$</span> archy</>
              : <><Sparkles className="w-6 h-6 text-blue-500" /> Archy</>
            }
          </h1>
          <div className="flex gap-1">
            <button 
              onClick={onNew}
              className={`p-2 rounded-lg transition-colors ${
                isDev ? 'hover:bg-[#1c2128] text-slate-500 hover:text-emerald-400' : 'hover:bg-slate-100 text-slate-400 hover:text-blue-500'
              }`}
              title="トップに戻る"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button 
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors md:hidden ${
                isDev ? 'hover:bg-[#1c2128] text-slate-500' : 'hover:bg-slate-100 text-slate-400'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {/* 新規作成ボタン */}
          <div className="p-4 space-y-2">
            {isDev ? (
              <button
                onClick={() => { onNewBlank(); onClose?.(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#161b22] border-2 border-dashed border-[#30363d] hover:border-emerald-500 hover:text-emerald-400 rounded-xl text-sm font-bold text-slate-500 transition-all group font-mono"
              >
                <FileEdit className="w-4 h-4 group-hover:scale-110 transition-transform" />
                New blank diagram
              </button>
            ) : (
              <button
                onClick={() => { onNewBlank(); onClose?.(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-slate-200 hover:border-blue-400 hover:text-blue-600 rounded-xl text-sm font-bold text-slate-500 transition-all group"
              >
                <FileEdit className="w-4 h-4 group-hover:scale-110 transition-transform" />
                白紙から自分で作る
              </button>
            )}
          </div>

          {/* テンプレートセクション */}
          <div className="p-4">
            <h2 className={`text-xs font-semibold uppercase tracking-wider mb-3 px-2 ${
              isDev ? 'text-slate-600 font-mono' : 'text-slate-400'
            }`}>
              {isDev ? 'Templates' : 'AI テンプレート'}
            </h2>
            <div className="grid grid-cols-1 gap-1">
              {(isDev ? DIAGRAM_TEMPLATES : BEGINNER_TEMPLATES).map((tpl) => {
                const IconComponent = IconMap[tpl.icon] || Layout;
                return (
                  <button
                    key={tpl.name}
                    onClick={() => { onSelectTemplate(tpl); onClose?.(); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 transition-colors group ${
                      isDev
                        ? 'text-slate-400 hover:bg-[#161b22] hover:text-emerald-400'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                      isDev
                        ? 'bg-[#161b22] text-slate-500 group-hover:bg-emerald-900/30 group-hover:text-emerald-400'
                        : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'
                    }`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className={`font-medium ${isDev ? 'font-mono text-xs' : ''}`}>{tpl.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 履歴セクション */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className={`text-xs font-semibold uppercase tracking-wider ${
                isDev ? 'text-slate-600 font-mono' : 'text-slate-400'
              }`}>
                {isDev ? 'Recent' : '最近の作成'}
              </h2>
              {history.length > 0 && (
                <button 
                  onClick={onClearHistory}
                  className={`text-xs flex items-center gap-1 transition-colors ${
                    isDev ? 'text-slate-600 hover:text-red-400' : 'text-slate-400 hover:text-red-500'
                  }`}
                >
                  <Trash2 className="w-3 h-3" />
                  {isDev ? 'Clear' : 'クリア'}
                </button>
              )}
            </div>
            
            <div className="space-y-1">
              {history.length === 0 ? (
                <p className={`text-sm italic px-2 ${isDev ? 'text-slate-600 font-mono' : 'text-slate-400'}`}>
                  {isDev ? 'No history yet' : '履歴はありません'}
                </p>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { onSelectHistory(item); onClose?.(); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-3 group transition-colors truncate ${
                      isDev
                        ? 'text-slate-400 hover:bg-[#161b22] hover:text-emerald-400'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <History className={`w-4 h-4 ${isDev ? 'text-slate-600 group-hover:text-emerald-400' : 'text-slate-400 group-hover:text-blue-500'}`} />
                    <div className="flex flex-col truncate">
                      <span className={`truncate font-medium ${isDev ? 'font-mono text-xs' : ''}`}>{item.title}</span>
                      <span className={`text-[10px] ${isDev ? 'text-slate-600' : 'text-slate-400'}`}>
                        {item.versions.length} {isDev ? 'commits' : 'バージョン'}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className={`p-4 border-t space-y-1 ${
          isDev ? 'border-[#30363d] bg-[#0d1117]' : 'border-slate-100 bg-slate-50/50'
        }`}>
          <div className={`px-3 py-2 text-[10px] font-medium uppercase tracking-widest mb-1 ${
            isDev ? 'text-slate-600 font-mono' : 'text-slate-400'
          }`}>
            {isDev ? 'Archy // Diagram Assistant' : 'Architecture Diagram Assistant'}
          </div>
          <button 
            onClick={onShowHelp}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all font-medium ${
              isDev
                ? 'text-slate-500 hover:text-emerald-400 hover:bg-[#161b22]'
                : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            {isDev ? 'Help' : '使い方ガイド'}
          </button>
          <a 
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
              isDev ? 'text-slate-500 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Github className="w-4 h-4" />
            {isDev ? 'GitHub' : 'GitHubで見る'}
          </a>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
