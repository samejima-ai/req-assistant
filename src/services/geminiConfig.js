/**
 * geminiConfig
 *
 * 責務: Gemini APIのモデルID・thinking設定・複雑性判定閾値を一元管理
 *
 * 環境変数で上書き可能。省略時は以下のデフォルト値を使用する:
 *   chat / doc  → gemini-3.1-flash-lite-preview (Tier1: 低コスト・高頻度)
 *   reviewLight → gemini-3-flash-preview        (Tier2: バランス型)
 *   reviewHeavy → gemini-3.1-pro-preview        (Tier3: 高精度推論)
 */

export const MODELS = {
  intent:      import.meta.env.VITE_GEMINI_MODEL_INTENT       ?? 'gemini-2.0-flash-lite',
  chat:        import.meta.env.VITE_GEMINI_MODEL_CHAT         ?? 'gemini-3.1-flash-lite-preview',
  doc:         import.meta.env.VITE_GEMINI_MODEL_DOC          ?? 'gemini-3.1-flash-lite-preview',
  reviewLight: import.meta.env.VITE_GEMINI_MODEL_REVIEW_LIGHT ?? 'gemini-3-flash-preview',
  reviewHeavy: import.meta.env.VITE_GEMINI_MODEL_REVIEW_HEAVY ?? 'gemini-3.1-pro-preview',
};

export const THINKING = {
  intent:      'minimal',  // インテント分析は最小コスト（高速・低コスト優先）
  chat:        import.meta.env.VITE_GEMINI_THINKING_CHAT   ?? 'low',
  doc:         import.meta.env.VITE_GEMINI_THINKING_DOC    ?? 'medium',
  reviewLight: import.meta.env.VITE_GEMINI_THINKING_REVIEW ?? 'medium',
  reviewHeavy: 'high',
  complexity:  'minimal',  // 複雑性判定は常に最小コスト
};

// A+Bハイブリッド複雑性判定の閾値
// score < simple  → Tier2確定
// score >= complex → Tier3確定
// それ以外 → B（軽量モデル判定）へ
export const COMPLEXITY_THRESHOLDS = { simple: 10, complex: 20 };
