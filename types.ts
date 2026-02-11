export interface GameState {
  virtualDepth: number;
  velocity: number;
  level: number;
  highScore: number;
}

export enum ResistanceType {
  STATIC = 'STATIC',
  ELASTIC = 'ELASTIC',
  GLITCH = 'GLITCH',
}

export interface SplitRecord {
  distanceCm: number;
  timeMs: number;
}