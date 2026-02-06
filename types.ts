
export interface DiagramVersion {
  id: string;
  code: string;
  prompt: string;
  timestamp: number;
}

export interface DiagramHistory {
  id: string;
  title: string;
  versions: DiagramVersion[];
  timestamp: number;
}

export type AppState = 'idle' | 'generating' | 'editing' | 'error';

export interface DiagramTemplate {
  name: string;
  prompt: string;
  icon: string;
}

// ── Beginner Visual Canvas types ──

export interface VisualNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  shape: 'box' | 'circle' | 'diamond';
  emoji?: string;
}

export interface VisualEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface VisualDiagram {
  nodes: VisualNode[];
  edges: VisualEdge[];
}
