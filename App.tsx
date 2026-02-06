import React, { useState, useCallback, useEffect, useRef, useTransition } from 'react';
import { Send, Download, Copy, RefreshCw, Edit2, Check, Share2, AlertCircle, Layout, Workflow, Code2, Trash2, HelpCircle, Menu, X, ArrowLeft, ArrowDownRight, ArrowRight, Zap, Sparkles, Box, Type, Paperclip, FileText, FileArchive, Loader2, BrainCircuit, Calendar, Clock, History as HistoryIcon, Save, RotateCcw } from 'lucide-react';
import { generateDiagramCodeStream } from './services/gemini';
import { supabase } from './services/supabase';
import type { Session } from '@supabase/supabase-js';
import { AppState, DiagramHistory, DiagramVersion, DiagramTemplate } from './types';
import { SNIPPETS } from './constants';
import MermaidRenderer from './components/MermaidRenderer';
import Sidebar from './components/Sidebar';
import HelpModal from './components/HelpModal';
import JSZip from 'jszip';

const MERMAID_KEYWORDS = [
  'graph', 'TD', 'LR', 'BT', 'RL', 'subgraph', 'end', 'style', 'classDef', 'class', 'click',
  'sequenceDiagram', 'participant', 'actor', 'note right of', 'note left of', 'note over',
  'loop', 'alt', 'else', 'opt', 'rect', 'critical', 'break', 'par', 'and',
  'gantt', 'title', 'dateFormat', 'section', 'classDiagram', 'erDiagram', 'journey', 'pie', 'mindmap', 'timeline'
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [appState, setAppState] = useState<AppState>('idle');
  const [history, setHistory] = useState<DiagramHistory[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'versions'>('edit');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ plan: string; free_quota_remaining: number | null } | null>(null);
  const [authReady, setAuthReady] = useState(false);

  // File Upload State
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Force remove static loader once App is mounted and rendered
    const loader = document.getElementById('startup-screen');
    if (loader) {
      loader.classList.add('hidden');
      setTimeout(() => {
        if (loader.parentNode) loader.remove();
      }, 500);
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
      if (data.session?.user?.id) {
        fetchProfile(data.session.user.id);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthReady(true);
      if (newSession?.user?.id) {
        fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    const saved = localStorage.getItem('archy-history-v2');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('plan, free_quota_remaining')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('Failed to load profile', error.message);
      setProfile(null);
      return;
    }

    setProfile({
      plan: data?.plan || 'free',
      free_quota_remaining: data?.free_quota_remaining ?? null
    });
  };

  useEffect(() => {
    localStorage.setItem('archy-history-v2', JSON.stringify(history));
  }, [history]);

  const handleGenerate = async (targetPrompt?: string) => {
    const finalPrompt = targetPrompt || prompt;
    if (!finalPrompt.trim() && !attachedFile) return;

    if (!session) {
      setErrorMessage('生成するにはログインが必要です。');
      return;
    }

    setAppState('generating');
    setErrorMessage('');
    
    if (window.innerWidth > 768) {
      setShowEditor(true);
      setActiveTab('edit');
    }
    
    try {
      let combinedPrompt = finalPrompt;
      if (attachedFile) {
        combinedPrompt = `File Analysis (${attachedFile.name}):\n${attachedFile.content.substring(0, 15000)}\n\nUser Request: ${finalPrompt || 'Visualize the core structure'}`;
      }

      const stream = generateDiagramCodeStream(combinedPrompt, currentCode, session?.access_token);
      let lastCode = currentCode;

      for await (const partialCode of stream) {
        if (partialCode.text) {
          setCurrentCode(partialCode.text);
          lastCode = partialCode.text;
        }
        if (typeof partialCode.remaining === 'number') {
          setProfile(prev => prev ? { ...prev, free_quota_remaining: partialCode.remaining } : prev);
        }
        if (partialCode.plan) {
          setProfile(prev => prev ? { ...prev, plan: partialCode.plan } : prev);
        }
      }
      
      const newVersion: DiagramVersion = {
        id: Math.random().toString(36).substr(2, 9),
        code: lastCode,
        prompt: combinedPrompt,
        timestamp: Date.now(),
      };

      if (activeId) {
        setHistory(prev => prev.map(h => 
          h.id === activeId 
            ? { ...h, versions: [newVersion, ...h.versions], timestamp: Date.now() } 
            : h
        ));
      } else {
        const titleLabel = attachedFile ? `分析: ${attachedFile.name}` : (finalPrompt.length > 30 ? finalPrompt.substring(0, 30) + '...' : finalPrompt);
        const newEntry: DiagramHistory = {
          id: Math.random().toString(36).substr(2, 9),
          title: titleLabel,
          versions: [newVersion],
          timestamp: Date.now(),
        };
        setHistory(prev => [newEntry, ...prev].slice(0, 50));
        setActiveId(newEntry.id);
      }
      
      setAppState('idle');
      setPrompt('');
      setAttachedFile(null);
    } catch (err: any) {
      setAppState('error');
      setErrorMessage(err.message || 'エラーが発生しました');
    }
  };

  const saveManualSnapshot = () => {
    if (!activeId) return;
    const newVersion: DiagramVersion = {
      id: Math.random().toString(36).substr(2, 9),
      code: currentCode,
      prompt: 'Manual Edit',
      timestamp: Date.now(),
    };
    setHistory(prev => prev.map(h => 
      h.id === activeId 
        ? { ...h, versions: [newVersion, ...h.versions], timestamp: Date.now() } 
        : h
    ));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileLoading(true);
    setErrorMessage('');

    try {
      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        let combinedContent = "";
        let fileCount = 0;

        const promises: Promise<void>[] = [];
        zip.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir && fileCount < 20) {
            const isTarget = /\.(js|ts|tsx|py|java|go|md)$/i.test(relativePath);
            const isIgnored = /(node_modules|dist|build|target|\.git|\.next|package-lock|yarn\.lock)/.test(relativePath);
            
            if (isTarget && !isIgnored) {
              fileCount++;
              promises.push(zipEntry.async('string').then(content => {
                combinedContent += `File: ${relativePath}\n${content.substring(0, 1000)}\n\n`;
              }));
            }
          }
        });

        await Promise.all(promises);
        setAttachedFile({ name: file.name, content: combinedContent });
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          setAttachedFile({ 
            name: file.name, 
            content: (event.target?.result as string).substring(0, 15000) 
          });
        };
        reader.readAsText(file);
      }
    } catch (err) {
      setErrorMessage("ファイルの読み込みに失敗しました。");
    } finally {
      setIsFileLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleLayoutOrientation = () => {
    if (!currentCode) return;
    let newCode = currentCode;
    if (currentCode.includes('graph TD')) {
      newCode = currentCode.replace('graph TD', 'graph LR');
    } else if (currentCode.includes('graph LR')) {
      newCode = currentCode.replace('graph LR', 'graph TD');
    } else {
      newCode = 'graph LR\n' + currentCode;
    }
    setCurrentCode(newCode);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCurrentCode(val);
    
    const selectionStart = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, selectionStart);
    const words = textBeforeCursor.split(/[\s\n\-\->]+/);
    const currentWord = words[words.length - 1];

    if (currentWord.length > 0) {
      const matches = val.match(/([a-zA-Z0-9_-]+)(?:\[|\(|\{|\(\()|([a-zA-Z0-9_-]+)(?=\s+-->|-->|\s+==>|==>)/g) || [];
      const existingNodes = Array.from(new Set(matches))
        .map((n: string) => n.replace(/[\[\(\{\s-].*$/, ''))
        .filter(n => !MERMAID_KEYWORDS.includes(n));
        
      const allSuggestions = Array.from(new Set([...MERMAID_KEYWORDS, ...existingNodes]));
      const filtered = allSuggestions.filter(s => s.toLowerCase().startsWith(currentWord.toLowerCase()) && s !== currentWord);
      
      if (filtered.length > 0) {
        setSuggestions(filtered);
        setSuggestionIndex(0);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(suggestions[suggestionIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    }
  };

  const insertSuggestion = (suggestion: string) => {
    if (!textareaRef.current) return;
    const val = currentCode;
    const start = textareaRef.current.selectionStart;
    const textBefore = val.substring(0, start);
    const textAfter = val.substring(start);
    
    const words = textBefore.split(/([\s\n\-\->]+)/);
    words[words.length - 1] = suggestion;
    const newTextBefore = words.join('');
    
    setCurrentCode(newTextBefore + textAfter);
    setShowSuggestions(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = newTextBefore.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleSelectHistory = (item: DiagramHistory) => {
    const latest = item.versions[0];
    setCurrentCode(latest.code);
    setActiveId(item.id);
    setShowEditor(window.innerWidth > 768);
    setActiveTab('edit');
  };

  const handleRevertVersion = (version: DiagramVersion) => {
    setCurrentCode(version.code);
    setActiveTab('edit');
  };

  const handleSelectTemplate = (template: DiagramTemplate) => {
    setPrompt(template.prompt);
    handleGenerate(template.prompt);
  };

  const handleNewBlank = () => {
    setCurrentCode('graph TD\n  開始 --> 終了');
    setActiveId(null);
    setAppState('idle');
    setShowEditor(true);
    setActiveTab('edit');
  };

  const handleNew = () => {
    setPrompt('');
    setCurrentCode('');
    setAttachedFile(null);
    setActiveId(null);
    setAppState('idle');
    setShowEditor(false);
  };

  const insertSnippet = (snippet: typeof SNIPPETS[0]) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = textareaRef.current.value;
    const finalSnippet = snippet.code;
    const newText = text.substring(0, start) + finalSnippet + text.substring(end);
    setCurrentCode(newText);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + finalSnippet.length, start + finalSnippet.length);
      }
    }, 0);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentCode);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleDownloadSVG = () => {
    const svgElement = document.querySelector('.mermaid svg');
    if (!svgElement) return;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeProject = history.find(h => h.id === activeId);

  if (!authReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex items-center gap-3 text-sm font-bold">
          <Loader2 className="w-5 h-5 animate-spin" /> 読み込み中...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-900">
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Sparkles className="w-5 h-5 text-blue-600" /> Archy
          </div>
          <button
            onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
            className="px-3 py-2 text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            Googleでログイン
          </button>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <div className="w-16 h-16 mx-auto bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="mt-6 text-3xl sm:text-4xl font-black text-slate-900">
              プロンプトだけで、図解を一気に。
            </h1>
            <p className="mt-4 text-slate-500 font-medium">
              アーキテクチャ図・フロー・ガント・マインドマップを即生成。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="text-blue-600 mb-3"><Workflow className="w-6 h-6" /></div>
              <h3 className="font-bold text-slate-800">テンプレートで即作成</h3>
              <p className="text-sm text-slate-500 mt-2">よくある構成図をワンクリックで開始。</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="text-blue-600 mb-3"><FileArchive className="w-6 h-6" /></div>
              <h3 className="font-bold text-slate-800">ZIP/ドキュメント解析</h3>
              <p className="text-sm text-slate-500 mt-2">プロジェクトの構造を自動で可視化。</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="text-blue-600 mb-3"><Code2 className="w-6 h-6" /></div>
              <h3 className="font-bold text-slate-800">編集と書き出し</h3>
              <p className="text-sm text-slate-500 mt-2">Mermaid を直接編集・SVG保存。</p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <button
              onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-lg shadow-blue-200"
            >
              Googleでログインして始める
            </button>
            <p className="mt-3 text-xs text-slate-400">無料枠内で試せます。上限に達したら停止します。</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden selection:bg-blue-100 font-sans">
      <Sidebar 
        history={history}
        onSelectHistory={handleSelectHistory}
        onSelectTemplate={handleSelectTemplate}
        onClearHistory={() => setHistory([])}
        onNew={handleNew}
        onNewBlank={handleNewBlank}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onShowHelp={() => setShowHelp(true)}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 md:hidden"><Menu className="w-6 h-6" /></button>
            <h1 className="font-bold text-slate-700 truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[300px] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
              {activeId ? activeProject?.title : 'Archy'}
            </h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {!session && authReady && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-[10px] font-black uppercase tracking-widest mr-2">
                <AlertCircle size={12} /> Login Required
              </div>
            )}
            {session && profile && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest mr-2">
                {profile.plan === 'pro' ? 'Pro' : `Free ${profile.free_quota_remaining ?? 0}`}
              </div>
            )}
            {currentCode && (
              <>
                <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-1 mr-2">
                  <button onClick={toggleLayoutOrientation} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm transition-all">
                    <ArrowDownRight className="w-3 h-3" />向きを切替
                  </button>
                </div>
                <button onClick={() => setShowEditor(!showEditor)} className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${showEditor ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                  <Code2 className="w-4 h-4" /><span className="hidden xs:inline">エディタ</span>
                </button>
                <div className="w-px h-6 bg-slate-200 mx-0.5 sm:mx-1" />
                <button onClick={handleDownloadSVG} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="保存"><Download className="w-5 h-5" /></button>
                <button className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 active:scale-95">
                  <Share2 className="w-4 h-4" /><span className="hidden sm:inline">共有</span>
                </button>
              </>
            )}
            {authReady && (
              session ? (
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  ログアウト
                </button>
              ) : (
                <button
                  onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
                  className="px-3 py-2 text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  Googleでログイン
                </button>
              )
            )}
          </div>
        </header>

        <div className="flex-1 relative flex overflow-hidden">
          <div className={`flex-1 flex flex-col items-center justify-center transition-all duration-300 relative bg-slate-50 overflow-hidden`}>
            {appState === 'generating' && !currentCode ? (
              <div className="flex flex-col items-center gap-6 text-center p-6">
                <div className="relative">
                   <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                   <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-600 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-black text-slate-900">AIが図を作成中...</p>
                  <p className="text-sm text-slate-500">最適な構造を構築しています</p>
                </div>
              </div>
            ) : !currentCode ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                  <div className="hero-gradient absolute -top-28 -right-20 w-72 h-72 rounded-full blur-3xl opacity-70 float-slow" />
                  <div className="hero-gradient-alt absolute -bottom-32 -left-24 w-80 h-80 rounded-full blur-3xl opacity-60 float-slower" />
                  <div className="hero-dots absolute inset-0 opacity-60" />
                </div>
                <div className="text-center max-w-2xl px-6 py-12 flex flex-col items-center overflow-y-auto h-full justify-center relative z-10">
                  <div className="w-20 h-20 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center mb-10 shadow-xl shadow-blue-200 rotate-3 float-gentle">
                    <Sparkles className="w-10 h-10" />
                  </div>
                  <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-6 tracking-tight leading-tight">
                    あらゆる図解を、<br/><span className="text-blue-600">プロンプトから。</span>
                  </h2>
                  <p className="text-lg text-slate-500 mb-10 font-medium max-w-md">複雑なアーキテクチャやフローチャートも、AIが数秒で書き上げます。</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {['AWS 構成図', 'ログイン認証の流れ', '3層構造のウェブアプリ', '旅行のスケジュール表'].map(hint => (
                      <button key={hint} onClick={() => setPrompt(hint)} className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:-translate-y-0.5 transition-all shadow-sm">{hint}</button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full pattern-grid relative">
                <MermaidRenderer chart={currentCode} />
                {appState === 'generating' && (
                  <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md px-6 py-3 rounded-full shadow-xl border border-blue-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                    <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="text-sm font-black text-slate-700 tracking-tight">AIが図を構築中...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {showEditor && (
            <div className={`fixed md:relative inset-y-0 right-0 z-40 w-full md:w-[450px] bg-slate-900 flex flex-col shadow-2xl transition-transform duration-300 ${showEditor ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="p-4 border-b border-slate-800 flex flex-col gap-4 bg-slate-900 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowEditor(false)} className="p-1 hover:bg-slate-800 rounded text-slate-400 md:hidden"><ArrowLeft size={18} /></button>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Advanced Editor</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveManualSnapshot} className="p-1.5 text-slate-500 hover:text-white" title="スナップショットを保存"><Save size={14} /></button>
                    <button onClick={handleCopyCode} className="p-1.5 text-slate-500 hover:text-white">{copyFeedback ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}</button>
                  </div>
                </div>
                <div className="flex bg-slate-800 p-1 rounded-lg">
                  <button onClick={() => setActiveTab('edit')} className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 ${activeTab === 'edit' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
                    <Edit2 size={12} /> 編集
                  </button>
                  <button onClick={() => setActiveTab('versions')} className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 ${activeTab === 'versions' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>
                    <HistoryIcon size={12} /> 履歴 {activeProject?.versions.length ? `(${activeProject.versions.length})` : ''}
                  </button>
                </div>
              </div>
              
              {activeTab === 'edit' ? (
                <>
                  <div className="border-b border-slate-800 bg-slate-900 p-2 grid grid-cols-4 gap-1 shrink-0">
                    {SNIPPETS.map(snippet => (
                      <button key={snippet.id} onClick={() => insertSnippet(snippet)} className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-slate-400 transition-colors border border-transparent hover:border-slate-700">
                        {snippet.icon}<span className="text-[9px] mt-1 font-bold truncate w-full text-center">{snippet.label}</span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={currentCode}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    className="flex-1 bg-slate-900 text-blue-100 font-mono text-sm p-8 resize-none focus:outline-none"
                    placeholder="コードを直接編集できます..."
                  />
                </>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-900">
                  {activeProject?.versions.map((v, i) => (
                    <div key={v.id} className="p-4 rounded-xl border border-slate-800 bg-slate-800/40">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{i === 0 ? '最新版' : `Version ${activeProject.versions.length - i}`}</span>
                        <span className="text-[10px] text-slate-500 font-bold">{new Date(v.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium mb-3 line-clamp-2">{v.prompt}</p>
                      <button onClick={() => handleRevertVersion(v)} className="w-full py-2 bg-slate-700 hover:bg-blue-600 text-white text-[11px] font-black rounded-lg transition-all flex items-center justify-center gap-2">
                        <RotateCcw size={12} /> 戻す
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`absolute bottom-6 sm:bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 sm:px-8 z-30 transition-all ${showEditor && window.innerWidth < 768 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex flex-col gap-3">
            {attachedFile && (
              <div className="flex items-center gap-2 self-start bg-blue-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg">
                {attachedFile.name.endsWith('.zip') ? <FileArchive size={14} /> : <FileText size={14} />}
                <span>{attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} className="ml-1 hover:text-red-200"><X size={14} /></button>
              </div>
            )}
            <div className="bg-white/95 backdrop-blur-2xl rounded-2xl sm:rounded-[2.5rem] shadow-2xl border border-slate-200 p-2.5 flex items-center gap-2 group transition-all">
              <button onClick={() => fileInputRef.current?.click()} disabled={isFileLoading || appState === 'generating'} className="ml-2 p-3 text-slate-400 hover:text-blue-600">
                {isFileLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Paperclip className="w-6 h-6" />}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip,.md,.txt,.json,.js,.ts,.tsx,.py" />
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder={attachedFile ? "解析内容をどう図解しますまか？" : "作りたい図の内容を教えてください..."}
                className="flex-1 bg-transparent py-3 sm:py-5 px-2 sm:px-4 focus:outline-none text-slate-800 font-bold text-base sm:text-xl placeholder:text-slate-400"
              />
              <button onClick={() => handleGenerate()} disabled={(!prompt.trim() && !attachedFile) || appState === 'generating'} className="px-6 sm:px-10 py-3 sm:py-5 bg-blue-600 text-white rounded-xl sm:rounded-[2rem] font-black flex items-center gap-2 disabled:opacity-50">
                {appState === 'generating' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                <span className="hidden xs:inline">{currentCode ? '修正' : '作成'}</span>
              </button>
            </div>
          </div>
          {errorMessage && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-full w-fit flex items-center gap-2 shadow-xl animate-in fade-in">
              <AlertCircle size={14} /> {errorMessage}
            </div>
          )}
        </div>

        {showHelp && <HelpModal onClose={() => setShowHelp(false)} onTryPrompt={handleGenerate} />}
      </main>
    </div>
  );
};

export default App;