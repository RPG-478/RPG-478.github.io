/**
 * mermaidBridge.ts
 * Mermaid code ↔ VisualDiagram の相互変換
 * ビギナーモードのキャンバスとMermaidコードの橋渡し
 */

import { VisualNode, VisualEdge, VisualDiagram } from '../types';

const NODE_COLORS = [
  '#f9a8d4', // pink
  '#93c5fd', // blue
  '#86efac', // green
  '#fcd34d', // yellow
  '#c4b5fd', // purple
  '#fdba74', // orange
  '#67e8f9', // cyan
  '#fca5a5', // red
];

let colorIndex = 0;
function nextColor(): string {
  const c = NODE_COLORS[colorIndex % NODE_COLORS.length];
  colorIndex++;
  return c;
}

/**
 * Mermaidコードをパースして VisualDiagram に変換
 * graph TD / graph LR 形式のフローチャートに対応
 */
export function parseMermaidToVisual(code: string): VisualDiagram {
  const nodes: VisualNode[] = [];
  const edges: VisualEdge[] = [];
  const nodeMap = new Map<string, VisualNode>();
  colorIndex = 0;

  const lines = code.split('\n');

  // ノード定義・接続を解析
  for (const line of lines) {
    const trimmed = line.trim();

    // Skip graph declaration, subgraph, end, style, etc.
    if (/^(graph|subgraph|end|style|classDef|class|%%|$)/.test(trimmed)) continue;

    // Parse connections: A[Label] --> B[Label]
    // Also: A --> B, A -->|text| B, A[Label] -->|text| B[Label]
    const connRegex = /([A-Za-z0-9_]+)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|\(\(([^)]*)\)\))?\s*(-->|---|-\.->|==>)(?:\|([^|]*)\|)?\s*([A-Za-z0-9_]+)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|\(\(([^)]*)\)\))?/;
    const match = trimmed.match(connRegex);

    if (match) {
      const [, fromId, fromBox, fromRound, fromDia, fromCirc, , edgeLabel, toId, toBox, toRound, toDia, toCirc] = match;

      const fromLabel = fromBox || fromRound || fromDia || fromCirc || fromId;
      const toLabel = toBox || toRound || toDia || toCirc || toId;
      const fromShape = fromDia ? 'diamond' : (fromCirc || fromRound) ? 'circle' : 'box';
      const toShape = toDia ? 'diamond' : (toCirc || toRound) ? 'circle' : 'box';

      if (!nodeMap.has(fromId)) {
        const node: VisualNode = {
          id: fromId, label: fromLabel, x: 0, y: 0,
          color: nextColor(), shape: fromShape
        };
        nodeMap.set(fromId, node);
        nodes.push(node);
      } else {
        // Update label if provided
        if (fromLabel !== fromId) {
          nodeMap.get(fromId)!.label = fromLabel;
        }
      }

      if (!nodeMap.has(toId)) {
        const node: VisualNode = {
          id: toId, label: toLabel, x: 0, y: 0,
          color: nextColor(), shape: toShape
        };
        nodeMap.set(toId, node);
        nodes.push(node);
      } else {
        if (toLabel !== toId) {
          nodeMap.get(toId)!.label = toLabel;
        }
      }

      edges.push({
        id: `e-${fromId}-${toId}`,
        from: fromId,
        to: toId,
        label: edgeLabel || undefined
      });
      continue;
    }

    // Standalone node: A[Label]
    const nodeRegex = /^([A-Za-z0-9_]+)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|\(\(([^)]*)\)\))$/;
    const nodeMatch = trimmed.match(nodeRegex);
    if (nodeMatch) {
      const [, id, box, round, dia, circ] = nodeMatch;
      const label = box || round || dia || circ || id;
      const shape = dia ? 'diamond' : (circ || round) ? 'circle' : 'box';
      if (!nodeMap.has(id)) {
        const node: VisualNode = { id, label, x: 0, y: 0, color: nextColor(), shape };
        nodeMap.set(id, node);
        nodes.push(node);
      }
    }
  }

  // Auto-layout: simple top-down grid
  autoLayout(nodes, edges);

  return { nodes, edges };
}

