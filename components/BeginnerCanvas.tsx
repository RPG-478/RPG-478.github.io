/**
 * BeginnerCanvas.tsx
 * コードなしで図を直接操作できるタッチ対応ビジュアルキャンバス
 *
 * 操作:
 *  - タップ → ノード選択（下部にアクションバー表示）
 *  - ドラッグ → ノードの移動
 *  - アクションバー「編集」→ 名前・色・形を変更
 *  - アクションバー「つなぐ」→ 接続モード（次にタップしたノードと線でつなぐ）
 *  - アクションバー「削除」→ ノードを消す
 *  - 空白エリア長押し → 新しいノード作成メニュー
 *  - ピンチ / ホイール → ズーム
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Trash2, Plus, Edit2, Link2, X, Check, Square,
  Circle, Diamond, Undo2, ZoomIn, ZoomOut
} from 'lucide-react';
import { VisualNode, VisualEdge, VisualDiagram } from '../types';
import { generateNodeId, visualToMermaid } from '../services/mermaidBridge';

// ─── Color palette ───
const PALETTE = [
  '#f9a8d4', '#93c5fd', '#86efac', '#fcd34d',
  '#c4b5fd', '#fdba74', '#67e8f9', '#fca5a5',
  '#f0abfc', '#a5f3fc', '#bef264', '#fda4af',
];

interface BeginnerCanvasProps {
  diagram: VisualDiagram;
  onChange: (diagram: VisualDiagram) => void;
  onCodeSync: (code: string) => void;
  /** 下部UI（プロンプトバー等）の高さを考慮した余白 */
  bottomInset?: number;
}

