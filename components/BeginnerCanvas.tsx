/**
 * BeginnerCanvas.tsx
 * コードなしで図を直接操作できるタッチ対応ビジュアルキャンバス
 *
 * 操作:
 *  - タップ → ノード選択
 *  - 1秒長押し → 編集モーダル（ラベル・色・形の変更）
 *  - ドラッグ → ノードの移動
 *  - 3秒長押し → コンテキストメニュー（削除・つなぐ）
 *  - 空白エリア長押し → 新しいノード作成
 *  - ピンチ → ズーム
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Trash2, Plus, Edit2, Link2, X, Check, Square,
  Circle, Diamond, Palette, Type, Undo2, Redo2,
  ZoomIn, ZoomOut, Sparkles, Move, Hand
} from 'lucide-react';
import { VisualNode, VisualEdge, VisualDiagram } from '../types';
import { generateNodeId, visualToMermaid } from '../services/mermaidBridge';

// ─── Color palette for nodes ───
const PALETTE = [
  '#f9a8d4', '#93c5fd', '#86efac', '#fcd34d',
  '#c4b5fd', '#fdba74', '#67e8f9', '#fca5a5',
  '#f0abfc', '#a5f3fc', '#bef264', '#fda4af',
];

interface BeginnerCanvasProps {
  diagram: VisualDiagram;
  onChange: (diagram: VisualDiagram) => void;
  /** Callback to sync Mermaid code back to App */
  onCodeSync: (code: string) => void;
}

// ─── Sub-components ───

