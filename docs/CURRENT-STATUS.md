# CURRENT STATUS — req-assistant

最終更新: 2026-04-04（モバイルUI最適化 Phase 2・凡例メニュー統合・FAB刷新）

---

## プロジェクト概要

あらゆる要件やアイデアを可視化する設計プラットフォーム **「Vibe Architect（雰囲気設計）」**。  
ユーザーが自由な形式で「やりたいこと」を伝えると、AIがノード/エッジを抽出しビジュアルボード上に可視化。  
会話・図・要件定義書・ワイヤーフレームが連動し、直感的な設計体験を提供する。

---

## 技術スタック

| カテゴリ       | 技術        | バージョン                            |
| -------------- | ----------- | ------------------------------------- |
| UI             | React       | 19.2.4                                |
| ビルド         | Vite        | 8.0.1                                 |
| スタイル       | TailwindCSS | 4.2.2                                 |
| グラフ描画     | ReactFlow   | 11.11.4                               |
| 図表生成       | Mermaid     | 11.14.0                               |
| レイアウト計算 | Dagre       | 3.0.0                                 |
| Markdown変換   | Marked      | 17.0.5                                |
| AI             | Gemini API  | (gemini-2.5-flash / gemini-2.0-flash) |

---

## 実装済み機能

### コア機能

- **Vibeチャット** — `Ctrl+Enter` 送信・複数行入力対応。下書き感覚でラフな要件を流し込める。
- **ReactFlowビジュアルボード** — 4ノードタイプ + 4エッジタイプ。
- **手動編集機能** — ノード/エッジの右クリックメニュー（削除・種別変更）、新規エッジの種別選択。
- **自動レイアウト** — dagre による自動配置（手動ドラッグ保持）。

### AI生成・レビュー機能

- **インテント前処理** — チャット送信前に軽量モデルでユーザー入力を分析し、操作インテント・ドメイン・曖昧度スコアをチャットAPIへのコンテキストとして付与する。曖昧度が高い場合は逆質問を優先するよう動的に制御。
- **グラフ状態Context注入** — チャット送信時に現在のノード/エッジ（ラベル・説明・型・フロー構造）を構造化テキストとして Gemini に渡す。会話ターンが増えても設計図の一貫性を維持。
- **処理ステータス表示** — ローディング中に「インテントを分析中...」→「設計図を生成中...」のフェーズテキストをリアルタイム表示。
- **要件定義書の自動生成** — 会話からバックグラウンドでMarkdownドキュメントを随時更新。
- **アクション連動型レビュー** — AIレビュー（整合性・曖昧さ）の結果（推奨アクション）を**ワンクリックでチャットに流し込み**、再入力を加速させる。
- **A+Bハイブリッド複雑性判定**
  - A（ルールベース）: ノード数・エッジ数・ターン数から算出。
  - B（意味判定）: 曖昧な場合にAIがTierを動的選択。

### 可視化機能

- **Mermaidプレビュー**（CanvasPane 右ペイン）
  - 画面遷移図（stateDiagram-v2）: UI_Component / Actor / Action から生成
  - ER図（erDiagram）: Data_Entity から生成
  - SVG直接埋め込み + ノードクリックでインライン編集（双方向編集）
  - Mermaidコード表示切替対応
- **ワイヤーフレームプレビュー** — UI_Component から簡易HTMLプロトタイプ生成

### エクスポート機能（ExportModal）

- **構造化JSON** — nodes/edges の構造化データ
- **要件定義書** — Markdown テキスト
- **MP出力（Manifest Prompt）** — 要件定義書 + **ノード・エッジ一覧（ラベル・説明・型）** + 画面フロー図 + ER図 + 技術制約を1テキストで結合・コピー

### その他

- **プロジェクト永続化** — localStorage に自動保存・リロード後復元
- **ペイン幅調整** — 左右ペイン比率を手動調整・保存
- **カスタムプロンプト対応** — PromptRegistry でlocalStorageから動的切替
- **Gemini APIキー設定UI** — 初回アクセス時のキー入力モーダル、疎通確認（テスト実行）、永続化（localStorage/sessionStorage）の選択に対応。Vercelデプロイ時のアクセシビリティを向上。

### モバイル最適化（Phase 2）

- **サイバー風グラデーションFAB** — メニューボタンを **右上** (`top-4 right-4`) に配置された円形グラデーションFAB（Floating Action Button）に刷新。設定・エクスポート機能をスマートに集約。
- **独立した凡例・エッジ選択ボタン** — 凡例・接続種別選択メニューを、キャンバス **右下** の独立したボタンに配置。ポップオーバー形式で開閉可能にし、キャンバス作業領域を大幅に拡張。
- **レスポンシブ・ツールバー** — モバイル時にはツールバーボタンをアイコンのみの円形ボタンに自動変換。画面上部でFABと重ならないよう位置を自動調整。
- **サイドパネル全画面対応** — モバイル時に右パネル（要件定義・レビューなど）を全画面表示にするよう最適化。

---

## アーキテクチャ

### ARC原則に基づいた責務分離

