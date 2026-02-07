import React, { useState, useCallback, useEffect, useRef, useTransition } from 'react';
import { Send, Download, Copy, RefreshCw, Edit2, Check, Share2, AlertCircle, Layout, Workflow, Code2, Trash2, HelpCircle, Menu, X, ArrowLeft, ArrowDownRight, ArrowRight, Zap, Sparkles, Box, Type, Paperclip, FileText, FileArchive, Loader2, BrainCircuit, Calendar, Clock, History as HistoryIcon, Save, RotateCcw, Database, Milestone, Heart, ChevronUp, ChevronDown } from 'lucide-react';
import { generateDiagramCodeStream } from './services/gemini';
import { supabase } from './services/supabase';
import { claimDailyCredits } from './services/credits';
import { fetchBetaRemaining } from './services/beta';
import type { Session } from '@supabase/supabase-js';
import { AppState, DiagramHistory, DiagramVersion, DiagramTemplate, VisualDiagram } from './types';
import { SNIPPETS, DIAGRAM_TEMPLATES, BEGINNER_TEMPLATES } from './constants';
import MermaidRenderer from './components/MermaidRenderer';
import BeginnerCanvas from './components/BeginnerCanvas';
import Sidebar from './components/Sidebar';
import HelpModal from './components/HelpModal';
import FeedbackModal from './components/FeedbackModal';
import BugReportModal from './components/BugReportModal';
import ModeSelect, { UserMode } from './components/ModeSelect';
import { parseMermaidToVisual, visualToMermaid, createEmptyDiagram } from './services/mermaidBridge';
import JSZip from 'jszip';

const MERMAID_KEYWORDS = [
  'graph', 'TD', 'LR', 'BT', 'RL', 'subgraph', 'end', 'style', 'classDef', 'class', 'click',
  'sequenceDiagram', 'participant', 'actor', 'note right of', 'note left of', 'note over',
  'loop', 'alt', 'else', 'opt', 'rect', 'critical', 'break', 'par', 'and',
  'gantt', 'title', 'dateFormat', 'section', 'classDiagram', 'erDiagram', 'journey', 'pie', 'mindmap', 'timeline'
];