/** 編集モーダル（1秒長押し） */
const EditModal: React.FC<{
  node: VisualNode;
  onSave: (updated: VisualNode) => void;
  onClose: () => void;
}> = ({ node, onSave, onClose }) => {
  const [label, setLabel] = useState(node.label);
  const [color, setColor] = useState(node.color);
  const [shape, setShape] = useState(node.shape);
  const [emoji, setEmoji] = useState(node.emoji || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-4 z-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black text-slate-800">ブロックを編集</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {/* Label */}
        <label className="text-xs font-bold text-slate-500 mb-1 block">名前</label>
        <input
          ref={inputRef}
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300 mb-4"
          placeholder="例: 開始"
        />

        {/* Emoji */}
        <label className="text-xs font-bold text-slate-500 mb-1 block">絵文字（なくてもOK）</label>
        <input
          value={emoji}
          onChange={e => setEmoji(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-300 mb-4"
          placeholder="🚀 📦 ✅ など"
          maxLength={4}
        />

        {/* Shape */}
        <label className="text-xs font-bold text-slate-500 mb-2 block">かたち</label>
        <div className="flex gap-2 mb-4">
          {([['box', '四角', Square], ['circle', '丸', Circle], ['diamond', 'ひし形', Diamond]] as const).map(([s, lbl, Icon]) => (
            <button
              key={s}
              onClick={() => setShape(s)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all text-xs font-bold ${
                shape === s ? 'border-pink-400 bg-pink-50 text-pink-600' : 'border-slate-200 text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              {lbl}
            </button>
          ))}
        </div>

        {/* Color */}
        <label className="text-xs font-bold text-slate-500 mb-2 block">色</label>
        <div className="flex flex-wrap gap-2 mb-6">
          {PALETTE.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                color === c ? 'border-slate-800 scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <button
          onClick={() => onSave({ ...node, label: label || node.id, color, shape, emoji: emoji || undefined })}
          className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-black rounded-2xl shadow-lg shadow-pink-200 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" /> 保存する
        </button>
      </div>
    </div>
  );
};

/** コンテキストメニュー（3秒長押し） */
const ContextMenu: React.FC<{
  x: number;
  y: number;
  nodeId: string | null;
  onDelete: () => void;
  onConnect: () => void;
  onEdit: () => void;
  onClose: () => void;
}> = ({ x, y, nodeId, onDelete, onConnect, onEdit, onClose }) => {
  return (
    <div className="fixed inset-0 z-[90]" onClick={onClose}>
      <div
        className="absolute bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 fade-in"
        style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - 200) }}
        onClick={e => e.stopPropagation()}
      >
        {nodeId && (
          <>
            <button onClick={onEdit} className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors">
              <Edit2 className="w-4 h-4 text-pink-500" /> 編集する
            </button>
            <button onClick={onConnect} className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors">
              <Link2 className="w-4 h-4 text-blue-500" /> つなげる
            </button>
            <div className="h-px bg-slate-100" />
            <button onClick={onDelete} className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-bold text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors">
              <Trash2 className="w-4 h-4" /> 消す
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/** 新規作成メニュー（空白長押し） */
const CreateMenu: React.FC<{
  x: number; y: number;
  onCreateNode: (shape: VisualNode['shape']) => void;
  onClose: () => void;
}> = ({ x, y, onCreateNode, onClose }) => {
  return (
    <div className="fixed inset-0 z-[90]" onClick={onClose}>
      <div
        className="absolute bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 animate-in zoom-in-95 fade-in"
        style={{ left: Math.min(x, window.innerWidth - 180), top: Math.min(y, window.innerHeight - 180) }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1">追加する</p>
        {([['box', '四角ブロック', '📦'], ['circle', '丸ブロック', '⭕'], ['diamond', '判断ブロック', '💎']] as const).map(([shape, lbl, em]) => (
          <button
            key={shape}
            onClick={() => { onCreateNode(shape); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-pink-50 active:bg-pink-100 rounded-xl transition-colors"
          >
            <span className="text-lg">{em}</span> {lbl}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main Canvas Component ───

const BeginnerCanvas: React.FC<BeginnerCanvasProps> = ({ diagram, onChange, onCodeSync }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Canvas pan & zoom
  const [viewBox, setViewBox] = useState({ x: -20, y: -20, w: 600, h: 500 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  // Interaction state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });

  // Long press tracking
  const longPressTimer = useRef<number | null>(null);
  const contextTimer = useRef<number | null>(null);
  const pressStartPos = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  // Modals / menus
  const [editNode, setEditNode] = useState<VisualNode | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [createMenu, setCreateMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);

  // Connecting mode
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  // Undo
  const [undoStack, setUndoStack] = useState<VisualDiagram[]>([]);

  // ── Helpers ──
  const screenToSVG = useCallback((sx: number, sy: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: sx, y: sy };
    const rect = svg.getBoundingClientRect();
    return {
      x: viewBox.x + (sx - rect.left) / rect.width * viewBox.w,
      y: viewBox.y + (sy - rect.top) / rect.height * viewBox.h,
    };
  }, [viewBox]);

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-20), { nodes: diagram.nodes.map(n => ({ ...n })), edges: diagram.edges.map(e => ({ ...e })) }]);
  }, [diagram]);

  const syncCode = useCallback((d: VisualDiagram) => {
    const code = visualToMermaid(d);
    onCodeSync(code);
  }, [onCodeSync]);

  const updateDiagram = useCallback((d: VisualDiagram) => {
    onChange(d);
    syncCode(d);
  }, [onChange, syncCode]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    onChange(prev);
    syncCode(prev);
  };

  // ── Node center for edge drawing ──
  const nodeCenter = (node: VisualNode) => {
    const w = node.shape === 'circle' ? 60 : node.shape === 'diamond' ? 55 : Math.max(80, node.label.length * 10 + 30);
    const h = node.shape === 'circle' ? 60 : node.shape === 'diamond' ? 55 : 44;
    return { cx: node.x + w / 2, cy: node.y + h / 2 };
  };

  // ── Clear timers ──
  const clearTimers = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (contextTimer.current) { clearTimeout(contextTimer.current); contextTimer.current = null; }
  };

  // ── Pointer handlers for NODES ──
  const handleNodePointerDown = (e: React.PointerEvent, node: VisualNode) => {
    e.stopPropagation();
    e.preventDefault();
    didDrag.current = false;

    const pos = screenToSVG(e.clientX, e.clientY);
    pressStartPos.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { dx: pos.x - node.x, dy: pos.y - node.y };

    // If in connect mode, finish connection
    if (connectFrom && connectFrom !== node.id) {
      pushUndo();
      const newEdge: VisualEdge = { id: `e-${connectFrom}-${node.id}`, from: connectFrom, to: node.id };
      const updated = { ...diagram, edges: [...diagram.edges, newEdge] };
      updateDiagram(updated);
      setConnectFrom(null);
      return;
    }

    setSelectedNodeId(node.id);

    // 1s long press → edit modal
    longPressTimer.current = window.setTimeout(() => {
      if (!didDrag.current) {
        setEditNode(node);
      }
    }, 800);

    // 3s long press → context menu (only if edit modal hasn't been shown)
    contextTimer.current = window.setTimeout(() => {
      if (!didDrag.current) {
        setEditNode(null); // Close edit if open
        setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id });
      }
    }, 2500);

    setDraggingNodeId(node.id);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handleNodePointerMove = (e: React.PointerEvent) => {
    if (!draggingNodeId) return;

    const dist = Math.hypot(e.clientX - pressStartPos.current.x, e.clientY - pressStartPos.current.y);
    if (dist > 8) {
      didDrag.current = true;
      clearTimers();
    }

    const pos = screenToSVG(e.clientX, e.clientY);
    const newX = pos.x - dragOffset.current.dx;
    const newY = pos.y - dragOffset.current.dy;

    const updated = {
      ...diagram,
      nodes: diagram.nodes.map(n => n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n)
    };
    onChange(updated);
  };

  const handleNodePointerUp = (e: React.PointerEvent) => {
    clearTimers();
    if (draggingNodeId && didDrag.current) {
      // sync code after drag
      syncCode(diagram);
    }
    setDraggingNodeId(null);
  };

  // ── Pointer handlers for CANVAS (background) ──
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (connectFrom) {
      setConnectFrom(null);
      return;
    }

    setSelectedNodeId(null);
    setContextMenu(null);
    setCreateMenu(null);
    didDrag.current = false;
    pressStartPos.current = { x: e.clientX, y: e.clientY };

    // Long press on empty area → create menu
    longPressTimer.current = window.setTimeout(() => {
      if (!didDrag.current) {
        const svgPos = screenToSVG(e.clientX, e.clientY);
        setCreateMenu({ x: e.clientX, y: e.clientY, canvasX: svgPos.x, canvasY: svgPos.y });
      }
    }, 600);

    // Pan start
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    if (draggingNodeId) {
      handleNodePointerMove(e);
      return;
    }
    if (!isPanning) return;

    const dist = Math.hypot(e.clientX - pressStartPos.current.x, e.clientY - pressStartPos.current.y);
    if (dist > 8) {
      didDrag.current = true;
      clearTimers();
    }

    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = (e.clientX - panStart.current.x) / rect.width * viewBox.w;
    const dy = (e.clientY - panStart.current.y) / rect.height * viewBox.h;
    setViewBox(v => ({ ...v, x: panStart.current.vx - dx, y: panStart.current.vy - dy }));
  };

  const handleCanvasPointerUp = () => {
    clearTimers();
    setIsPanning(false);
  };

  // ── Zoom ──
  const zoom = (factor: number) => {
    setViewBox(v => {
      const cx = v.x + v.w / 2;
      const cy = v.y + v.h / 2;
      const nw = v.w * factor;
      const nh = v.h * factor;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }
  };

  // ── Actions ──
  const handleDeleteNode = (nodeId: string) => {
    pushUndo();
    const updated: VisualDiagram = {
      nodes: diagram.nodes.filter(n => n.id !== nodeId),
      edges: diagram.edges.filter(e => e.from !== nodeId && e.to !== nodeId)
    };
    updateDiagram(updated);
    setContextMenu(null);
    setSelectedNodeId(null);
  };

  const handleCreateNode = (canvasX: number, canvasY: number, shape: VisualNode['shape']) => {
    pushUndo();
    const id = generateNodeId(diagram.nodes);
    const newNode: VisualNode = {
      id,
      label: '新しい',
      x: canvasX - 40,
      y: canvasY - 22,
      color: PALETTE[diagram.nodes.length % PALETTE.length],
      shape,
    };
    const updated = { ...diagram, nodes: [...diagram.nodes, newNode] };
    updateDiagram(updated);
    // Immediately open edit
    setTimeout(() => setEditNode(newNode), 100);
  };

  const handleSaveEdit = (updated: VisualNode) => {
    pushUndo();
    const newDiagram = {
      ...diagram,
      nodes: diagram.nodes.map(n => n.id === updated.id ? updated : n)
    };
    updateDiagram(newDiagram);
    setEditNode(null);
  };

  const handleStartConnect = (nodeId: string) => {
    setConnectFrom(nodeId);
    setContextMenu(null);
  };

  const handleDeleteEdge = (edgeId: string) => {
    pushUndo();
    const updated = { ...diagram, edges: diagram.edges.filter(e => e.id !== edgeId) };
    updateDiagram(updated);
  };

  // ── Render shapes ──
  const renderNode = (node: VisualNode) => {
    const w = node.shape === 'circle' ? 60 : node.shape === 'diamond' ? 55 : Math.max(80, node.label.length * 10 + 30);
    const h = node.shape === 'circle' ? 60 : node.shape === 'diamond' ? 55 : 44;
    const isSelected = selectedNodeId === node.id;
    const isConnecting = connectFrom === node.id;

    return (
      <g
        key={node.id}
        onPointerDown={e => handleNodePointerDown(e, node)}
        onPointerMove={handleNodePointerMove}
        onPointerUp={handleNodePointerUp}
        style={{ cursor: draggingNodeId === node.id ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        {/* Selection ring */}
        {(isSelected || isConnecting) && (
          node.shape === 'circle' ? (
            <circle cx={node.x + w / 2} cy={node.y + h / 2} r={w / 2 + 4} fill="none" stroke={isConnecting ? '#3b82f6' : '#ec4899'} strokeWidth={2.5} strokeDasharray={isConnecting ? '6 3' : 'none'} className="animate-pulse" />
          ) : node.shape === 'diamond' ? (
            <rect x={node.x - 5} y={node.y - 5} width={w + 10} height={h + 10} rx={6} fill="none" stroke={isConnecting ? '#3b82f6' : '#ec4899'} strokeWidth={2.5} strokeDasharray={isConnecting ? '6 3' : 'none'} className="animate-pulse" transform={`rotate(45, ${node.x + w / 2}, ${node.y + h / 2})`} />
          ) : (
            <rect x={node.x - 4} y={node.y - 4} width={w + 8} height={h + 8} rx={14} fill="none" stroke={isConnecting ? '#3b82f6' : '#ec4899'} strokeWidth={2.5} strokeDasharray={isConnecting ? '6 3' : 'none'} className="animate-pulse" />
          )
        )}

        {/* Shape */}
        {node.shape === 'circle' ? (
          <circle cx={node.x + w / 2} cy={node.y + h / 2} r={w / 2} fill={node.color} stroke="#334155" strokeWidth={1.5} filter="url(#shadow)" />
        ) : node.shape === 'diamond' ? (
          <rect x={node.x} y={node.y} width={w} height={h} rx={4} fill={node.color} stroke="#334155" strokeWidth={1.5} filter="url(#shadow)" transform={`rotate(45, ${node.x + w / 2}, ${node.y + h / 2})`} />
        ) : (
          <rect x={node.x} y={node.y} width={w} height={h} rx={10} fill={node.color} stroke="#334155" strokeWidth={1.5} filter="url(#shadow)" />
        )}

        {/* Label */}
        <text
          x={node.x + w / 2}
          y={node.y + h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[11px] font-bold fill-slate-800 pointer-events-none select-none"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          {node.emoji ? `${node.emoji} ` : ''}{node.label}
        </text>
      </g>
    );
  };

  const renderEdge = (edge: VisualEdge) => {
    const fromNode = diagram.nodes.find(n => n.id === edge.from);
    const toNode = diagram.nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return null;

    const from = nodeCenter(fromNode);
    const to = nodeCenter(toNode);

    // Simple straight line with arrowhead
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;
    const ux = dx / len;
    const uy = dy / len;

    // Shorten by node radius
    const startDist = fromNode.shape === 'circle' ? 32 : 24;
    const endDist = toNode.shape === 'circle' ? 32 : 24;
    const x1 = from.cx + ux * startDist;
    const y1 = from.cy + uy * startDist;
    const x2 = to.cx - ux * endDist;
    const y2 = to.cy - uy * endDist;

    return (
      <g key={edge.id}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={2} markerEnd="url(#arrowhead)" />
        {/* Tap target for edge (invisible wider line) */}
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="transparent" strokeWidth={20}
          style={{ cursor: 'pointer', touchAction: 'none' }}
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('この矢印を消しますか？')) {
              handleDeleteEdge(edge.id);
            }
          }}
        />
        {edge.label && (
          <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle" className="text-[9px] font-bold fill-slate-500 pointer-events-none select-none">{edge.label}</text>
        )}
      </g>
    );
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-pink-50/30 via-white to-blue-50/30">
      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full h-full touch-none"
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
        onWheel={handleWheel}
      >
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" fill="#94a3b8">
            <polygon points="0 0, 10 3.5, 0 7" />
          </marker>
          <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
          </filter>
          {/* Grid pattern */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.5" fill="#e2e8f0" />
          </pattern>
        </defs>

        {/* Grid background */}
        <rect x={viewBox.x - 1000} y={viewBox.y - 1000} width={viewBox.w + 2000} height={viewBox.h + 2000} fill="url(#grid)" />

        {/* Edges */}
        {diagram.edges.map(renderEdge)}

        {/* Nodes */}
        {diagram.nodes.map(renderNode)}

        {/* Connect mode line preview */}
        {connectFrom && (
          <text x={viewBox.x + viewBox.w / 2} y={viewBox.y + 20} textAnchor="middle" className="text-[11px] font-bold fill-blue-500">
            つなぐ先のブロックをタップしてね 💫
          </text>
        )}
      </svg>

      {/* ── Floating Toolbar ── */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="p-2.5 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 text-slate-500 hover:text-pink-500 disabled:opacity-30 active:scale-95 transition-all"
        >
          <Undo2 className="w-5 h-5" />
        </button>

        {/* Add node shortcut */}
        <button
          onClick={() => {
            const cx = viewBox.x + viewBox.w / 2;
            const cy = viewBox.y + viewBox.h / 2;
            handleCreateNode(cx, cy, 'box');
          }}
          className="p-2.5 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 text-slate-500 hover:text-pink-500 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
        </button>

        {connectFrom && (
          <div className="px-3 py-2 bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg animate-pulse">
            🔗 つなぐモード
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 z-20">
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 p-1 flex flex-col">
          <button onClick={() => zoom(0.8)} className="p-2.5 text-slate-500 hover:text-pink-500 rounded-lg active:scale-95 transition-all">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button onClick={() => zoom(1.25)} className="p-2.5 text-slate-500 hover:text-pink-500 rounded-lg active:scale-95 transition-all">
            <ZoomOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Hint bar at bottom */}
      {diagram.nodes.length === 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-pink-100 px-5 py-3 text-center z-10">
          <p className="text-sm font-bold text-slate-700">空いてるところを <span className="text-pink-500">長押し</span> してブロックを追加しよう！</p>
        </div>
      )}

      {diagram.nodes.length > 0 && diagram.nodes.length < 3 && diagram.edges.length === 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-pink-100 px-5 py-3 text-center z-10 max-w-xs">
          <p className="text-xs font-bold text-slate-500">
            💡 ブロックを <span className="text-pink-500">1秒おし</span> で編集、<span className="text-pink-500">スライド</span> で移動、<span className="text-pink-500">3秒おし</span> でメニュー
          </p>
        </div>
      )}

      {/* Modals */}
      {editNode && (
        <EditModal node={editNode} onSave={handleSaveEdit} onClose={() => setEditNode(null)} />
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onDelete={() => handleDeleteNode(contextMenu.nodeId)}
          onConnect={() => handleStartConnect(contextMenu.nodeId)}
          onEdit={() => {
            const node = diagram.nodes.find(n => n.id === contextMenu.nodeId);
            if (node) setEditNode(node);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
      {createMenu && (
        <CreateMenu
          x={createMenu.x}
          y={createMenu.y}
          onCreateNode={(shape) => handleCreateNode(createMenu.canvasX, createMenu.canvasY, shape)}
          onClose={() => setCreateMenu(null)}
        />
      )}
    </div>
  );
};

export default BeginnerCanvas;
