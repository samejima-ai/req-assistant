# CURRENT-STATUS (req-assistant)

最終更新: 2026-04-01

## 1. プロジェクト概要
**要件定義アシスタント (req-assistant)** は、AI（Gemini）との対話を通じて、アプリケーションの基本設計（フロー、データ構造、UI構成）と詳細な要件定義書を同時に構築・ブラッシュアップするための「AIネイティブ設計プラットフォーム」です。

## 2. 実装済み主要機能

### A. AI設計コア
- **インタラクティブ・キャンバス**: 会話から自動的にノード（Actor, UI, Action, Data）とエッジを生成・配置。
- **自動レイアウト (Dagre)**: 最適な可視性のためにグラフを自動整列。
- **ワイヤーフレーム生成**: 設計図からUI構成をHTMLとして動的にプレビュー。

### B. 要件定義ブレスト機能
- **ライブ要件定義パネル**: キャンバス右側にMarkdown形式のドキュメントを常駐表示。
- **自動同期ロジック**: 会話が進むごとにAIが背景で要件定義書を更新・改善。
- **グラフ統合生成**: 会話履歴だけでなく、キャンバス上のノード/エッジ構造を反映した要件定義書生成（Phase 1改修）。
- **Markdownプレビュー**: `marked`ライブラリにより、視認性の高い整形済みHTMLとしてプレビュー。
- **コンサルタント・プロンプト**: AIが論理的矛盾や不足事項（TBD）を特定し、ブレストを促進。

### C. UI/UX 拡張
- **ペイン・リサイズ機能**: ドラッグハンドルによりチャットとキャンバスの幅を自由に調整可能（localStorage保存）。
- **マルチタブ・エクスポート**: 構造化JSON、Markdown要件定義書、およびそれらを結合した「AI開発エージェント向けプロンプト」の出力に対応。

### D. メタ・アーキテクチャ（2026-04-01 改修）
- **イベント駆動型オーケストレーション**: `useEffect` 依存を排し、`useAgentOrchestrator` による確実なタスク制御（Phase 2）。
- **SystemContext (SSOT)**: 会話履歴とグラフデータを統合した単一の真実源（SystemContext）を導入。
- **Prompt Registry**: ハードコードされたシステムプロンプトを外部化し、`src/prompts/` で一元管理、および `localStorage` による動的差し替えに対応（Phase 3）。

## 3. 技術スタック
- **Frontend**: React (Vite), Tailwind CSS
- **Graph/Flow**: ReactFlow, @dagrejs/dagre
- **AI/LLM**: Gemini 1.5/2.0 Flash/Pro API (Thinking Mode対応)
- **Markdown**: marked
- **Persistence**: localStorage (Project Data, Pane Width, Custom Prompts)

## 4. 現在のファイル構造（主要部）
- `src/App.jsx`: UI Shell（プレゼンテーション層の統合）
- `src/hooks/useAgentOrchestrator.js`: 背景処理（要件生成・レビュー）のイベント制御
- `src/types/systemContext.js`: 統合コンテキスト（SSOT）の定義とビルダー
- `src/prompts/`: 各サービス用システムプロンプトの管理ディレクトリ
- `src/services/geminiService.js`: グラフ抽出コアエンジン
- `src/services/requirementDocService.js`: グラフ＋会話からのドキュメント生成
- `src/services/reviewService.js`: 整合性レビュー生成
- `src/hooks/useCanvasStore.js`: キャンバス状態（ノード/エッジ）の管理・永続化

## 5. 次なるステップ（ロードマップ案）
- [ ] **プロジェクト保存・管理**: 複数の検討案をプロジェクト単位で保存・切り替え。
- [ ] **画像生成連携**: 要件定義に基づいたイメージアセットの自動生成。
- [ ] **GitHub連携**: 生成した要件とJSONを直接リポジトリへPushする機能。

---
**Status: STABLE / REFACTORED (Architecture Phase Complete)**