const PROMPT_TICKER = [
  'AWS 構成図',
  'ログイン認証の流れ',
  '3層構造のウェブアプリ',
  '旅行のスケジュール表',
  'ECの注文〜配送フロー',
  'マイクロサービス構成',
  'オンボーディング導線',
  'KPIダッシュボード構成',
  'データパイプライン',
  'SaaSの権限設計'
];

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [appState, setAppState] = useState<AppState>('idle');
  const [history, setHistory] = useState<DiagramHistory[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'edit' | 'versions'>('edit');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ plan: string; free_quota_remaining: number | null; daily_claimed_at?: string | null } | null>(null);
  const [betaStatus, setBetaStatus] = useState<{ limit: number; used: number; remaining: number } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState(0);
  const [visualDiagram, setVisualDiagram] = useState<VisualDiagram>({ nodes: [], edges: [] });
  const [beginnerView, setBeginnerView] = useState<'mermaid' | 'canvas'>('mermaid');
  const [beginnerInputCollapsed, setBeginnerInputCollapsed] = useState(false);
  const [userMode, setUserMode] = useState<UserMode | null>(() => {
    return localStorage.getItem('archy-user-mode') as UserMode | null;
  });

  // File Upload State
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Autocomplete State
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamingTimerRef = useRef<number | null>(null);
  const lastPromptRef = useRef<string>('');

  // Derived mode flags - available everywhere including handleGenerate
  const isDev = userMode === 'developer';
  const isBeginner = userMode === 'beginner';

  useEffect(() => {
    if (userMode === 'beginner') {
      setBeginnerView('mermaid');
      setBeginnerInputCollapsed(false);
    }
  }, [userMode]);

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

  useEffect(() => {
    let mounted = true;
    fetchBetaRemaining()
      .then((data) => {
        if (mounted) setBetaStatus(data);
      })
      .catch(() => {
        if (mounted) setBetaStatus(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('plan, free_quota_remaining, daily_claimed_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load profile', error.message);
      setProfile(null);
      return;
    }

    setProfile({
      plan: data?.plan || 'free',
      free_quota_remaining: data?.free_quota_remaining ?? 0,
      daily_claimed_at: data?.daily_claimed_at ?? null
    });
  };

  const isSameDay = (a?: string | null, b?: Date) => {
    if (!a || !b) return false;
    const day = new Date(a);
    return day.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  };

  const handleClaimDailyCredits = async () => {
    if (!profile || profile.plan !== 'free') return;
    setIsClaiming(true);
    try {
      const res = await claimDailyCredits();
      setProfile(prev => prev ? { ...prev, free_quota_remaining: res.remaining, daily_claimed_at: res.daily_claimed_at } : prev);
    } catch (e: any) {
      setErrorMessage(normalizeErrorMessage(e.message || 'エラーが発生しました'));
    } finally {
      setIsClaiming(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('archy-history-v2', JSON.stringify(history));
  }, [history]);

  const animateCodeReveal = (target: string) => {
    if (streamingTimerRef.current !== null) {
      window.clearInterval(streamingTimerRef.current);
      streamingTimerRef.current = null;
    }

    if (!target) {
      setCurrentCode('');
      setStreamingProgress(0);
      return Promise.resolve();
    }

    const total = target.length;
    const steps = Math.min(90, Math.max(20, Math.ceil(total / 30)));
    const chunk = Math.max(1, Math.ceil(total / steps));
    let index = 0;
    const intervalMs = total > 1200 ? 20 : 35;

    return new Promise<void>((resolve) => {
      streamingTimerRef.current = window.setInterval(() => {
        index += chunk;
        if (index >= total) {
          setCurrentCode(target);
          setStreamingProgress(100);
          if (streamingTimerRef.current !== null) {
            window.clearInterval(streamingTimerRef.current);
            streamingTimerRef.current = null;
          }
          resolve();
          return;
        }
        setCurrentCode(target.slice(0, index));
        const percent = Math.min(99, Math.round((index / total) * 100));
        setStreamingProgress(prev => Math.max(prev, percent));
      }, intervalMs);
    });
  };

  const normalizeErrorMessage = (message: string) => {
    if (message.includes('Unauthorized') || message.includes('401')) {
      return '認証が切れました。再ログインしてください。';
    }
    if (message.includes('Failed to fetch') || message.includes('CORS')) {
      return '機能が未デプロイ、またはCORS設定が未完了です。管理者に連絡してください。';
    }
    if (message.includes('Account limit reached')) {
      return 'アカウント上限に達しました。時間をおいて再度お試しください。';
    }
    if (message.includes('Daily claim already used')) {
      return '本日の無料枠は受け取り済みです。';
    }
    if (message.includes('Free quota exceeded')) {
      return '無料枠の上限に達しました。プランをご確認ください。';
    }
    return message || 'エラーが発生しました';
  };

  const handleGenerate = async (
    targetPrompt?: string,
    options?: { isAutoFix?: boolean; isFileAnalysis?: boolean }
  ) => {
    const finalPrompt = targetPrompt || prompt;
    if (!finalPrompt.trim() && !attachedFile) return;

    if (!session) {
      setErrorMessage('生成するにはログインが必要です。');
      return;
    }

    setAppState('generating');
    setErrorMessage('');
    setIsStreaming(true);
    setStreamingProgress(0);
    
    // Dev mode: always open editor panel; Beginner mode: never auto-open
    if (isDev && window.innerWidth > 768) {
      setShowEditor(true);
      setActiveTab('edit');
    }
    
    try {
      // Refresh session before API call to avoid stale token (401)
      const { data: initialSession } = await supabase.auth.getSession();
      const isExpired = initialSession.session?.expires_at
        ? initialSession.session.expires_at * 1000 < Date.now() + 60_000
        : true;

      let accessToken = initialSession.session?.access_token;

      if (!accessToken || isExpired) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        accessToken = refreshed.session?.access_token;
      }

      if (!accessToken) {
        setErrorMessage('セッションが切れました。再度ログインしてください。');
        setAppState('error');
        setIsStreaming(false);
        return;
      }

      lastPromptRef.current = finalPrompt;
      let combinedPrompt = finalPrompt;
      if (attachedFile) {
        combinedPrompt = `File Analysis (${attachedFile.name}):\n${attachedFile.content.substring(0, 15000)}\n\nUser Request: ${finalPrompt || 'Visualize the core structure'}`;
      }

      // Beginner mode: force simple graph TD flowchart only
      if (isBeginner) {
        combinedPrompt = `【最重要ルール】以下を必ず守ること：
- 必ず "graph TD" で始まるフローチャートのみ出力する
- ノードIDは A, B, C, D... のようにアルファベット1文字にする
- ノードの書式は A[ラベル] か A{ラベル} か A((ラベル)) のみ
- 接続は --> か -->|ラベル| のみ使用
- subgraph, style, classDef, class は絶対に使わない
- mindmap, sequenceDiagram, gantt, erDiagram, timeline, pie, journey は絶対に使わない
- ノードは最大12個まで
- ラベルは日本語で短く（8文字以内）

${combinedPrompt}`;
      }

      const stream = generateDiagramCodeStream(
        combinedPrompt,
        currentCode,
        accessToken,
        { ...options, isFileAnalysis: options?.isFileAnalysis ?? !!attachedFile }
      );
      let lastCode = currentCode;

      for await (const partialCode of stream) {
        if (partialCode.text) {
          await animateCodeReveal(partialCode.text);
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
      setIsStreaming(false);
      setStreamingProgress(100);
      setTimeout(() => setStreamingProgress(0), 800);
      setPrompt('');
      setAttachedFile(null);
      
      // Sync visual diagram for beginner canvas
      if (isBeginner && lastCode) {
        try {
          setVisualDiagram(parseMermaidToVisual(lastCode));
        } catch (e) {
          console.warn('Failed to parse to visual', e);
        }
      }
    } catch (err: any) {
      setAppState('error');
      setIsStreaming(false);
      setStreamingProgress(0);
      setErrorMessage(normalizeErrorMessage(err.message || 'エラーが発生しました'));
    }
  };

  const handleRetryLast = () => {
    if (!lastPromptRef.current) return;
    handleGenerate(lastPromptRef.current);
  };

  const handleAutoFix = (sourceError?: string) => {
    if (!currentCode) return;
    const errorText = sourceError || errorMessage || '構文エラーが発生しました';
    const fixPrompt = `以下のMermaidコードにエラーがあります。エラーメッセージを参考に、正しいMermaidコードのみを出力してください。\n\nエラーメッセージ:\n${errorText}\n\n対象コード:\n${currentCode}`;
    handleGenerate(fixPrompt, { isAutoFix: true });
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
    setShowEditor(isDev && window.innerWidth > 768);
    setActiveTab('edit');
    // Sync visual diagram for beginner
    if (isBeginner && latest.code) {
      try { setVisualDiagram(parseMermaidToVisual(latest.code)); } catch {}
    }
  };

  const handleDeleteHistory = (id: string) => {
    const target = history.find(h => h.id === id);
    if (!target) return;
    if (!window.confirm(`「${target.title}」を削除しますか？`)) return;

    setHistory(prev => prev.filter(h => h.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setCurrentCode('');
      setAppState('idle');
      setShowEditor(false);
    }
  };

  const handleRevertVersion = (version: DiagramVersion) => {
    setCurrentCode(version.code);
    setActiveTab('edit');
    if (isBeginner && version.code) {
      try { setVisualDiagram(parseMermaidToVisual(version.code)); } catch {}
    }
  };

  const handleSelectTemplate = (template: DiagramTemplate) => {
    setPrompt(template.prompt);
    handleGenerate(template.prompt);
  };

  const handleNewBlank = () => {
    setCurrentCode('graph TD\n  開始 --> 終了');
    setActiveId(null);
    setAppState('idle');
    setShowEditor(window.innerWidth > 768);
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

  const renderPngBlob = async () => {
    const svgElement = document.querySelector('.mermaid svg') as SVGSVGElement | null;
    if (!svgElement) return null;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    return new Promise<Blob | null>((resolve) => {
      img.onload = () => {
        const bbox = svgElement.getBBox();
        const width = Math.max(1, Math.ceil(bbox.width));
        const height = Math.max(1, Math.ceil(bbox.height));
        const canvas = document.createElement('canvas');
        const scale = 1;
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          resolve(blob ?? null);
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    });
  };

  const handleDownloadImage = async () => {
    const blob = await renderPngBlob();
    if (!blob) return;

    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
    const pngUrl = URL.createObjectURL(blob);

    if (isIOS || !('download' in HTMLAnchorElement.prototype)) {
      window.open(pngUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(pngUrl), 10_000);
      return;
    }

    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `diagram-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(pngUrl);
  };

  const handleShareImage = async () => {
    const blob = await renderPngBlob();
    if (!blob) return;

    const file = new File([blob], `diagram-${Date.now()}.png`, { type: 'image/png' });
    try {
      const canShare = (navigator as any).canShare?.({ files: [file] });
      if (navigator.share && canShare) {
        await navigator.share({ files: [file], title: 'diagram' });
        return;
      }
    } catch {
      // fallback below
    }

    await handleDownloadImage();
  };

  const handleFocusEditor = () => {
    if (!textareaRef.current) return;
    textareaRef.current.focus();
    const pos = textareaRef.current.value.length;
    textareaRef.current.setSelectionRange(pos, pos);
  };
  };

  const activeProject = history.find(h => h.id === activeId);
  const isBetaFull = betaStatus ? betaStatus.remaining <= 0 : false;

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
      <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-purple-50 text-slate-900 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 right-10 w-80 h-80 bg-blue-200 rounded-full blur-3xl opacity-30 float-slow" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-20 float-slower" />
          <div className="hero-dots absolute inset-0 opacity-40" />
        </div>

        {/* Header */}
        <header className="relative z-10 h-16 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2 font-black text-slate-800">
            <Sparkles className="w-5 h-5 text-blue-600" /> Archy
          </div>
        </header>

        {/* Main content */}
        <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-8 sm:pt-16 pb-12">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl shadow-blue-200">
            <Sparkles className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 text-center mb-4 tracking-tight leading-tight">
            図解を、<span className="text-blue-600">もっとかんたんに。</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-500 font-medium text-center max-w-lg mb-10">
            テキストを入力するだけで、AIがフローチャートや構成図をパッと作ってくれます。
          </p>

          {/* Step Guide - beginner friendly */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-2xl mb-12">
            <div className="bg-white/80 backdrop-blur rounded-2xl p-5 text-center border border-slate-100 shadow-sm">
              <div className="w-10 h-10 mx-auto bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-3 text-lg font-black">1</div>
              <h3 className="font-bold text-slate-800 text-sm">ログインする</h3>
              <p className="text-xs text-slate-400 mt-1">Googleアカウントで一瞬</p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-2xl p-5 text-center border border-slate-100 shadow-sm">
              <div className="w-10 h-10 mx-auto bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-3 text-lg font-black">2</div>
              <h3 className="font-bold text-slate-800 text-sm">作りたい図を入力</h3>
              <p className="text-xs text-slate-400 mt-1">「ログインの流れ図」みたいに</p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-2xl p-5 text-center border border-slate-100 shadow-sm">
              <div className="w-10 h-10 mx-auto bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-3 text-lg font-black">3</div>
              <h3 className="font-bold text-slate-800 text-sm">AIが自動で図を作成</h3>
              <p className="text-xs text-slate-400 mt-1">あとは待つだけ！</p>
            </div>
          </div>

          {betaStatus ? (
            <div className={`mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-black shadow-sm ${
              betaStatus.remaining <= 50
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <AlertCircle className="w-4 h-4" />
              <span>β参加可能者 残り</span>
              <span className="px-2 py-0.5 bg-white/80 rounded-full border border-white text-slate-800">
                {betaStatus.remaining}/{betaStatus.limit}
              </span>
            </div>
          ) : (
            <div className="mb-6 text-xs text-slate-400">β参加枠を確認中...</div>
          )}

          {/* Login Button */}
          <button
            onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
            disabled={isBetaFull}
            className="group px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {isBetaFull ? '満員のため受付終了' : 'Googleでログインして始める'}
          </button>
          <p className="mt-4 text-xs text-slate-400">無料枠内で何度でも試せます</p>

          {/* Developer hint */}
          <div className="mt-12 pt-6 border-t border-slate-200/60 text-center">
            <p className="text-xs text-slate-400">
              <Code2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              開発者の方もGoogleログインで始められます。ログイン後にモードを選べます。
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Show mode selection after login, before main app
  if (!userMode) {
    return (
      <ModeSelect onSelect={(mode) => {
        setUserMode(mode);
        localStorage.setItem('archy-user-mode', mode);
      }} />
    );
  }

  const handleSwitchMode = () => {
    const next = isDev ? 'beginner' : 'developer';
    setUserMode(next);
    localStorage.setItem('archy-user-mode', next);
  };

  const handleBeginnerView = (next: 'mermaid' | 'canvas') => {
    if (next === 'canvas' && currentCode) {
      try {
        setVisualDiagram(parseMermaidToVisual(currentCode));
      } catch (e) {
        console.warn('Failed to parse to visual', e);
      }
    }
    setBeginnerView(next);
  };

  const beginnerBottomInset = isBeginner ? (beginnerInputCollapsed ? 24 : 112) : 0;
  const claimedToday = isSameDay(profile?.daily_claimed_at, new Date());

  return (
    <div className={`flex h-screen w-full overflow-hidden selection:bg-blue-100 font-sans ${
      isDev ? 'bg-[#0d1117] text-slate-200' : 'bg-slate-50 text-slate-900'
    }`}>
      <Sidebar 
        history={history}
        onSelectHistory={handleSelectHistory}
        onSelectTemplate={handleSelectTemplate}
        onClearHistory={() => setHistory([])}
        onDeleteHistory={handleDeleteHistory}
        onNew={handleNew}
        onNewBlank={handleNewBlank}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onShowHelp={() => setShowHelp(true)}
        onShowFeedback={() => setShowFeedback(true)}
        onShowBugReport={() => setShowBugReport(true)}
        userMode={userMode || 'beginner'}
      />

      {errorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-full w-fit flex items-center gap-2 shadow-xl animate-in fade-in">
          <AlertCircle size={14} /> {errorMessage}
          {currentCode && (
            <button
              onClick={() => handleAutoFix()}
              className="ml-2 px-2.5 py-1 bg-white text-red-600 text-[10px] font-black rounded-full shadow hover:shadow-lg transition-all"
            >
              無料で修正
            </button>
          )}
        </div>
      )}

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className={`h-14 sm:h-16 px-4 md:px-6 flex items-center justify-between z-10 shrink-0 border-b ${
          isDev ? 'bg-[#161b22] border-[#30363d]' : 'bg-white/90 backdrop-blur border-slate-200'
        }`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <button onClick={() => setIsSidebarOpen(true)} className={`p-2 rounded-lg md:hidden ${isDev ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}><Menu className="w-6 h-6" /></button>
            <h1 className={`font-bold truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[300px] flex items-center gap-2 ${isDev ? 'text-slate-300 font-mono text-sm' : 'text-slate-700'}`}>
              {isDev
                ? <><span className="text-emerald-400">$</span> {activeId ? activeProject?.title : 'archy'}</>
                : <><Sparkles className="w-5 h-5 text-blue-500 shrink-0" />{activeId ? activeProject?.title : 'Archy'}</>
              }
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              Beta
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {!session && authReady && (
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg text-[10px] font-black uppercase tracking-widest mr-2">
                <AlertCircle size={12} /> Login Required
              </div>
            )}
            <button
              onClick={() => setShowFeedback(true)}
              className={`hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors mr-1 ${
                isDev ? 'bg-[#1c2128] text-slate-400 border border-[#30363d] hover:text-emerald-400' : 'bg-blue-50 text-blue-700 border border-blue-100 hover:text-blue-800'
              }`}
            >
              フィードバック
            </button>
            {session && profile && profile.plan === 'free' && (
              <button
                onClick={handleClaimDailyCredits}
                disabled={claimedToday || isClaiming}
                className={`hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest mr-1 transition-colors border ${
                  claimedToday
                    ? 'bg-slate-100 text-slate-400 border-slate-200'
                    : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                }`}
                title={claimedToday ? '本日の受け取り済み' : '本日の無料枠を受け取る'}
              >
                {isClaiming ? '付与中...' : claimedToday ? '受け取り済み' : '無料枠 +5'}
              </button>
            )}
            {session && profile && (
              <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest mr-2 ${
                isDev ? 'bg-[#1c2128] text-emerald-400 border border-[#30363d]' : 'bg-blue-50 text-blue-600 border border-blue-100'
              }`}>
                {profile.plan === 'pro' ? 'Pro' : `Free ${profile.free_quota_remaining ?? 0}`}
              </div>
            )}
            {currentCode && (
              <>
                {isDev && (
                  <div className="hidden sm:flex items-center rounded-lg p-1 mr-2 bg-[#1c2128]">
                    <button onClick={toggleLayoutOrientation} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all text-slate-400 hover:bg-[#30363d] hover:text-white">
                      <ArrowDownRight className="w-3 h-3" />Rotate
                    </button>
                  </div>
                )}
                {isDev && (
                  <button onClick={() => setShowEditor(!showEditor)} className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${showEditor ? 'bg-emerald-600 text-white' : 'bg-[#1c2128] border border-[#30363d] text-slate-400'}`}>
                    <Code2 className="w-4 h-4" /><span className="hidden xs:inline">Editor</span>
                  </button>
                )}
                <div className={`w-px h-6 mx-0.5 sm:mx-1 ${isDev ? 'bg-[#30363d]' : 'bg-slate-200'}`} />
                <button onClick={handleDownloadImage} className={`p-2 rounded-lg transition-colors ${isDev ? 'hover:bg-[#1c2128] text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`} title="PNGで保存"><Download className="w-5 h-5" /></button>
                <button
                  onClick={handleShareImage}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-bold active:scale-95 shadow-lg transition-colors ${
                    isDev
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                  }`}
                  title="共有"
                >
                  <Share2 className="w-4 h-4" /><span className="hidden sm:inline">共有</span>
                </button>
              </>
            )}
            {authReady && (
              session ? (
                <div className="flex items-center gap-1">
                  {isBeginner && currentCode && (
                    <button
                      onClick={() => handleBeginnerView(beginnerView === 'mermaid' ? 'canvas' : 'mermaid')}
                      className="px-2 py-1.5 text-[10px] font-bold rounded-lg transition-colors text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                      title="表示切替"
                    >
                      {beginnerView === 'mermaid' ? '編集' : '表示'}
                    </button>
                  )}
                  <button
                    onClick={handleSwitchMode}
                    className={`px-2 py-1.5 text-[10px] font-bold rounded-lg transition-colors ${
                      isDev ? 'text-slate-500 hover:text-emerald-400 hover:bg-[#1c2128]' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'
                    }`}
                    title="モード切替"
                  >
                    {isDev ? 'Beginner' : 'Developer'}
                  </button>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className={`px-3 py-2 text-xs font-bold ${isDev ? 'text-slate-500 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {isDev ? 'Logout' : 'ログアウト'}
                  </button>
                </div>
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
          <div className={`flex-1 flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden ${
            isDev ? 'bg-[#0d1117]' : 'bg-slate-50'
          }`}>
            {appState === 'generating' && !currentCode ? (
              <div className="flex flex-col items-center gap-6 text-center p-6">
                <div className="relative">
                   <div className={`w-20 h-20 border-4 rounded-full animate-spin ${
                     isDev ? 'border-[#30363d] border-t-emerald-500' : 'border-slate-200 border-t-blue-500'
                   }`} />
                   {isDev
                     ? <Code2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-emerald-400 animate-pulse" />
                     : <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-500" />
                   }
                </div>
                <div className="space-y-1">
                  <p className={`text-xl font-black ${isDev ? 'text-white font-mono' : 'text-slate-900'}`}>
                    {isDev ? 'Generating diagram...' : 'AIが図を作成中...'}
                  </p>
                  <p className={`text-sm ${isDev ? 'text-slate-500 font-mono' : 'text-slate-500'}`}>
                    {isDev ? 'Building optimal structure' : '最適な構造を作っています'}
                  </p>
                </div>
              </div>
            ) : !currentCode ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                {isDev ? (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="dev-grid-bg absolute inset-0 opacity-[0.03]" />
                    <div className="absolute top-20 right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl float-slow" />
                    <div className="absolute bottom-20 left-20 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl float-slower" />
                  </div>
                ) : (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-28 -right-20 w-72 h-72 bg-blue-100/40 rounded-full blur-3xl float-slow" />
                    <div className="absolute -bottom-32 -left-24 w-80 h-80 bg-slate-200/40 rounded-full blur-3xl float-slower" />
                    <div className="hero-dots absolute inset-0 opacity-60" />
                  </div>
                )}

                {isBeginner ? (
                  /* Beginner Hero: tappable template cards + how-to guide */
                  <div className="w-full h-full overflow-y-auto px-4 sm:px-8 py-8 flex flex-col items-center relative z-10">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center mb-6 shadow-xl shadow-blue-200">
                      <Sparkles className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2 text-center">
                      どんな図を作りますか
                    </h2>
                    <p className="text-sm text-slate-500 mb-8 text-center max-w-md">
                      タップだけでAIが図を作成。あとは指で操作できます。
                    </p>

                    {/* Template Cards Grid - beginner-friendly topics */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg mb-6">
                      {BEGINNER_TEMPLATES.map((tpl) => {
                        const IconMap: Record<string, any> = { Layout, Calendar, Database, BrainCircuit, Clock, Milestone, Workflow };
                        const IconComponent = IconMap[tpl.icon] || Layout;
                        return (
                          <button
                            key={tpl.name}
                            onClick={() => handleSelectTemplate(tpl)}
                            className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/80 backdrop-blur border border-slate-200 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all active:scale-95 group"
                          >
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-bold text-slate-700 text-center leading-tight">{tpl.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* "自分で作る" button for beginner canvas */}
                    <button
                      onClick={() => {
                        const empty = createEmptyDiagram();
                        setVisualDiagram(empty);
                        setCurrentCode(visualToMermaid(empty));
                        setActiveId(null);
                        setAppState('idle');
                      }}
                      className="mb-8 px-6 py-3 bg-white border-2 border-dashed border-blue-300 hover:border-blue-400 rounded-2xl text-sm font-black text-blue-500 active:scale-95 transition-all flex items-center gap-2"
                    >
                      自分で1から図を作る
                    </button>

                    {/* How-to Guide */}
                    <div className="w-full max-w-md bg-white/60 backdrop-blur rounded-2xl border border-slate-200 p-5 mb-24">
                      <h3 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-500" /> 使い方
                      </h3>
                      <div className="space-y-2.5 text-xs text-slate-500">
                        <p>上のカードをタップ → AIが自動で図を作成</p>
                        <p>「自分で作る」→ ブロックを置いて自由に作成</p>
                        <p>ブロックを <b className="text-blue-500">タップ</b> → メニュー（編集・つなぐ・削除）</p>
                        <p>ブロックを <b className="text-blue-500">スライド</b> → 場所を移動</p>
                        <p>空白を <b className="text-blue-500">長押し</b> → 新しいブロック追加</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Developer Hero: code-style with marquee */
                  <div className="text-center max-w-2xl px-6 py-12 flex flex-col items-center overflow-y-auto h-full justify-center relative z-10">
                    <div className="w-20 h-20 bg-[#161b22] border-2 border-emerald-500/40 text-emerald-400 rounded-2xl flex items-center justify-center mb-10 shadow-2xl shadow-emerald-900/20 float-gentle">
                      <Code2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl sm:text-5xl font-black mb-6 tracking-tight leading-tight text-white font-mono">
                      diagram<span className="text-emerald-400">.generate</span>()<span className="animate-pulse text-emerald-400">|</span>
                    </h2>
                    <p className="text-sm mb-10 font-medium max-w-md text-slate-500 font-mono">
                      Type a prompt or paste Mermaid code. AI handles the rest.
                    </p>
                    <div className="w-full max-w-2xl overflow-hidden">
                      <div className="prompt-marquee">
                        <div className="prompt-track">
                          {[...PROMPT_TICKER, ...PROMPT_TICKER].map((hint, index) => (
                            <button
                              key={`${hint}-${index}`}
                              onClick={() => setPrompt(hint)}
                              className="px-4 py-2 rounded-full text-sm font-bold hover:-translate-y-0.5 transition-all whitespace-nowrap bg-[#161b22] border border-[#30363d] text-slate-400 hover:border-emerald-500 hover:text-emerald-400 shadow-sm"
                            >
                              {hint}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`w-full h-full relative ${isDev ? 'dev-dots-bg' : ''}`}>
                {appState === 'error' && errorMessage && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <h3 className="text-sm font-black text-slate-800">エラーが発生しました</h3>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">{errorMessage}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleRetryLast}
                          className="flex-1 py-2 rounded-lg text-xs font-black bg-blue-600 text-white hover:bg-blue-700"
                        >
                          もう一度試す
                        </button>
                        <button
                          onClick={() => setShowHelp(true)}
                          className="flex-1 py-2 rounded-lg text-xs font-black border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          ヘルプ
                        </button>
                        {!session && (
                          <button
                            onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
                            className="flex-1 py-2 rounded-lg text-xs font-black border border-blue-200 text-blue-700 hover:bg-blue-50"
                          >
                            ログイン
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {isBeginner && currentCode && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/90 border border-slate-200 rounded-full shadow-lg px-1 py-1">
                    <button
                      onClick={() => handleBeginnerView('mermaid')}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-full transition-colors ${beginnerView === 'mermaid' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      表示
                    </button>
                    <button
                      onClick={() => handleBeginnerView('canvas')}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-full transition-colors ${beginnerView === 'canvas' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      編集
                    </button>
                  </div>
                )}
                {isBeginner ? (
                  beginnerView === 'canvas' ? (
                    <BeginnerCanvas
                      diagram={visualDiagram}
                      onChange={setVisualDiagram}
                      onCodeSync={(code) => setCurrentCode(code)}
                      bottomInset={beginnerBottomInset}
                    />
                  ) : (
                    <MermaidRenderer chart={currentCode} onAutoFix={handleAutoFix} isStreaming={isStreaming} userMode={userMode || 'beginner'} />
                  )
                ) : (
                  <MermaidRenderer chart={currentCode} onAutoFix={handleAutoFix} isStreaming={isStreaming} userMode={userMode || 'beginner'} />
                )}
                {appState === 'generating' && (
                  <div className={`absolute top-6 left-1/2 -translate-x-1/2 backdrop-blur-md px-6 py-3 rounded-full shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 z-50 ${
                    isDev ? 'bg-[#161b22]/90 border border-emerald-500/30' : 'bg-white/80 border border-slate-200'
                  }`}>
                    <RefreshCw className={`w-4 h-4 animate-spin ${isDev ? 'text-emerald-400' : 'text-blue-500'}`} />
                    <span className={`text-sm font-black tracking-tight ${isDev ? 'text-slate-300 font-mono' : 'text-slate-700'}`}>
                      {isDev ? 'Compiling diagram...' : 'AIが図を作成中...'}
                    </span>
                    <div className={`ml-1 flex items-center gap-2 ${isDev ? 'text-emerald-400' : 'text-blue-600'}`}>
                      <div className={`h-1.5 w-16 rounded-full overflow-hidden ${isDev ? 'bg-[#30363d]' : 'bg-slate-200'}`}>
                        <div
                          className={`h-full ${isDev ? 'bg-emerald-400' : 'bg-blue-500'}`}
                          style={{ width: `${streamingProgress}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-black ${isDev ? 'font-mono' : ''}`}>{streamingProgress}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Editor panel - developer mode only */}
          {isDev && showEditor && (
            <div className={`fixed md:relative inset-y-0 right-0 z-40 w-full md:w-[450px] flex flex-col shadow-2xl transition-transform duration-300 bg-[#0d1117] ${showEditor ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="p-4 border-b flex flex-col gap-4 shrink-0 bg-[#161b22] border-[#30363d]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowEditor(false)} className="p-1 rounded md:hidden hover:bg-[#1c2128] text-slate-400"><ArrowLeft size={18} /></button>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-[10px] font-mono text-slate-500 ml-2">mermaid.md</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleFocusEditor} className="p-1.5 text-slate-500 hover:text-white" title="エディタにフォーカス"><Type size={14} /></button>
                    <button onClick={saveManualSnapshot} className="p-1.5 text-slate-500 hover:text-white" title="スナップショットを保存"><Save size={14} /></button>
                    <button onClick={handleCopyCode} className="p-1.5 text-slate-500 hover:text-white">{copyFeedback ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}</button>
                  </div>
                </div>
                <div className="flex p-1 rounded-lg bg-[#0d1117]">
                  <button onClick={() => setActiveTab('edit')} className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 ${activeTab === 'edit' ? 'bg-[#1c2128] text-emerald-400' : 'text-slate-400'}`}>
                    <Edit2 size={12} /> Code
                  </button>
                  <button onClick={() => setActiveTab('versions')} className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-2 ${activeTab === 'versions' ? 'bg-[#1c2128] text-emerald-400' : 'text-slate-400'}`}>
                    <HistoryIcon size={12} /> Commits {activeProject?.versions.length ? `(${activeProject.versions.length})` : ''}
                  </button>
                </div>
              </div>
              
              {activeTab === 'edit' ? (
                <>
                  <div className="border-b border-[#30363d] bg-[#0d1117] px-4 py-2 flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-slate-600">LN {currentCode.split('\n').length}</span>
                    <span className="text-[10px] font-mono text-slate-600">| UTF-8</span>
                    <span className="text-[10px] font-mono text-slate-600">| Mermaid</span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={currentCode}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    spellCheck={false}
                    className="flex-1 font-mono text-sm p-6 sm:p-8 resize-none focus:outline-none bg-[#0d1117] text-emerald-100 caret-emerald-400 selection:bg-emerald-900/40"
                    placeholder="// Start typing Mermaid code..."
                  />
                </>
              ) : (
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0d1117]">
                  {activeProject?.versions.map((v, i) => (
                    <div key={v.id} className="p-4 rounded-xl border border-[#30363d] bg-[#161b22]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-mono">
                          {i === 0 ? 'HEAD' : `commit ${activeProject.versions.length - i}`}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">{new Date(v.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-medium mb-3 line-clamp-2 text-slate-400 font-mono">{v.prompt}</p>
                      <button onClick={() => handleRevertVersion(v)} className="w-full py-2 text-white text-[11px] font-black rounded-lg transition-all flex items-center justify-center gap-2 bg-[#1c2128] hover:bg-emerald-600 border border-[#30363d]">
                        <RotateCcw size={12} /> Revert
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={`absolute bottom-4 sm:bottom-10 left-1/2 -translate-x-1/2 w-full px-3 sm:px-8 z-30 transition-all pb-[env(safe-area-inset-bottom)] ${
          isDev ? 'max-w-4xl' : 'max-w-2xl'
        } ${showEditor && window.innerWidth < 768 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex flex-col gap-3">
            {/* File attachment badge - developer only */}
            {isDev && attachedFile && (
              <div className="flex items-center gap-2 self-start text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg bg-emerald-600">
                {attachedFile.name.endsWith('.zip') ? <FileArchive size={14} /> : <FileText size={14} />}
                <span>{attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} className="ml-1 hover:text-red-200"><X size={14} /></button>
              </div>
            )}
            {isBeginner && beginnerInputCollapsed ? (
              <div className="flex items-center justify-center gap-2 bg-white/95 rounded-full shadow-xl border border-slate-200 px-3 py-2">
                <button
                  onClick={() => setBeginnerInputCollapsed(false)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600"
                >
                  <ChevronUp className="w-4 h-4" /> 入力を開く
                </button>
              </div>
            ) : (
              <div className={`backdrop-blur-2xl flex items-center gap-2 group transition-all ${
                isDev
                  ? 'bg-[#161b22]/95 rounded-xl sm:rounded-2xl shadow-2xl border border-[#30363d] p-2.5'
                  : 'bg-white/95 rounded-2xl sm:rounded-[2.5rem] shadow-2xl border border-slate-200 p-2'
              }`}>
              {/* File upload - developer only */}
              {isDev && (
                <>
                  <button onClick={() => fileInputRef.current?.click()} disabled={isFileLoading || appState === 'generating'} className="ml-2 p-3 text-slate-500 hover:text-emerald-400">
                    {isFileLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Paperclip className="w-6 h-6" />}
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip,.md,.txt,.json,.js,.ts,.tsx,.py" />
                </>
              )}
              {isBeginner && (
                <button
                  onClick={() => setBeginnerInputCollapsed(true)}
                  className="ml-1 p-2 text-slate-500 hover:text-blue-600"
                  title="入力を閉じる"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              )}
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder={isDev
                  ? (attachedFile ? 'Describe how to visualize...' : 'Describe the diagram you want to create...')
                  : '「カレーの作り方」や「旅行の計画」のように書いてください'
                }
                className={`flex-1 bg-transparent focus:outline-none font-bold ${
                  isDev
                    ? 'py-3 sm:py-5 px-2 sm:px-4 text-slate-200 placeholder:text-slate-600 font-mono text-sm sm:text-base'
                    : 'py-3 sm:py-4 px-3 sm:px-4 text-slate-800 placeholder:text-slate-400 text-sm sm:text-lg'
                }`}
              />
              <button onClick={() => handleGenerate()} disabled={(!prompt.trim() && !attachedFile) || appState === 'generating'} className={`px-6 sm:px-10 py-3 sm:py-5 text-white font-black flex items-center gap-2 disabled:opacity-50 ${
                isDev
                  ? 'bg-emerald-600 hover:bg-emerald-500 rounded-lg sm:rounded-xl shadow-lg shadow-emerald-900/30'
                  : 'bg-blue-600 hover:bg-blue-700 rounded-xl sm:rounded-[2rem] shadow-lg shadow-blue-200'
              }`}>
                {appState === 'generating' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                <span className="hidden xs:inline">{isDev ? (currentCode ? 'Rebuild' : 'Generate') : (currentCode ? '修正' : '作る！')}</span>
              </button>
              </div>
            )}
          </div>
        </div>

        {showHelp && <HelpModal onClose={() => setShowHelp(false)} onTryPrompt={handleGenerate} />}
        {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} userMode={userMode || 'beginner'} />}
        {showBugReport && <BugReportModal onClose={() => setShowBugReport(false)} userMode={userMode || 'beginner'} />}
      </main>
    </div>
  );
};

export default App;