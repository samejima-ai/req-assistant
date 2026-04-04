/**
 * llmConfig
 *
 * 責務: 利用可能なモデルとプロバイダーの定義
 *
 * 非エンジニア向けに「各モデルが何に強いか」を定義します。
 *
 * !! 重要: モデルIDは各プロバイダーの公式ドキュメントで確認してください !!
 * - Google:    https://ai.google.dev/gemini-api/docs/models
 * - OpenAI:    https://platform.openai.com/docs/models
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/models
 *
 * 最終更新: 2026-04-04 (Gemini 3.1 Preview 対応)
 */

export const PROVIDERS = {
  GOOGLE: "google",
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
};

export const MODEL_TIERS = {
  FAST: "fast", // 速さ・安さ優先 (インテント分析向き)
  STANDARD: "standard", // バランス重視
  THINKING: "thinking", // 思考・論理重視 (要件抽出・レビュー向き)
};

export const MODEL_LIST = [
  // ────────────── Google Gemini 3 / 3.1 Preview ──────────────
  {
    id: "gemini-3-flash-preview",
    provider: PROVIDERS.GOOGLE,
    name: "Gemini 3 Flash (Preview)",
    tier: MODEL_TIERS.STANDARD,
    description:
      "標準的な最高性能モデル。2025.01カットオフ。要件定義からレビューまで幅広く推奨。",
    isDefault: true,
  },
  {
    id: "gemini-3.1-flash-lite-preview",
    provider: PROVIDERS.GOOGLE,
    name: "Gemini 3.1 Flash Lite (Preview)",
    tier: MODEL_TIERS.FAST,
    description:
      "爆速・安価な最新モデル。100万トークンの入力が可能。インテント分析に最適。",
  },
  {
    id: "gemini-3.1-pro-preview",
    provider: PROVIDERS.GOOGLE,
    name: "Gemini 3.1 Pro (Preview)",
    tier: MODEL_TIERS.THINKING,
    description:
      "100万トークンの巨大コンテキスト。複雑な論理構造の組み立てや大規模コード分析に。",
  },
  {
    id: "gemini-3.1-flash-image-preview",
    provider: PROVIDERS.GOOGLE,
    name: "Gemini 3.1 Flash Image (Preview)",
    tier: MODEL_TIERS.STANDARD,
    description: "テキスト入力に加え、画像の出力を伴うクリエイティブな提案に。",
  },

  // ────────────── OpenAI GPT-5.4 ──────────────
  {
    id: "gpt-5.4-mini",
    provider: PROVIDERS.OPENAI,
    name: "GPT-5.4 Mini",
    tier: MODEL_TIERS.FAST,
    description: "高い知能を保ちつつ、軽快に動作します。",
  },
  {
    id: "gpt-5.4",
    provider: PROVIDERS.OPENAI,
    name: "GPT-5.4",
    tier: MODEL_TIERS.THINKING,
    description: "OpenAIの最上位モデル。最高精度の推論とコーディング。",
  },

  // ────────────── Anthropic Claude 4.6 ──────────────
  {
    id: "claude-sonnet-4-6",
    provider: PROVIDERS.ANTHROPIC,
    name: "Claude 4.6 Sonnet",
    tier: MODEL_TIERS.STANDARD,
    description: "自然な対話と的確な論理構成。コーディングにも非常に強い。",
  },
  {
    id: "claude-opus-4-6",
    provider: PROVIDERS.ANTHROPIC,
    name: "Claude 4.6 Opus",
    tier: MODEL_TIERS.THINKING,
    description: "最高レベルの論理性。非常に複雑なシステム設計向き。",
  },
];

// フェーズ（処理パート）の定義
export const PHASES = {
  INTENT: {
    id: "intent",
    label: "インテント分析（意図の把握）",
    description: "ユーザーが「何をしたいか」を瞬時に判断するフェーズ。",
    recommendedTier: MODEL_TIERS.FAST,
  },
  EXTRACT: {
    id: "extract",
    label: "設計図生成（ノード・エッジ抽出）",
    description: "要件を構造化し、ノードとエッジを生成するフェーズ。",
    recommendedTier: MODEL_TIERS.THINKING,
  },
  DOC: {
    id: "doc",
    label: "要件定義書作成（ドキュメント化）",
    description: "会話と設計図からMarkdown要件定義書を構成するフェーズ。",
    recommendedTier: MODEL_TIERS.STANDARD,
  },
  REVIEW: {
    id: "review",
    label: "AIレビュー（整合性チェック）",
    description: "設計図の矛盾や漏れをチェックするフェーズ。",
    recommendedTier: MODEL_TIERS.STANDARD,
  },
};
