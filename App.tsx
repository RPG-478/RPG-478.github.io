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
import TutorialOverlay from './components/TutorialOverlay';
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
  const [profile, setProfile] = useState<{ plan: string; free_quota_remaining: number | null; daily_claimed_at?: string | null; tutorial_completed?: boolean } | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
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
  const editorScrollRef = useRef<HTMLDivElement>(null);
  const streamingTimerRef = useRef<number | null>(null);
  const lastPromptRef = useRef<string>('');
  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const [showMobileFab, setShowMobileFab] = useState(false);

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
      .select('plan, free_quota_remaining, daily_claimed_at, tutorial_completed')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Failed to load profile', error.message);
      setProfile(null);
      return;
    }

    const tutorialDone = data?.tutorial_completed === true;
    setProfile({
      plan: data?.plan || 'free',
      free_quota_remaining: data?.free_quota_remaining ?? 0,
      daily_claimed_at: data?.daily_claimed_at ?? null,
      tutorial_completed: tutorialDone,
    });
    // Show tutorial for new users who haven't completed it
    if (!tutorialDone) {
      setShowTutorial(true);
    }
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
        return;
      }

      const res = await claimDailyCredits(accessToken);
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

      // Beginner mode: allow rich diagrams but keep syntax safe
      if (isBeginner) {
        combinedPrompt = `【重要】ユーザーの要求に忠実に、詳細で見応えのある図を生成してください。
フローチャートの場合は "graph TD" または "graph LR" を使う。
テーマに応じて sequenceDiagram, gantt, mindmap, erDiagram, pie, timeline, journey, classDiagram など最適な図の種類を自動選択してよい。

ルール：
- ノードIDはアルファベット（A, B, C... または user, server など）を使う
- ノードの書式: A[ラベル] A{ラベル} A((ラベル)) A([ラベル]) A[[ラベル]]
- 接続: -->, -->|ラベル|, -.->. ==> を使える
- subgraph を使ってグループ化してよい
- style, classDef は使わない（レンダリング側でスタイルする）
- ラベルは日本語でわかりやすく
- ノード数は最大20個まで
- 「複雑にして」「詳細に」と言われたら、ノードを増やし、subgraphや条件分岐を追加して詳細化すること

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

  const scrollToLine = (lineNum: number) => {
    if (!textareaRef.current) return;
    const lines = currentCode.split('\n');
    const charPos = lines.slice(0, lineNum - 1).reduce((acc, l) => acc + l.length + 1, 0);
    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(charPos, charPos + (lines[lineNum - 1]?.length ?? 0));
    // Scroll textarea to approximate line position
    const lineHeight = 20;
    textareaRef.current.scrollTop = Math.max(0, (lineNum - 3) * lineHeight);
    setHighlightLine(lineNum);
    setTimeout(() => setHighlightLine(null), 2000);
  };

  const handleNodeClick = (nodeId: string) => {
    if (!isDev || !currentCode) return;
    // Search for the node ID in the code
    const lines = currentCode.split('\n');
    const cleanId = nodeId.replace(/^flowchart-/, '').replace(/-\d+$/, '');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(cleanId)) {
        if (!showEditor) setShowEditor(true);
        setActiveTab('edit');
        setTimeout(() => scrollToLine(i + 1), 100);
        return;
      }
    }
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
        <main className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-6 pt-4 sm:pt-16 pb-8 sm:pb-12 overflow-y-auto">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-blue-600 text-white rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center mb-4 sm:mb-8 shadow-2xl shadow-blue-200">
            <Sparkles className="w-8 h-8 sm:w-12 sm:h-12" />
          </div>

          <h1 className="text-2xl sm:text-5xl font-black text-slate-900 text-center mb-2 sm:mb-4 tracking-tight leading-tight">
            図解を、<span className="text-blue-600">かんたんに。</span>
          </h1>
          <p className="text-sm sm:text-lg text-slate-500 font-medium text-center max-w-lg mb-6 sm:mb-10">
            テキスト入力だけでAIが図を作成
          </p>

          {/* Step Guide - horizontal scroll on mobile */}
          <div className="flex sm:grid sm:grid-cols-3 gap-3 sm:gap-6 w-full max-w-2xl mb-6 sm:mb-12 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
            <div className="bg-white/80 backdrop-blur rounded-2xl p-3 sm:p-5 text-center border border-slate-100 shadow-sm min-w-[140px] sm:min-w-0 snap-center shrink-0 sm:shrink">
              <div className="w-8 h-8 sm:w-10 sm:h-10 mx-auto bg-blue-100 text-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center mb-2 sm:mb-3 text-sm sm:text-lg font-black">1</div>
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm">ログイン</h3>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">Googleで一瞬</p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-2xl p-3 sm:p-5 text-center border border-slate-100 shadow-sm min-w-[140px] sm:min-w-0 snap-center shrink-0 sm:shrink">
              <div className="w-8 h-8 sm:w-10 sm:h-10 mx-auto bg-blue-100 text-blue-600 rounded-lg sm:rounded-xl flex items-center justify-center mb-2 sm:mb-3 text-sm sm:text-lg font-black">2</div>
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm">テキスト入力</h3>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">作りたい図を書く</p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-2xl p-3 sm:p-5 text-center border border-slate-100 shadow-sm min-w-[140px] sm:min-w-0 snap-center shrink-0 sm:shrink">
              <div className="w-8 h-8 sm:w-10 sm:h-10 mx-auto bg-purple-100 text-purple-600 rounded-lg sm:rounded-xl flex items-center justify-center mb-2 sm:mb-3 text-sm sm:text-lg font-black">3</div>
              <h3 className="font-bold text-slate-800 text-xs sm:text-sm">AI自動作成</h3>
              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1">待つだけ！</p>
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

  const handleTutorialComplete = async () => {
    setShowTutorial(false);
    // Mark tutorial as completed in DB
    if (session?.user?.id) {
      await supabase
        .from('profiles')
        .update({ tutorial_completed: true })
        .eq('id', session.user.id);
      setProfile(prev => prev ? { ...prev, tutorial_completed: true } : prev);
    }
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
        <div className="fixed top-2 sm:top-4 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 px-3 sm:px-4 py-2.5 bg-red-600 text-white text-xs font-bold rounded-2xl sm:rounded-full sm:w-fit flex items-center gap-2 shadow-xl animate-in fade-in">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1 line-clamp-2">{errorMessage}</span>
          {currentCode && (
            <button
              onClick={() => handleAutoFix()}
              className="ml-1 px-2.5 py-1 bg-white text-red-600 text-[10px] font-black rounded-full shadow hover:shadow-lg transition-all shrink-0"
            >
              修正
            </button>
          )}
        </div>
      )}

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className={`h-12 sm:h-16 px-2 sm:px-4 md:px-6 flex items-center justify-between z-10 shrink-0 border-b ${
          isDev ? 'bg-[#161b22] border-[#30363d]' : 'bg-white/90 backdrop-blur border-slate-200'
        }`}>
          <div className="flex items-center gap-1.5 sm:gap-3 overflow-hidden shrink-0">
            <button onClick={() => setIsSidebarOpen(true)} className={`p-1.5 sm:p-2 rounded-lg md:hidden ${isDev ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}><Menu className="w-5 h-5 sm:w-6 sm:h-6" /></button>
            <h1 className={`font-bold truncate max-w-[120px] sm:max-w-[300px] flex items-center gap-1.5 text-sm sm:text-base ${isDev ? 'text-slate-300 font-mono' : 'text-slate-700'}`}>
              {isDev
                ? <><span className="text-emerald-400">$</span> {activeId ? activeProject?.title : 'archy'}</>
                : <><Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 shrink-0" /><span className="truncate">{activeId ? activeProject?.title : 'Archy'}</span></>
              }
            </h1>
          </div>

          {/* Desktop header actions */}
          <div className="hidden sm:flex items-center gap-1.5">
            {session && profile && profile.plan === 'free' && (
              <button
                onClick={handleClaimDailyCredits}
                disabled={claimedToday || isClaiming}
                className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors border ${
                  claimedToday
                    ? (isDev ? 'bg-[#1c2128] text-slate-500 border-[#30363d]' : 'bg-slate-100 text-slate-400 border-slate-200')
                    : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                }`}
              >
                {isClaiming ? '...' : claimedToday ? '✓済' : '無料枠 +5'}
              </button>
            )}
            {session && profile && (
              <div className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[10px] font-black ${
                isDev ? 'bg-[#1c2128] text-emerald-400 border border-[#30363d]' : 'bg-blue-50 text-blue-600 border border-blue-100'
              }`}>
                {profile.plan === 'pro' ? 'Pro' : `Free ${profile.free_quota_remaining ?? 0}`}
              </div>
            )}
            <button
              onClick={() => setShowFeedback(true)}
              className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${
                isDev ? 'bg-[#1c2128] text-slate-400 border border-[#30363d] hover:text-emerald-400' : 'bg-blue-50 text-blue-700 border border-blue-100 hover:text-blue-800'
              }`}
            >
              FB
            </button>
            {currentCode && (
              <>
                {isDev && (
                  <button onClick={() => setShowEditor(!showEditor)} className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${showEditor ? 'bg-emerald-600 text-white' : 'bg-[#1c2128] border border-[#30363d] text-slate-400'}`}>
                    <Code2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={handleDownloadImage} className={`p-2 rounded-lg transition-colors ${isDev ? 'hover:bg-[#1c2128] text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`} title="保存"><Download className="w-5 h-5" /></button>
                <button
                  onClick={handleShareImage}
                  className={`px-3 py-2 rounded-lg text-sm font-bold active:scale-95 shadow-lg transition-colors ${
                    isDev
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                  }`}
                  title="共有"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </>
            )}
            {authReady && (
              session ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSwitchMode}
                    className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                      isDev ? 'text-slate-500 hover:text-emerald-400 hover:bg-[#1c2128]' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    {isDev ? 'BEG' : 'DEV'}
                  </button>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className={`px-2 py-1.5 text-xs font-bold ${isDev ? 'text-slate-500 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    ✕
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
                  <div className="w-full h-full overflow-y-auto px-3 sm:px-8 py-4 sm:py-8 flex flex-col items-center relative z-10">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 text-white rounded-[1rem] sm:rounded-[1.5rem] flex items-center justify-center mb-3 sm:mb-6 shadow-xl shadow-blue-200">
                      <Sparkles className="w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <h2 className="text-xl sm:text-3xl font-black text-slate-900 mb-1 sm:mb-2 text-center">
                      どんな図を作る？
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-8 text-center max-w-md">
                      タップでAIが作成。指で操作できます。
                    </p>

                    {/* Template Cards Grid - beginner-friendly topics */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 w-full max-w-lg mb-4 sm:mb-6">
                      {BEGINNER_TEMPLATES.map((tpl) => {
                        const IconMap: Record<string, any> = { Layout, Calendar, Database, BrainCircuit, Clock, Milestone, Workflow };
                        const IconComponent = IconMap[tpl.icon] || Layout;
                        return (
                          <button
                            key={tpl.name}
                            onClick={() => handleSelectTemplate(tpl)}
                            className="flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/80 backdrop-blur border border-slate-200 hover:border-blue-300 hover:shadow-lg active:scale-95 transition-all group"
                          >
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-50 text-blue-500 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                              <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-bold text-slate-700 text-center leading-tight">{tpl.name}</span>
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
                      className="mb-4 sm:mb-8 px-4 sm:px-6 py-2 sm:py-3 bg-white border-2 border-dashed border-blue-300 hover:border-blue-400 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black text-blue-500 active:scale-95 transition-all flex items-center gap-2"
                    >
                      自分で1から図を作る
                    </button>

                    {/* How-to Guide */}
                    <div className="w-full max-w-md bg-white/60 backdrop-blur rounded-2xl border border-slate-200 p-4 sm:p-5 mb-20 sm:mb-24">
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
                  <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-0.5 bg-white/90 border border-slate-200 rounded-full shadow-lg px-0.5 py-0.5">
                    <button
                      onClick={() => handleBeginnerView('mermaid')}
                      className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-bold rounded-full transition-colors ${beginnerView === 'mermaid' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                      表示
                    </button>
                    <button
                      onClick={() => handleBeginnerView('canvas')}
                      className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-bold rounded-full transition-colors ${beginnerView === 'canvas' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
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
                    <MermaidRenderer chart={currentCode} onAutoFix={handleAutoFix} isStreaming={isStreaming} userMode={userMode || 'beginner'} onNodeClick={isDev ? handleNodeClick : undefined} />
                  )
                ) : (
                  <MermaidRenderer chart={currentCode} onAutoFix={handleAutoFix} isStreaming={isStreaming} userMode={userMode || 'beginner'} onNodeClick={isDev ? handleNodeClick : undefined} />
                )}
                {appState === 'generating' && (
                  <div className={`absolute top-2 sm:top-6 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-auto backdrop-blur-md px-3 sm:px-6 py-2 sm:py-3 rounded-2xl sm:rounded-full shadow-xl flex items-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-4 z-50 ${
                    isDev ? 'bg-[#161b22]/90 border border-emerald-500/30' : 'bg-white/80 border border-slate-200'
                  }`}>
                    <RefreshCw className={`w-4 h-4 animate-spin shrink-0 ${isDev ? 'text-emerald-400' : 'text-blue-500'}`} />
                    <span className={`text-xs sm:text-sm font-black tracking-tight truncate ${isDev ? 'text-slate-300 font-mono' : 'text-slate-700'}`}>
                      {isDev ? 'Compiling...' : '作成中...'}
                    </span>
                    <div className={`flex items-center gap-1.5 shrink-0 ${isDev ? 'text-emerald-400' : 'text-blue-600'}`}>
                      <div className={`h-1.5 w-12 sm:w-16 rounded-full overflow-hidden ${isDev ? 'bg-[#30363d]' : 'bg-slate-200'}`}>
                        <div
                          className={`h-full transition-all ${isDev ? 'bg-emerald-400' : 'bg-blue-500'}`}
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
                  <div ref={editorScrollRef} className="flex-1 flex overflow-auto bg-[#0d1117]">
                    {/* Line numbers gutter */}
                    <div className="sticky left-0 select-none shrink-0 pt-4 pb-4 pl-2 pr-1 text-right border-r border-[#1c2128] bg-[#0d1117] z-10" aria-hidden>
                      {currentCode.split('\n').map((_, i) => (
                        <div
                          key={i}
                          className={`text-[11px] leading-[20px] font-mono cursor-pointer transition-colors ${
                            highlightLine === i + 1
                              ? 'text-emerald-400 bg-emerald-900/30 rounded-sm px-1 -mx-1'
                              : 'text-slate-600 hover:text-slate-400'
                          }`}
                          style={{ minWidth: '2.5rem' }}
                          onClick={() => scrollToLine(i + 1)}
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={currentCode}
                      onChange={handleTextareaChange}
                      onKeyDown={handleKeyDown}
                      spellCheck={false}
                      className="flex-1 font-mono text-sm leading-[20px] pt-4 pb-4 px-4 resize-none focus:outline-none bg-[#0d1117] text-emerald-100 caret-emerald-400 selection:bg-emerald-900/40"
                      placeholder="// Start typing Mermaid code..."
                      onScroll={(e) => {
                        // Sync gutter scroll with textarea
                        const gutter = editorScrollRef.current?.firstElementChild as HTMLElement;
                        if (gutter) gutter.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
                      }}
                    />
                  </div>
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

        <div className={`absolute bottom-[calc(3rem_+_env(safe-area-inset-bottom))] sm:bottom-10 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:px-8 z-30 transition-all ${
          isDev ? 'sm:max-w-4xl' : 'sm:max-w-2xl'
        } ${showEditor && window.innerWidth < 768 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          style={{ paddingBottom: '8px' }}
        >
          <div className="flex flex-col gap-2 px-2 sm:px-0">
            {/* File attachment badge - developer only */}
            {isDev && attachedFile && (
              <div className="flex items-center gap-2 self-start text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg bg-emerald-600 ml-1">
                {attachedFile.name.endsWith('.zip') ? <FileArchive size={12} /> : <FileText size={12} />}
                <span className="truncate max-w-[150px]">{attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} className="ml-1 hover:text-red-200"><X size={12} /></button>
              </div>
            )}
            {isBeginner && beginnerInputCollapsed ? (
              <div className="flex items-center justify-center gap-2 bg-white/95 rounded-full shadow-xl border border-slate-200 px-3 py-2 mx-2 sm:mx-0">
                <button
                  onClick={() => setBeginnerInputCollapsed(false)}
                  className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-blue-600"
                >
                  <ChevronUp className="w-4 h-4" /> 入力を開く
                </button>
              </div>
            ) : (
              <div className={`backdrop-blur-2xl flex items-center gap-1 sm:gap-2 group transition-all ${
                isDev
                  ? 'bg-[#161b22]/95 rounded-t-2xl sm:rounded-2xl shadow-2xl border-t sm:border border-[#30363d] p-1.5 sm:p-2.5'
                  : 'bg-white/95 rounded-t-2xl sm:rounded-[2.5rem] shadow-2xl border-t sm:border border-slate-200 p-1.5 sm:p-2'
              }`}>
              {/* File upload - developer only */}
              {isDev && (
                <>
                  <button onClick={() => fileInputRef.current?.click()} disabled={isFileLoading || appState === 'generating'} className="ml-1 p-2 sm:p-3 text-slate-500 hover:text-emerald-400">
                    {isFileLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip,.md,.txt,.json,.js,.ts,.tsx,.py" />
                </>
              )}
              {isBeginner && (
                <button
                  onClick={() => setBeginnerInputCollapsed(true)}
                  className="ml-0.5 p-1.5 text-slate-400 hover:text-blue-600"
                  title="入力を閉じる"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                placeholder={isDev
                  ? (attachedFile ? 'Describe...' : 'Describe diagram...')
                  : 'どんな図を作る？'
                }
                className={`flex-1 min-w-0 bg-transparent focus:outline-none font-bold ${
                  isDev
                    ? 'py-2.5 sm:py-5 px-2 sm:px-4 text-slate-200 placeholder:text-slate-600 font-mono text-sm'
                    : 'py-2.5 sm:py-4 px-2 sm:px-4 text-slate-800 placeholder:text-slate-400 text-sm sm:text-lg'
                }`}
              />
              <button onClick={() => handleGenerate()} disabled={(!prompt.trim() && !attachedFile) || appState === 'generating'} className={`px-4 sm:px-10 py-2.5 sm:py-5 text-white font-black flex items-center gap-1.5 disabled:opacity-50 shrink-0 ${
                isDev
                  ? 'bg-emerald-600 hover:bg-emerald-500 rounded-lg sm:rounded-xl shadow-lg shadow-emerald-900/30'
                  : 'bg-blue-600 hover:bg-blue-700 rounded-xl sm:rounded-[2rem] shadow-lg shadow-blue-200'
              }`}>
                {appState === 'generating' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                <span className="hidden sm:inline">{isDev ? (currentCode ? 'Rebuild' : 'Generate') : (currentCode ? '修正' : '作る！')}</span>
              </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Bottom Action Bar */}
        {session && (
          <nav className={`sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t ${
            isDev ? 'bg-[#161b22]/95 backdrop-blur-xl border-[#30363d]' : 'bg-white/95 backdrop-blur-xl border-slate-200'
          }`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="flex items-stretch justify-around h-12">
              {/* Menu / Sidebar */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 active:scale-90 transition-transform ${
                  isDev ? 'text-slate-400 active:text-emerald-400' : 'text-slate-500 active:text-blue-600'
                }`}
              >
                <Menu className="w-5 h-5" />
                <span className="text-[9px] font-bold leading-none">メニュー</span>
              </button>

              {/* Credits / Claim */}
              <button
                onClick={!claimedToday && !isClaiming && profile?.plan === 'free' ? handleClaimDailyCredits : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 active:scale-90 transition-transform ${
                  !claimedToday && profile?.plan === 'free'
                    ? (isDev ? 'text-emerald-400' : 'text-blue-600')
                    : (isDev ? 'text-slate-500' : 'text-slate-400')
                }`}
              >
                <Zap className="w-5 h-5" />
                <span className="text-[9px] font-bold leading-none">
                  {profile?.plan === 'pro' ? 'Pro' : claimedToday ? `残${profile?.free_quota_remaining ?? 0}` : '+5'}
                </span>
              </button>

              {/* Mode Switch */}
              <button
                onClick={handleSwitchMode}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 active:scale-90 transition-transform ${
                  isDev ? 'text-emerald-400' : 'text-blue-600'
                }`}
              >
                {isDev ? <Sparkles className="w-5 h-5" /> : <Code2 className="w-5 h-5" />}
                <span className="text-[9px] font-bold leading-none">{isDev ? 'かんたん' : '開発'}</span>
              </button>

              {/* Editor toggle (dev) or Download/Help */}
              {isDev && currentCode ? (
                <button
                  onClick={() => setShowEditor(!showEditor)}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 active:scale-90 transition-transform ${
                    showEditor ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  <Code2 className="w-5 h-5" />
                  <span className="text-[9px] font-bold leading-none">Editor</span>
                </button>
              ) : (
                <button
                  onClick={currentCode ? handleDownloadImage : () => setShowHelp(true)}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 active:scale-90 transition-transform ${
                    isDev ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {currentCode ? <Download className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
                  <span className="text-[9px] font-bold leading-none">{currentCode ? '保存' : 'ヘルプ'}</span>
                </button>
              )}

              {/* Share or Feedback */}
              <button
                onClick={currentCode ? handleShareImage : () => setShowFeedback(true)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 active:scale-90 transition-transform ${
                  isDev ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {currentCode ? <Share2 className="w-5 h-5" /> : <Heart className="w-5 h-5" />}
                <span className="text-[9px] font-bold leading-none">{currentCode ? '共有' : 'FB'}</span>
              </button>
            </div>
          </nav>
        )}

        {showHelp && <HelpModal onClose={() => setShowHelp(false)} onTryPrompt={handleGenerate} />}
        {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} userMode={userMode || 'beginner'} />}
        {showBugReport && <BugReportModal onClose={() => setShowBugReport(false)} userMode={userMode || 'beginner'} />}
        {showTutorial && <TutorialOverlay onComplete={handleTutorialComplete} isDev={isDev} />}
      </main>
    </div>
  );
};

export default App;