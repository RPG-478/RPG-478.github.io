
import React from 'react';
import { Layout, Server, Cloud, GitBranch, Database, UserCheck, Box, Workflow, Square, ArrowRight, Diamond, Layers, MessageSquare, Database as DbIcon, Type, Repeat, ListTree, Calendar, Users, Share2, Milestone, BrainCircuit, Clock } from 'lucide-react';
import { DiagramTemplate } from './types';

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    name: '3層ウェブアプリ',
    prompt: 'Webサイトの構成図。フロントエンド、サーバー、データベースの3つを繋げて。',
    icon: 'Layout'
  },
  {
    name: 'プロジェクト工程表',
    prompt: '2024年4月のガントチャート。要件定義(1週)、開発(2週)、テスト(1週)のスケジュール。',
    icon: 'Calendar'
  },
  {
    name: 'データベース設計 (ER図)',
    prompt: 'ECサイトのER図。ユーザー、注文、商品のテーブルとそれらのリレーションシップ。',
    icon: 'Database'
  },
  {
    name: 'アイデア整理 (マインドマップ)',
    prompt: '「新商品の企画」をテーマにしたマインドマップ。ターゲット、機能、価格、集客の4軸。',
    icon: 'BrainCircuit'
  },
  {
    name: '歴史・タイムライン',
    prompt: '会社の沿革タイムライン。2010年創業、2015年上場、2020年海外進出、2024年現在。',
    icon: 'Clock'
  },
  {
    name: 'ユーザーの行動 (旅程図)',
    prompt: 'ユーザーが広告を見てから購入に至るまでのユーザージャーニーマップ。',
    icon: 'Milestone'
  },
  {
    name: '社内承認フロー',
    prompt: '社員が申請し、課長が承認、さらに部長が承認して完了する流れ図。',
    icon: 'Workflow'
  }
];

// Beta feedback
export const REVIEW_URL = 'https://github.com/RPG-478/RPG-478.github.io/issues';

/** ビギナー向けテンプレート（ビジネス用語なし・身近な内容） */
export const BEGINNER_TEMPLATES: DiagramTemplate[] = [
  {
    name: '料理の手順 🍳',
    prompt: 'カレーライスの作り方をフローチャートにして。材料を切る→炒める→煮込む→ルーを入れる→盛り付け。',
    icon: 'Workflow'
  },
  {
    name: '歴史の人物関係 📜',
    prompt: '戦国時代の織田信長・豊臣秀吉・徳川家康の関係図。誰が誰に仕えた、誰が後を継いだ、など。',
    icon: 'Users'
  },
  {
    name: '1日のスケジュール ⏰',
    prompt: '学生の1日の流れ。起床→朝食→通学→授業→昼食→部活→帰宅→夕食→勉強→就寝のタイムライン。',
    icon: 'Clock'
  },
  {
    name: '旅行のプラン ✈️',
    prompt: '京都日帰り旅行の計画。朝に出発→嵐山→昼食→金閣寺→買い物→夕食→帰宅の流れ図。',
    icon: 'Milestone'
  },
  {
    name: '自己紹介マップ 🌟',
    prompt: '自己紹介のマインドマップ。中心に名前、そこから趣味・好きな食べ物・得意なこと・将来の夢の4つ。',
    icon: 'BrainCircuit'
  },
  {
    name: '部活の組織図 🏫',
    prompt: '部活動の組織図。顧問の先生→部長→副部長→各パートリーダー→部員の構造。',
    icon: 'Layout'
  },
];

export const SNIPPETS = [
  { id: 'start-flow', label: 'フローチャート', code: 'graph TD\n  ', icon: <Layout size={16} />, category: 'starter' },
  { id: 'start-seq', label: 'やり取りの図', code: 'sequenceDiagram\n  ', icon: <Repeat size={16} />, category: 'starter' },
  { id: 'start-mind', label: 'マインドマップ', code: 'mindmap\n  root((中心テーマ))\n    ', icon: <BrainCircuit size={16} />, category: 'starter' },
  { id: 'start-gantt', label: 'ガントチャート', code: 'gantt\n  title スケジュール\n  dateFormat YYYY-MM-DD\n  section 工程1\n    タスク :a1, 2024-01-01, 30d', icon: <Calendar size={16} />, category: 'starter' },
  
  { id: 'node', label: 'ボックス', code: 'A[名前]', icon: <Square size={16} />, category: 'part' },
  { id: 'db', label: 'データベース', code: 'db[(データベース)]', icon: <DbIcon size={16} />, category: 'part' },
  { id: 'arrow', label: '矢印で繋ぐ', code: ' --> ', icon: <ArrowRight size={16} />, category: 'part' },
  { id: 'decision', label: 'はい/いいえ', code: 'dec{条件}', icon: <Diamond size={16} />, category: 'part' },
];

export const SYSTEM_PROMPT = `
あなたはMermaid.jsコード生成に特化した高速AIアシスタントです。
解説や\`\`\`mermaid\`\`\`囲みは一切不要です。Mermaidコードのみを直接出力してください。

最優先事項：
1. 即座にMermaidコードのみを出力する。
2. 日本語ラベルを使用する。
3. 複雑すぎる装飾を避け、構造を明快にする。
4. ガントチャート、ER図、マインドマップ、フロー、シーケンスに対応する。

文法上の重要ルール（エラー防止）：
- Ganttチャートでは必ず \`dateFormat YYYY-MM-DD\` を指定し、日付は必ず \`2024-01-01\` の形式を使用してください。'q1_1' のような独自形式や不正な日付文字列は絶対に使用しないでください。
- タイムライン (timeline) でも有効な日付または文字列のみを使用してください。
- 接続は \`-->\` または \`--- \` を使用してください。

指示に忠実かつ迅速に応答してください。
`;