// ─── EditModal ───
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
        className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 pb-8 shadow-2xl z-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-black text-slate-800">ブロックを編集</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <label className="text-xs font-bold text-slate-500 mb-1 block">名前</label>
        <input
          ref={inputRef}
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 mb-4"
          placeholder="例: 開始"
        />

        <label className="text-xs font-bold text-slate-500 mb-1 block">絵文字（なくてもOK）</label>
        <input
          value={emoji}
          onChange={e => setEmoji(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 mb-4"
          placeholder="🚀 📦 ✅ など"
          maxLength={4}
        />

        <label className="text-xs font-bold text-slate-500 mb-2 block">かたち</label>
        <div className="flex gap-2 mb-4">
          {([['box', '四角', Square], ['circle', '丸', Circle], ['diamond', 'ひし形', Diamond]] as const).map(([s, lbl, Icon]) => (
            <button
              key={s}
              onClick={() => setShape(s)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all text-xs font-bold ${
                shape === s ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-slate-200 text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              {lbl}
            </button>
          ))}
        </div>

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
          className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" /> 保存する
        </button>
      </div>
    </div>
  );
};

// ─── CreateMenu（空白エリア長押し） ───
const CreateMenu: React.FC<{
  x: number; y: number;
  onCreateNode: (shape: VisualNode['shape']) => void;
  onClose: () => void;
}> = ({ x, y, onCreateNode, onClose }) => {
  return (
    <div className="fixed inset-0 z-[90]" onClick={onClose}>
      <div
        className="absolute bg-white rounded-2xl shadow-2xl border border-slate-200 p-2"
        style={{ left: Math.min(x, window.innerWidth - 180), top: Math.min(y, window.innerHeight - 180) }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1">追加する</p>
        {([['box', '四角ブロック', '📦'], ['circle', '丸ブロック', '⭕'], ['diamond', '判断ブロック', '💎']] as const).map(([shape, lbl, em]) => (
          <button
            key={shape}
            onClick={() => { onCreateNode(shape); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 active:bg-slate-100 rounded-xl transition-colors"
          >
            <span className="text-lg">{em}</span> {lbl}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main Canvas ───

const BeginnerCanvas: React.FC<BeginnerCanvasProps> = ({ diagram, onChange, onCodeSync, bottomInset = 0 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Canvas pan & zoom
  const [viewBox, setViewBox] = useState({ x: -20, y: -20, w: 600, h: 500 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, vx: 0, vy: 0 });

  // Node interaction
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffset = useRef({ dx: 0, dy: 0 });
  const pressStartPos = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  // Long press for empty area only
  const longPressTimer = useRef<number | null>(null);

  // Modals
  const [editNode, setEditNode] = useState<VisualNode | null>(null);
  const [createMenu, setCreateMenu] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);

  // Connect mode
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
    setUndoStack(prev => [...prev.slice(-20), {
      nodes: diagram.nodes.map(n => ({ ...n })),
      edges: diagram.edges.map(e => ({ ...e }))
    }]);
  }, [diagram]);

  const syncCode = useCallback((d: VisualDiagram) => {
    onCodeSync(visualToMermaid(d));
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

  const nodeCenter = (node: VisualNode) => {
    const w = node.shape === 'circle' ? 60 : node.shape === 'diamond' ? 55 : Math.max(80, node.label.length * 10 + 30);
    const h = node.shape === 'circle' ? 60 : node.shape === 'diamond' ? 55 : 44;
    return { cx: node.x + w / 2, cy: node.y + h / 2 };
  };

  const clearTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // ── Node pointer handlers ──
  const handleNodePointerDown = (e: React.PointerEvent, node: VisualNode) => {
    e.stopPropagation();
    e.preventDefault();
    didDrag.current = false;
    pressStartPos.current = { x: e.clientX, y: e.clientY };

    const pos = screenToSVG(e.clientX, e.clientY);
    dragOffset.current = { dx: pos.x - node.x, dy: pos.y - node.y };

    // Connect mode: finish connection
    if (connectFrom && connectFrom !== node.id) {
      pushUndo();
      const newEdge: VisualEdge = {
        id: `e-${connectFrom}-${node.id}`,
        from: connectFrom,
        to: node.id,
      };
      updateDiagram({ ...diagram, edges: [...diagram.edges, newEdge] });
      setConnectFrom(null);
      setSelectedNodeId(node.id);
      return;
    }

    // Tap same node in connect mode → cancel
    if (connectFrom && connectFrom === node.id) {
      setConnectFrom(null);
      return;
    }

    // Start drag tracking (no timers!)
    setDraggingNodeId(node.id);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handleNodePointerMove = (e: React.PointerEvent) => {
    if (!draggingNodeId) return;

    const dist = Math.hypot(
      e.clientX - pressStartPos.current.x,
      e.clientY - pressStartPos.current.y
    );
    if (dist > 8) {
      didDrag.current = true;
    }

    const pos = screenToSVG(e.clientX, e.clientY);
    onChange({
      ...diagram,
      nodes: diagram.nodes.map(n =>
        n.id === draggingNodeId
          ? { ...n, x: pos.x - dragOffset.current.dx, y: pos.y - dragOffset.current.dy }
          : n
      ),
    });
  };

  const handleNodePointerUp = () => {
    if (draggingNodeId) {
      if (didDrag.current) {
        // Dragged → sync position
        syncCode(diagram);
      } else {
        // Tapped (no drag) → toggle selection
        setSelectedNodeId(prev => (prev === draggingNodeId ? null : draggingNodeId));
      }
    }
    setDraggingNodeId(null);
  };

  // ── Canvas (background) pointer handlers ──
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Cancel connect mode on empty area tap
    if (connectFrom) {
      setConnectFrom(null);
      return;
    }

    setSelectedNodeId(null);
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

    const dist = Math.hypot(
      e.clientX - pressStartPos.current.x,
      e.clientY - pressStartPos.current.y
    );
    if (dist > 8) {
      didDrag.current = true;
      clearTimer();
    }

    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = (e.clientX - panStart.current.x) / rect.width * viewBox.w;
    const dy = (e.clientY - panStart.current.y) / rect.height * viewBox.h;
    setViewBox(v => ({ ...v, x: panStart.current.vx - dx, y: panStart.current.vy - dy }));
  };

  const handleCanvasPointerUp = () => {
    clearTimer();
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
    updateDiagram({
      nodes: diagram.nodes.filter(n => n.id !== nodeId),
      edges: diagram.edges.filter(e => e.from !== nodeId && e.to !== nodeId),
    });
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
    updateDiagram({ ...diagram, nodes: [...diagram.nodes, newNode] });
    setTimeout(() => setEditNode(newNode), 100);
  };

  const handleSaveEdit = (updated: VisualNode) => {
    pushUndo();
    updateDiagram({
      ...diagram,
      nodes: diagram.nodes.map(n => (n.id === updated.id ? updated : n)),
    });
    setEditNode(null);
  };

  const handleStartConnect = (nodeId: string) => {
    setConnectFrom(nodeId);
    setSelectedNodeId(null);
  };

  const handleDeleteEdge = (edgeId: string) => {
    pushUndo();
    updateDiagram({ ...diagram, edges: diagram.edges.filter(e => e.id !== edgeId) });
  };

  // ── Render helpers ──
  const renderNode = (node: VisualNode) => {
    const w = node.shape === 'circle' ? 60 : node.shape === 'diamond' ? 55 : Math.max(80, node.label.length * 10 + 30);
    const h = node.shape === 'circle' ? 60 : node.shape === 'diamond' ? 55 : 44;
    const isSelected = selectedNodeId === node.id;
    const isConnectSource = connectFrom === node.id;
    const isConnectTarget = connectFrom !== null && connectFrom !== node.id;

    return (
      <g
        key={node.id}
        onPointerDown={e => handleNodePointerDown(e, node)}
        onPointerMove={handleNodePointerMove}
        onPointerUp={handleNodePointerUp}
        style={{ cursor: draggingNodeId === node.id ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        {/* Selection / connect source ring */}
        {(isSelected || isConnectSource) && (
          node.shape === 'circle' ? (
            <circle cx={node.x + w / 2} cy={node.y + h / 2} r={w / 2 + 5}
              fill="none" stroke={isConnectSource ? '#3b82f6' : '#6366f1'} strokeWidth={2.5}
              strokeDasharray={isConnectSource ? '6 3' : 'none'} />
          ) : node.shape === 'diamond' ? (
            <rect x={node.x - 6} y={node.y - 6} width={w + 12} height={h + 12} rx={6}
              fill="none" stroke={isConnectSource ? '#3b82f6' : '#6366f1'} strokeWidth={2.5}
              strokeDasharray={isConnectSource ? '6 3' : 'none'}
              transform={`rotate(45, ${node.x + w / 2}, ${node.y + h / 2})`} />
          ) : (
            <rect x={node.x - 4} y={node.y - 4} width={w + 8} height={h + 8} rx={14}
              fill="none" stroke={isConnectSource ? '#3b82f6' : '#6366f1'} strokeWidth={2.5}
              strokeDasharray={isConnectSource ? '6 3' : 'none'} />
          )
        )}

        {/* Connect target hint ring (dashed) */}
        {isConnectTarget && (
          node.shape === 'circle' ? (
            <circle cx={node.x + w / 2} cy={node.y + h / 2} r={w / 2 + 6}
              fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.4} />
          ) : (
            <rect x={node.x - 6} y={node.y - 6} width={w + 12} height={h + 12} rx={14}
              fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.4} />
          )
        )}

        {/* Node shape */}
        {node.shape === 'circle' ? (
          <circle cx={node.x + w / 2} cy={node.y + h / 2} r={w / 2}
            fill={node.color} stroke="#475569" strokeWidth={1.5} filter="url(#shadow)" />
        ) : node.shape === 'diamond' ? (
          <rect x={node.x} y={node.y} width={w} height={h} rx={4}
            fill={node.color} stroke="#475569" strokeWidth={1.5} filter="url(#shadow)"
            transform={`rotate(45, ${node.x + w / 2}, ${node.y + h / 2})`} />
        ) : (
          <rect x={node.x} y={node.y} width={w} height={h} rx={10}
            fill={node.color} stroke="#475569" strokeWidth={1.5} filter="url(#shadow)" />
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
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;
    const ux = dx / len;
    const uy = dy / len;

    const startDist = fromNode.shape === 'circle' ? 32 : 24;
    const endDist = toNode.shape === 'circle' ? 32 : 24;
    const x1 = from.cx + ux * startDist;
    const y1 = from.cy + uy * startDist;
    const x2 = to.cx - ux * endDist;
    const y2 = to.cy - uy * endDist;

    return (
      <g key={edge.id}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth={2} markerEnd="url(#arrowhead)" />
        {/* Wide invisible tap target for edge deletion */}
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="transparent" strokeWidth={20}
          style={{ cursor: 'pointer', touchAction: 'none' }}
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('この線を削除しますか？')) handleDeleteEdge(edge.id);
          }}
        />
        {edge.label && (
          <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle"
            className="text-[9px] font-bold fill-slate-500 pointer-events-none select-none">{edge.label}</text>
        )}
      </g>
    );
  };

  // Show action bar when a node is selected and nothing else is open
  const showActionBar = selectedNodeId !== null && !editNode && !connectFrom && !createMenu;
  const actionBarBottom = bottomInset + 24;
  const hintBottom = bottomInset + 96;

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-50">
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
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" fill="#64748b">
            <polygon points="0 0, 10 3.5, 0 7" />
          </marker>
          <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.08" />
          </filter>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.5" fill="#cbd5e1" />
          </pattern>
        </defs>

        {/* Grid background */}
        <rect x={viewBox.x - 1000} y={viewBox.y - 1000} width={viewBox.w + 2000} height={viewBox.h + 2000} fill="url(#grid)" />

        {/* Edges */}
        {diagram.edges.map(renderEdge)}

        {/* Nodes */}
        {diagram.nodes.map(renderNode)}
      </svg>

      {/* ── Connect mode banner ── */}
      {connectFrom && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-blue-500 text-white rounded-2xl shadow-xl px-5 py-3">
          <Link2 className="w-5 h-5" />
          <span className="text-sm font-bold">つなぐ先のブロックをタップ</span>
          <button
            onClick={() => setConnectFrom(null)}
            className="ml-2 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg active:scale-95 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Toolbar (top-left) ── */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="p-2.5 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 text-slate-500 hover:text-blue-500 disabled:opacity-30 active:scale-95 transition-all"
          title="元に戻す"
        >
          <Undo2 className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            const cx = viewBox.x + viewBox.w / 2;
            const cy = viewBox.y + viewBox.h / 2;
            handleCreateNode(cx, cy, 'box');
          }}
          className="p-2.5 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 text-slate-500 hover:text-blue-500 active:scale-95 transition-all"
          title="ブロック追加"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* ── Zoom (top-right) ── */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 z-20">
        <div className="bg-white/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 p-1 flex flex-col">
          <button onClick={() => zoom(0.8)} className="p-2.5 text-slate-500 hover:text-blue-500 rounded-lg active:scale-95 transition-all">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button onClick={() => zoom(1.25)} className="p-2.5 text-slate-500 hover:text-blue-500 rounded-lg active:scale-95 transition-all">
            <ZoomOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Hints ── */}
      {diagram.nodes.length === 0 && !createMenu && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200 px-5 py-3 text-center z-10"
          style={{ bottom: hintBottom }}
        >
          <p className="text-sm font-bold text-slate-600">
            空いてるところを <span className="text-blue-500">長押し</span> してブロックを追加！
          </p>
          <p className="text-xs text-slate-400 mt-1">または左上の ＋ ボタンをタップ</p>
        </div>
      )}

      {diagram.nodes.length > 0 && diagram.edges.length === 0 && !selectedNodeId && !connectFrom && !editNode && !createMenu && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-slate-200 px-5 py-3 text-center z-10 max-w-xs"
          style={{ bottom: hintBottom }}
        >
          <p className="text-xs font-bold text-slate-500">
            ブロックを <span className="text-blue-500">タップ</span> すると編集メニューが出るよ
          </p>
        </div>
      )}

      {/* ── Node Action Bar (bottom center, shown when a node is selected) ── */}
      {showActionBar && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white rounded-2xl shadow-xl border border-slate-200 px-2 py-2"
          style={{ bottom: actionBarBottom }}
        >
          <button
            onClick={() => {
              const node = diagram.nodes.find(n => n.id === selectedNodeId);
              if (node) setEditNode(node);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-blue-50 active:bg-blue-100 transition-colors"
          >
            <Edit2 className="w-4 h-4 text-blue-500" /> 編集
          </button>
          <div className="w-px h-6 bg-slate-200" />
          <button
            onClick={() => handleStartConnect(selectedNodeId!)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
          >
            <Link2 className="w-4 h-4 text-emerald-500" /> つなぐ
          </button>
          <div className="w-px h-6 bg-slate-200" />
          <button
            onClick={() => handleDeleteNode(selectedNodeId!)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> 削除
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {editNode && (
        <EditModal node={editNode} onSave={handleSaveEdit} onClose={() => setEditNode(null)} />
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