```text
src/
├── hooks/          # 状態管理・副作用
│   ├── useCanvasStore.js        # ノード/エッジ SSOT
│   ├── useChatSession.js        # 会話状態 + thinkingStatus
│   ├── useAgentOrchestrator.js  # LLM副作用の集約
│   ├── useMermaidDiagram.js     # Mermaid図非同期生成
│   ├── useWireframe.js          # ワイヤーフレーム生成
│   ├── useAutoLayout.js         # 自動レイアウト
│   ├── useConsistencyCheck.js   # グラフ整合性チェック
│   ├── usePaneResize.js         # ペイン幅管理
│   └── useProjectStorage.js    # localStorage永続化
├── services/       # API通信・計算
│   ├── configService.js         # APIキー管理（Local/Session/Env）
│   ├── geminiService.js         # チャット + グラフ抽出（グラフ状態Context注入・onStatus対応）
│   ├── intentService.js         # インテント分析・メッセージ付与
│   ├── requirementDocService.js # 要件定義書生成
│   ├── reviewService.js         # レビュー生成
│   ├── complexityAssessor.js    # A+Bハイブリッド複雑性判定
│   ├── geminiClient.js          # 共通HTTPクライアント
│   └── geminiConfig.js          # モデル設定一元管理
├── utils/          # 純粋計算（副作用なし）
│   ├── layoutUtils.js           # dagre レイアウト計算
│   ├── wireframeGenerator.js    # ワイヤーフレームHTML生成
│   ├── mermaidFlowGenerator.js  # 画面遷移図生成
│   └── mermaidErGenerator.js    # ER図生成
├── types/          # 型定義
│   ├── result.js                # Result<T> = Success | Failure
│   ├── systemContext.js         # SystemContext集約（serializeDomainForPromptをgeminiService/ExportModalで共用）
│   └── index.js                 # JSDoc型定義
├── prompts/        # AIプロンプト管理
│   ├── index.js                 # PromptRegistry（intent登録済み）
│   ├── intent.prompt.js         # インテント分析プロンプト
│   ├── chat.prompt.js
│   ├── requirementDoc.prompt.js
│   └── review.prompt.js
└── components/     # UIコンポーネント
    ├── ChatPane.jsx             # 設定ボタン追加
    ├── CanvasPane.jsx
    ├── ExportModal.jsx          # MP出力にノード・エッジ一覧追加
    ├── ApiKeyModal.jsx          # APIキー設定・疎通確認
    ├── nodes/      # ActorNode / UIComponentNode / DataEntityNode / ActionNode
    └── edges/      # TransitionEdge / DataFlowEdge / ActionEdge
```

### 主要設計原則

| 原則         | 実装                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| **SSOT**     | `useCanvasStore` が nodes/edges の唯一の管理元                                |
| **SRP**      | hooks（状態）/ services（副作用）/ utils（純粋計算）で完全分離                |
| **CDD**      | `SystemContext` が全AI呼び出しの統一入力インターフェース                      |
| **Result型** | `{ ok: true, value }` or `{ ok: false, code, message, retryable }` で例外レス |

---

## 環境変数

`.env.local` に設定（`.env.example` 参照）:

```text
VITE_GEMINI_API_KEY=         # Gemini API キー（必須。UIからも設定可能）
VITE_GEMINI_MODEL_INTENT=    # インテント分析モデル（省略可、default: gemini-2.0-flash-lite）
VITE_GEMINI_MODEL_CHAT=      # チャットモデル（省略可）
VITE_GEMINI_MODEL_DOC=       # 要件書生成モデル（省略可）
VITE_GEMINI_MODEL_REVIEW=    # レビューモデル（省略可）
```

APIキー未設定でもUIの「設定」から入力することでアプリ動作可能（localStorage/sessionStorageに保持）。

---

## 開発サーバー起動

```bash
npm install
npm run dev
# → http://localhost:5173
```

Node.js 20.19+ または 22.12+ が必要（22.11.0 は非対応）。

---

## コミット履歴

| コミット  | 内容                                                                              |
| --------- | --------------------------------------------------------------------------------- |
| `f02dfd3` | Initial commit: req-assistant α版                                                 |
| `ccee086` | refactor: meta-architecture overhaul (Phase 1+2+3)                                |
| `95bc3e6` | Merge PR #1: feature/meta-architecture-refactor                                   |
| `2ed99d9` | feat: Mermaidダイアグラムプレビュー + MP出力機能を追加                            |
| `b88e523` | fix: PR #2 レビュー指摘7件を修正                                                  |
| `b82504a` | Merge PR #2: feature/mermaid-diagram-preview                                      |
| `current` | feat: Vibe Architect ブランディング & チャットUX改善                              |
| `current` | feat: エッジの手動編集（右クリックメニュー・種別切替）                            |
| `current` | feat: レビュー結果のチャット流し込みボタン機能                                    |
| `current` | fix: Mermaid双方向編集 — data-node-id属性注入によるSVGクリック識別安定化          |
| `current` | feat: インテント前処理 — ユーザー入力の操作インテント・ドメイン・曖昧度を事前分析 |
| `current` | feat: グラフ状態Context注入 — 現在のノード/エッジ構造をGeminiに渡し一貫性を向上   |
| `current` | feat: 処理ステータス表示 — チャット待機中に処理フェーズテキストを表示             |
| `current` | feat: MP出力にノード・エッジ一覧（ラベル・説明・型）を追加                        |
| `current` | feat: Gemini APIキー設定UI (ApiKeyModal) & configService 実装                     |
| `current` | feat: Vercelデプロイ対応 — ブラウザ側でのAPIキー設定・永続化をサポート            |
| `f23822a` | fix: resolve whiteout and flickering when copying MP in ExportModal               |
| `8089bc7` | fix: move FAB to left and legend to right on mobile to avoid send button overlap  |
| `f36b104` | feat: integrate canvas legend into collapsible toolbar menu                       |
| `current` | docs: update README and CURRENT-STATUS for Mobile UI Optimization Phase 2         |

---

## 既知の制限・今後の課題

- インテント前処理により1ターンあたり最大+10秒のレイテンシが加算される（タイムアウト上限）
- チャンクサイズ警告あり（mermaid + reactflow で500KB超）→ dynamic import による分割が推奨
- Node.js 22.11.0 は非対応（22.12+ 推奨）
