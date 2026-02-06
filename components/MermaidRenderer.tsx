import React, { useEffect, useRef, useState, useDeferredValue, useMemo } from 'react';
import mermaid from 'mermaid';
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, ZoomIn, ZoomOut, Info, Code, Maximize2 } from 'lucide-react';
import type { UserMode } from './ModeSelect';

interface MermaidRendererProps {
  chart: string;
  onAutoFix?: (errorMessage: string) => void;
  isStreaming?: boolean;
  userMode?: UserMode;
}

// Global initialization
try {
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'loose',
    fontFamily: 'Inter, sans-serif',
    suppressErrorIndicators: true,
    flowchart: {
      htmlLabels: true,
      curve: 'basis'
    },
    sequence: {
      mirrorActors: false,
      bottomMarginAdjustment: 2
    },
    gantt: {
      barHeight: 30,
      fontSize: 12
    }
  });
} catch (e) {
  console.error("Mermaid initialization failed:", e);
}

const MermaidRenderer: React.FC<MermaidRendererProps> = ({ chart, onAutoFix, isStreaming = false, userMode = 'beginner' }) => {
  const isDev = userMode === 'developer';
  // Use deferred value to keep the main thread (typing) snappy
  const deferredChart = useDeferredValue(chart);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const [svg, setSvg] = useState<string>('');
  const [lastValidSvg, setLastValidSvg] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<{ message: string; line?: number } | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [syntaxStatus, setSyntaxStatus] = useState<'valid' | 'invalid' | 'idle'>('idle');
  
  // Transform states
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const renderCounter = useRef(0);

  useEffect(() => {
    let isMounted = true;
    const currentRender = ++renderCounter.current;

    const performRender = async () => {
      const code = deferredChart.trim();
      
      if (!code || code.length < 5) {
        if (isMounted) {
          setSvg('');
          setLastValidSvg('');
          setErrorDetails(null);
          setSyntaxStatus('idle');
          setIsRendering(false);
        }
        return;
      }

      // Quick syntax pre-check using mermaid.parse
      try {
        const isValid = await mermaid.parse(code);
        if (!isValid) throw new Error("Parse failed");
      } catch (err: any) {
        if (isMounted && currentRender === renderCounter.current) {
          setSyntaxStatus('invalid');
          // Only show explicit error details if it stays invalid for a while
          if (!isStreaming) {
            const timer = setTimeout(() => {
              if (isMounted && currentRender === renderCounter.current) {
                 setErrorDetails({ message: err.message || "構文エラーです" });
              }
            }, 1500);
            return () => clearTimeout(timer);
          }
        }
        return;
      }

      // If valid, perform actual render
      try {
        if (isMounted) setIsRendering(true);
        
        const id = `mermaid-svg-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, code);

        if (isMounted && currentRender === renderCounter.current) {
          setSvg(renderedSvg);
          setLastValidSvg(renderedSvg);
          setErrorDetails(null);
          setSyntaxStatus('valid');
        }
      } catch (err: any) {
        if (isMounted && currentRender === renderCounter.current) {
          setSyntaxStatus('invalid');
        }
      } finally {
        if (isMounted && currentRender === renderCounter.current) {
          setIsRendering(false);
        }
      }
    };

    performRender();

    return () => { isMounted = false; };
  }, [deferredChart, isStreaming]);

  // Use passive event listeners for better scrolling/panning performance
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; 
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const autoFit = () => {
    const wrapper = wrapperRef.current;
    const svgEl = containerRef.current?.querySelector('svg');
    if (!wrapper || !svgEl) return;

    const wRect = wrapper.getBoundingClientRect();
    const sRect = svgEl.getBBox();
    
    const padding = 40;
    const scaleX = (wRect.width - padding) / sRect.width;
    const scaleY = (wRect.height - padding) / sRect.height;
    const newScale = Math.min(scaleX, scaleY, 1.5); // Max scale 1.5x
    
    setScale(newScale);
    setOffset({ x: 0, y: 0 });
  };

  const displaySvg = syntaxStatus === 'valid' ? svg : lastValidSvg;
  const isGhosted = syntaxStatus === 'invalid' && lastValidSvg !== '';

  return (
    <div className={`relative w-full h-full overflow-hidden cursor-grab active:cursor-grabbing select-none ${isDev ? 'bg-[#0d1117]' : 'bg-slate-50/50'}`}
         onMouseDown={handleMouseDown}
         onMouseMove={handleMouseMove}
         onMouseUp={handleMouseUp}
         onMouseLeave={handleMouseUp}
         onWheel={(e) => {
           if (e.ctrlKey || e.metaKey) {
             const delta = e.deltaY > 0 ? 0.9 : 1.1;
             setScale(s => Math.min(Math.max(s * delta, 0.1), 10));
             if (e.cancelable) e.preventDefault();
           }
         }}>
      
      {/* Live Status Overlay */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shadow-sm backdrop-blur-md transition-all duration-300 ${
          isDev
            ? (syntaxStatus === 'valid' ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400' :
               syntaxStatus === 'invalid' ? 'bg-amber-950/80 border-amber-800 text-amber-400' :
               'bg-slate-900/80 border-slate-700 text-slate-500')
            : (syntaxStatus === 'valid' ? 'bg-green-50/80 border-green-200 text-green-700' :
               syntaxStatus === 'invalid' ? 'bg-amber-50/80 border-amber-200 text-amber-700' :
               'bg-white/80 border-slate-200 text-slate-500')
        }`}>
          {isRendering ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : syntaxStatus === 'valid' ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : syntaxStatus === 'invalid' ? (
            <AlertCircle className="w-3 h-3" />
          ) : (
            <Info className="w-3 h-3" />
          )}
          <span className={`text-[10px] font-black uppercase tracking-widest ${isDev ? 'font-mono' : ''}`}>
            {isDev
              ? (isRendering ? 'Rendering' : syntaxStatus === 'valid' ? 'Synced' : syntaxStatus === 'invalid' ? 'Parse error' : 'Idle')
              : (isRendering ? '処理中...' : syntaxStatus === 'valid' ? '完成 ✓' : syntaxStatus === 'invalid' ? '修正中...' : '待機中')
            }
          </span>
        </div>
      </div>

      {/* Optimized Control Panel */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
        <div className={`flex flex-col backdrop-blur rounded-xl shadow-lg p-1 ${
          isDev ? 'bg-slate-900/90 border border-[#30363d]' : 'bg-white/90 border border-slate-200'
        }`}>
          <button onClick={() => setScale(s => Math.min(s * 1.2, 10))} className={`p-2.5 rounded-lg transition-colors ${isDev ? 'hover:bg-slate-800 text-slate-400 hover:text-emerald-400' : 'hover:bg-slate-100 text-slate-600'}`} title="拡大"><ZoomIn size={18} /></button>
          <button onClick={() => setScale(s => Math.max(s / 1.2, 0.1))} className={`p-2.5 rounded-lg transition-colors ${isDev ? 'hover:bg-slate-800 text-slate-400 hover:text-emerald-400' : 'hover:bg-slate-100 text-slate-600'}`} title="縮小"><ZoomOut size={18} /></button>
          <div className={`h-px mx-1 ${isDev ? 'bg-[#30363d]' : 'bg-slate-200'}`} />
          <button onClick={autoFit} className={`p-2.5 rounded-lg transition-colors ${isDev ? 'hover:bg-slate-800 text-slate-400 hover:text-emerald-400' : 'hover:bg-slate-100 text-slate-600'}`} title="全体表示"><Maximize2 size={18} /></button>
          <button onClick={resetZoom} className={`p-2.5 rounded-lg transition-colors ${isDev ? 'hover:bg-slate-800 text-slate-400 hover:text-emerald-400' : 'hover:bg-slate-100 text-slate-600'}`} title="リセット"><RotateCcw size={18} /></button>
        </div>
      </div>

      {/* Syntax Error Hint */}
      {errorDetails && syntaxStatus === 'invalid' && (
        <div className="absolute top-6 left-6 right-6 flex items-center justify-center z-30 pointer-events-none animate-in slide-in-from-top-4">
          <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-md text-white rounded-2xl p-4 shadow-2xl pointer-events-auto flex items-start gap-3 border border-slate-700">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold leading-relaxed truncate">{errorDetails.message}</p>
              <p className={`text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest ${isDev ? 'font-mono' : ''}`}>
                {isDev ? 'Fix required' : '修正が必要です'}
              </p>
            </div>
            {onAutoFix && (
              <button
                onClick={() => onAutoFix(errorDetails.message)}
                className={`shrink-0 px-3 py-1.5 text-[10px] font-black rounded-full shadow hover:shadow-lg transition-all ${
                  isDev ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900'
                }`}
              >
                {isDev ? 'Auto-fix' : '無料で修正'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Canvas Layer - Using transform for high performance */}
      <div 
        ref={wrapperRef}
        className={`w-full h-full flex items-center justify-center transition-opacity duration-300 ${isGhosted ? 'opacity-30' : 'opacity-100'}`}
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          willChange: 'transform'
        }}
      >
        <div 
          ref={containerRef} 
          className="mermaid transition-transform duration-200"
          dangerouslySetInnerHTML={{ __html: displaySvg }}
        />
      </div>

      {/* Empty State */}
      {!displaySvg && !isRendering && (
        <div className={`absolute inset-0 flex items-center justify-center ${isDev ? 'text-slate-600' : 'text-slate-300'}`}>
           <div className="flex flex-col items-center gap-4 animate-pulse">
              <div className={`w-16 h-16 border-4 border-dashed rounded-full flex items-center justify-center ${isDev ? 'border-[#30363d]' : 'border-slate-200'}`}>
                <Code className="w-6 h-6" />
              </div>
              <p className={`text-xs font-black uppercase tracking-widest ${isDev ? 'font-mono' : ''}`}>
                {isDev ? 'No diagram code' : 'ダイアグラムを作ろう'}
              </p>
           </div>
        </div>
      )}
    </div>
  );
};

export default MermaidRenderer;