/**
 * VisualDiagram → Mermaid code
 */
export function visualToMermaid(diagram: VisualDiagram): string {
  const lines: string[] = ['graph TD'];

  // Emit node definitions
  for (const node of diagram.nodes) {
    const label = node.label || node.id;
    if (node.shape === 'diamond') {
      lines.push(`  ${node.id}{${label}}`);
    } else if (node.shape === 'circle') {
      lines.push(`  ${node.id}((${label}))`);
    } else {
      lines.push(`  ${node.id}[${label}]`);
    }
  }

  // Emit edges
  for (const edge of diagram.edges) {
    if (edge.label) {
      lines.push(`  ${edge.from} -->|${edge.label}| ${edge.to}`);
    } else {
      lines.push(`  ${edge.from} --> ${edge.to}`);
    }
  }

  // Emit style
  for (const node of diagram.nodes) {
    lines.push(`  style ${node.id} fill:${node.color},stroke:#333,stroke-width:1px,color:#333`);
  }

  return lines.join('\n');
}

/**
 * Simple auto-layout algorithm
 * BFS-based layered layout
 */
function autoLayout(nodes: VisualNode[], edges: VisualEdge[]): void {
  if (nodes.length === 0) return;

  const CELL_W = 160;
  const CELL_H = 100;
  const PADDING_X = 40;
  const PADDING_Y = 40;

  // Build adjacency
  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  for (const n of nodes) {
    children.set(n.id, []);
    parents.set(n.id, []);
  }
  for (const e of edges) {
    children.get(e.from)?.push(e.to);
    parents.get(e.to)?.push(e.from);
  }

  // Find roots (no parents)
  const roots = nodes.filter(n => (parents.get(n.id)?.length ?? 0) === 0);
  if (roots.length === 0) roots.push(nodes[0]);

  // BFS layers
  const layerMap = new Map<string, number>();
  const queue = roots.map(r => r.id);
  for (const r of queue) layerMap.set(r, 0);

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const currLayer = layerMap.get(curr)!;
    for (const child of (children.get(curr) || [])) {
      if (!layerMap.has(child)) {
        layerMap.set(child, currLayer + 1);
        queue.push(child);
      }
    }
  }

  // Assign remaining unvisited
  for (const n of nodes) {
    if (!layerMap.has(n.id)) layerMap.set(n.id, 0);
  }

  // Group by layer
  const layers = new Map<number, VisualNode[]>();
  for (const n of nodes) {
    const layer = layerMap.get(n.id) || 0;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(n);
  }

  // Position
  const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);
  for (const layerIdx of sortedLayers) {
    const layerNodes = layers.get(layerIdx)!;
    const totalWidth = layerNodes.length * CELL_W;
    const startX = PADDING_X + (layerNodes.length > 1 ? 0 : CELL_W / 2);

    layerNodes.forEach((node, i) => {
      node.x = PADDING_X + i * CELL_W + (CELL_W - 120) / 2;
      node.y = PADDING_Y + layerIdx * CELL_H;
    });
  }
}

/**
 * Create a fresh empty diagram with one node
 */
export function createEmptyDiagram(): VisualDiagram {
  colorIndex = 0;
  return {
    nodes: [{
      id: 'A',
      label: 'ここから',
      x: 140,
      y: 60,
      color: '#f9a8d4',
      shape: 'box'
    }],
    edges: []
  };
}

/**
 * Generate a unique node ID
 */
export function generateNodeId(existing: VisualNode[]): string {
  const used = new Set(existing.map(n => n.id));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const c of chars) {
    if (!used.has(c)) return c;
  }
  // Fallback
  let i = 1;
  while (used.has(`N${i}`)) i++;
  return `N${i}`;
}
