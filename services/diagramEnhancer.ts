/**
 * Client-side diagram complexity enhancer & random graph generator.
 * Uses Barabási–Albert preferential attachment for realistic scale-free networks.
 * All processing is local → 0 AI tokens consumed.
 */

import type { DiagramSettings } from '../types';

// ── Label pools ──
const L = {
  proc: ['データ取得','認証','検証','ログ記録','キャッシュ確認','API呼出','DB書込','通知送信','バッチ処理','変換','フィルタ','集計','エクスポート','暗号化','監視','初期化','終了処理','リトライ','ロールバック','同期','レビュー','デプロイ','テスト','分析','最適化'],
  dec:  ['成功？','有効？','存在？','一致？','権限あり？','タイムアウト？','超過？','エラー？','完了？','承認？'],
  sg:   ['フロントエンド','バックエンド','データ層','認証系','通知系','管理','外部連携','監視系'],
  bProc:['はじまり','調べる','考える','作る','確認する','送る','待つ','受け取る','記録する','片付ける','準備','実行','報告','修正','完了','相談','計画','練習','発表','振り返り'],
  bDec: ['OK？','できた？','合ってる？','いい？','もう一回？'],
};

// ── Utilities ──
function nid(i: number): string {
  let s = '', n = i;
  do { s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}
function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function ri(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }

// ── Graph types ──
interface GNode { id: string; label: string; shape: 'box' | 'diamond' | 'round' | 'stadium'; degree: number; }
interface GEdge { from: string; to: string; label?: string; }

/**
 * Barabási–Albert preferential attachment graph.
 * Nodes with more connections attract even more connections → hub-spoke topology.
 */
function baGraph(count: number, labels: string[], dLabels: string[], withDec: boolean): { nodes: GNode[]; edges: GEdge[] } {
  const ns: GNode[] = [], es: GEdge[] = [];
  const sl = shuffle(labels), sd = shuffle(dLabels);
  let di = 0;

  // Seed: 2 connected nodes
  ns.push({ id: nid(0), label: sl[0], shape: 'box', degree: 1 });
  ns.push({ id: nid(1), label: sl[1 % sl.length], shape: 'box', degree: 1 });
  es.push({ from: nid(0), to: nid(1) });

  for (let i = 2; i < count; i++) {
    const isDec = withDec && Math.random() < 0.2 && di < sd.length;
    const label = isDec ? sd[di++] : sl[i % sl.length];
    const shape: GNode['shape'] = isDec ? 'diamond' : (['box', 'round', 'stadium'] as const)[ri(0, 2)];
    ns.push({ id: nid(i), label, shape, degree: 0 });

    // Preferential attachment: connect to existing nodes weighted by degree
    const totalD = ns.slice(0, i).reduce((s, n) => s + n.degree + 1, 0);
    const targets = new Set<number>();
    const eCnt = Math.min(i, isDec ? 1 : ri(1, 2));
    while (targets.size < eCnt) {
      let r = Math.random() * totalD;
      for (let j = 0; j < i; j++) {
        r -= ns[j].degree + 1;
        if (r <= 0) { targets.add(j); break; }
      }
    }
    for (const t of targets) {
      es.push({ from: ns[t].id, to: nid(i) });
      ns[t].degree++;
      ns[i].degree++;
    }
  }
  return { nodes: ns, edges: es };
}

/** Detect clusters via BFS from high-degree hub nodes */
function cluster(ns: GNode[], es: GEdge[], k: number): Map<string, number> {
  const hubs = [...ns].sort((a, b) => b.degree - a.degree).slice(0, k);
  const map = new Map<string, number>();
  hubs.forEach((h, i) => map.set(h.id, i));

  const adj = new Map<string, string[]>();
  ns.forEach(n => adj.set(n.id, []));
  es.forEach(e => { adj.get(e.from)?.push(e.to); adj.get(e.to)?.push(e.from); });

  for (const n of ns) {
    if (map.has(n.id)) continue;
    const vis = new Set([n.id]);
    const q = [n.id];
    let found = false;
    while (q.length && !found) {
      const c = q.shift()!;
      if (map.has(c) && c !== n.id) { map.set(n.id, map.get(c)!); found = true; break; }
      for (const nb of adj.get(c) || []) { if (!vis.has(nb)) { vis.add(nb); q.push(nb); } }
    }
    if (!found) map.set(n.id, 0);
  }
  return map;
}

/** Convert a graph node to Mermaid syntax */
function nStr(n: GNode): string {
  switch (n.shape) {
    case 'diamond': return `${n.id}{${n.label}}`;
    case 'round':   return `${n.id}((${n.label}))`;
    case 'stadium': return `${n.id}([${n.label}])`;
    default:        return `${n.id}[${n.label}]`;
  }
}

/** Build Mermaid code from graph */
function toMermaid(ns: GNode[], es: GEdge[], dir: string, useSg: boolean): string {
  const lines = [`graph ${dir}`];

  if (useSg && ns.length >= 6) {
    const k = Math.min(Math.floor(ns.length / 3), 4);
    const cl = cluster(ns, es, k);
    const groups = new Map<number, GNode[]>();
    ns.forEach(n => { const c = cl.get(n.id) ?? 0; if (!groups.has(c)) groups.set(c, []); groups.get(c)!.push(n); });
    let gi = 0;
    for (const [, gns] of groups) {
      lines.push(`  subgraph ${L.sg[gi++ % L.sg.length]}`);
      gns.forEach(n => lines.push(`    ${nStr(n)}`));
      lines.push('  end');
    }
  } else {
    ns.forEach(n => lines.push(`  ${nStr(n)}`));
  }

  es.forEach(e => {
    const arrow = e.label ? `-->|${e.label}|` : '-->';
    lines.push(`  ${e.from} ${arrow} ${e.to}`);
  });

  return lines.join('\n');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Public API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const DEFAULT_SETTINGS: DiagramSettings = {
  complexity: 'standard',
  direction: 'auto',
  diagramType: 'auto',
  maxNodes: 10,
  useSubgraphs: false,
};

/** Credit cost multiplier — complex mode uses 3× credits */
export function getCreditCost(s: DiagramSettings, isFile: boolean): number {
  if (isFile) return 7;
  return s.complexity === 'complex' ? 3 : 1;
}

/** Compact settings prefix for AI prompt — saves input tokens */
export function buildSettingsPrefix(s: DiagramSettings): string {
  const p: string[] = [];
  if (s.complexity === 'complex') p.push('詳細に');
  if (s.complexity === 'simple') p.push('シンプルに');
  if (s.direction !== 'auto') p.push(`方向:${s.direction}`);
  if (s.diagramType !== 'auto') p.push(`種類:${s.diagramType}`);
  if (s.maxNodes !== 10) p.push(`ノード${s.maxNodes}個`);
  if (s.useSubgraphs) p.push('subgraph使用');
  return p.length ? `[${p.join(',')}] ` : '';
}

/**
 * Generate a random diagram using graph theory (0 AI tokens).
 * Uses Barabási–Albert preferential attachment for realistic networks.
 */
export function generateRandomDiagram(s: DiagramSettings, beginner: boolean): string {
  const n = s.complexity === 'complex'
    ? Math.min(s.maxNodes, 20)
    : s.complexity === 'simple'
      ? Math.min(s.maxNodes, 6)
      : Math.min(s.maxNodes, 12);

  const labs = beginner ? L.bProc : L.proc;
  const decs = beginner ? L.bDec : L.dec;
  const dir = s.direction === 'auto' ? (Math.random() > 0.5 ? 'TD' : 'LR') : s.direction;
  const { nodes, edges } = baGraph(n, labs, decs, s.complexity !== 'simple');
  return toMermaid(nodes, edges, dir, s.useSubgraphs || s.complexity === 'complex');
}

/**
 * Enhance existing Mermaid code with more complexity (complex mode only).
 * Adds feedback loops, parallel paths, and error branches — all client-side.
 */
export function enhanceDiagram(code: string, s: DiagramSettings): string {
  if (s.complexity !== 'complex') return code;

  const nodeRe = /^\s*([A-Za-z_]\w*)\s*[\[\(\{]/;
  const nodes: string[] = [];
  for (const line of code.split('\n')) {
    const m = line.match(nodeRe);
    if (m && !nodes.includes(m[1])) nodes.push(m[1]);
  }
  if (nodes.length < 3) return code;

  const add: string[] = [];

  // Feedback loop
  if (nodes.length >= 4 && Math.random() > 0.3) {
    const last = nodes[nodes.length - 1];
    const target = nodes[ri(1, Math.min(3, nodes.length - 2))];
    add.push(`  ${last} -.->|フィードバック| ${target}`);
  }

  // Parallel path
  if (nodes.length >= 5 && Math.random() > 0.4) {
    const pid = `PAR${ri(1, 99)}`;
    const from = nodes[ri(0, Math.floor(nodes.length / 2))];
    const to = nodes[ri(Math.floor(nodes.length / 2) + 1, nodes.length - 1)];
    add.push(`  ${pid}([並行処理])`);
    add.push(`  ${from} --> ${pid}`);
    add.push(`  ${pid} --> ${to}`);
  }

  // Error handling branch
  if (nodes.length >= 4 && Math.random() > 0.5) {
    const eid = `ERR${ri(1, 99)}`;
    const src = nodes[ri(1, nodes.length - 1)];
    add.push(`  ${eid}{エラー？}`);
    add.push(`  ${src} --> ${eid}`);
    add.push(`  ${eid} -->|はい| ${nodes[0]}`);
  }

  return add.length ? code + '\n' + add.join('\n') : code;
}
