
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
