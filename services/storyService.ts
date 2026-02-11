import { GuardianResponse } from '../types';
import storyData from '../story.json';

/**
 * ストーリーデータ。
 * 一見すると普通のシステムログに見えるが、
 * よく読むと徐々に異常が滲み出てくる。
 * 
 * story.json を編集することでメッセージと表示位置をカスタマイズ可能
 */

interface StoryEntry {
  depthCm: number; // この深さ（cm）以上で表示
  message: string;
  mood: GuardianResponse['mood'];
}

const STORY: StoryEntry[] = storyData as StoryEntry[];

// ストーリーは深さ順にソート済み（降順で検索するため逆順にしておく）
const STORY_DESC = [...STORY].sort((a, b) => b.depthCm - a.depthCm);

/**
 * 現在の深さに対応するストーリーエントリを返す。
 * APIは使わず、事前定義されたストーリーデータから取得する。
 */
export const getStoryEntry = (depthInCm: number): GuardianResponse => {
  const entry = STORY_DESC.find(e => depthInCm >= e.depthCm);
  if (entry) {
    return { message: entry.message, mood: entry.mood };
  }
  return { message: "YOU SHALL NOT SCROLL.", mood: 'neutral' };
};

/**
 * 次のストーリーエントリまでの距離（cm）を返す。UI表示用。
 */
export const getNextStoryDepthCm = (depthInCm: number): number | null => {
  const next = STORY.find(e => e.depthCm > depthInCm);
  return next ? next.depthCm : null;
};

/**
 * 全ストーリーエントリ数を返す。
 */
export const getTotalStoryEntries = (): number => STORY.length;

/**
 * 現在何番目のエントリまで到達しているかを返す。
 */
export const getCurrentStoryIndex = (depthInCm: number): number => {
  let count = 0;
  for (const entry of STORY) {
    if (depthInCm >= entry.depthCm) count++;
    else break;
  }
  return count;
};
