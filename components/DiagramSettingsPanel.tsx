import React from 'react';
import { Shuffle, Zap } from 'lucide-react';
import type { DiagramSettings } from '../types';

interface Props {
  settings: DiagramSettings;
  onChange: (s: DiagramSettings) => void;
  onRandomGenerate: () => void;
  isDev: boolean;
  isBeginner: boolean;
  creditCost: number;
}

const CX = [
  { value: 'simple' as const, label: 'シンプル', dev: 'Simple', cost: 1 },
  { value: 'standard' as const, label: 'ふつう', dev: 'Standard', cost: 1 },
  { value: 'complex' as const, label: 'くわしい', dev: 'Complex', cost: 3 },
];

const DIRS = [
  { value: 'auto' as const, label: '自動' },
  { value: 'TD' as const, label: '↓' },
  { value: 'LR' as const, label: '→' },
  { value: 'BT' as const, label: '↑' },
  { value: 'RL' as const, label: '←' },
];

const TYPES = [
  { value: 'auto' as const, label: '自動' },
  { value: 'flowchart' as const, label: 'フロー' },
  { value: 'sequence' as const, label: 'シーケンス' },
  { value: 'mindmap' as const, label: 'マインドマップ' },
  { value: 'gantt' as const, label: 'ガント' },
  { value: 'er' as const, label: 'ER図' },
  { value: 'class' as const, label: 'クラス図' },
];

const DiagramSettingsPanel: React.FC<Props> = ({ settings, onChange, onRandomGenerate, isDev, isBeginner, creditCost }) => {
  const u = (patch: Partial<DiagramSettings>) => onChange({ ...settings, ...patch });

  // ── Beginner: minimal row ──
  if (isBeginner) {
    return (
      <div className="flex items-center gap-1.5 px-1 py-1 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-full p-0.5 shadow-sm">
          {CX.map(o => (
            <button
              key={o.value}
              onClick={() => u({ complexity: o.value, useSubgraphs: o.value === 'complex' })}
              className={`px-2 py-1 text-[10px] font-bold rounded-full transition-all ${
                settings.complexity === o.value
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {o.label}
              {o.cost > 1 && <span className="ml-0.5 text-[8px] opacity-70">×{o.cost}</span>}
            </button>
          ))}
        </div>

        {/* Node count - compact */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full px-2 py-1 shadow-sm">
          <span className="text-[9px] text-slate-400">数:</span>
          <input
            type="range"
            min={3}
            max={20}
            value={settings.maxNodes}
            onChange={e => u({ maxNodes: Number(e.target.value) })}
            className="w-12 h-1 accent-blue-500"
          />
          <span className="text-[10px] font-bold text-blue-600 w-4 text-right">{settings.maxNodes}</span>
        </div>

        <button
          onClick={onRandomGenerate}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-full bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition-colors"
        >
          <Shuffle className="w-3 h-3" /> ランダム
        </button>

        {settings.complexity === 'complex' && (
          <span className="text-[9px] font-bold text-amber-600 flex items-center gap-0.5">
            <Zap className="w-3 h-3" /> ×{creditCost}
          </span>
        )}
      </div>
    );
  }

  // ── Developer: full settings ──
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 animate-in fade-in slide-in-from-bottom-2">
      {/* Complexity */}
      <div className="flex items-center gap-0.5 bg-[#1c2128] border border-[#30363d] rounded-lg p-0.5">
        {CX.map(o => (
          <button
            key={o.value}
            onClick={() => u({ complexity: o.value, useSubgraphs: o.value === 'complex' ? true : settings.useSubgraphs })}
            className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all font-mono ${
              settings.complexity === o.value
                ? 'bg-emerald-600 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {o.dev}
            {o.cost > 1 && <span className="ml-0.5 text-[8px] opacity-70">×{o.cost}</span>}
          </button>
        ))}
      </div>

      {/* Direction */}
      <div className="flex items-center gap-0.5 bg-[#1c2128] border border-[#30363d] rounded-lg p-0.5">
        {DIRS.map(d => (
          <button
            key={d.value}
            onClick={() => u({ direction: d.value })}
            className={`px-1.5 py-1 text-[10px] font-bold rounded-md transition-all ${
              settings.direction === d.value
                ? 'bg-cyan-600 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Type */}
      <select
        value={settings.diagramType}
        onChange={e => u({ diagramType: e.target.value as DiagramSettings['diagramType'] })}
        className="bg-[#1c2128] border border-[#30363d] text-slate-300 text-[10px] font-bold rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:border-emerald-500"
      >
        {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      {/* Node count */}
      <div className="flex items-center gap-1.5 bg-[#1c2128] border border-[#30363d] rounded-lg px-2 py-1">
        <span className="text-[9px] text-slate-500 font-mono">nodes:</span>
        <input
          type="range"
          min={4}
          max={25}
          value={settings.maxNodes}
          onChange={e => u({ maxNodes: Number(e.target.value) })}
          className="w-16 h-1 accent-emerald-500"
        />
        <span className="text-[10px] font-bold text-emerald-400 font-mono w-5 text-right">{settings.maxNodes}</span>
      </div>

      {/* Subgraph toggle */}
      <button
        onClick={() => u({ useSubgraphs: !settings.useSubgraphs })}
        className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all font-mono ${
          settings.useSubgraphs
            ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50'
            : 'bg-[#1c2128] text-slate-500 border-[#30363d] hover:text-slate-300'
        }`}
      >
        subgraph
      </button>

      {/* Random */}
      <button
        onClick={onRandomGenerate}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg bg-[#1c2128] text-cyan-400 border border-[#30363d] hover:border-cyan-500 transition-colors font-mono"
      >
        <Shuffle className="w-3 h-3" /> random()
      </button>

      {/* Cost indicator */}
      {settings.complexity === 'complex' && (
        <span className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5 font-mono">
          <Zap className="w-3 h-3" /> cost: {creditCost}
        </span>
      )}
    </div>
  );
};

export default DiagramSettingsPanel;
