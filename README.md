# 🎨 VibeArchitect (req-assistant)

## **Vibe Coding を、一歩先の「設計」から。**

**あらゆる要件やアイデアを、雰囲気（バイブス）で可視化する設計プラットフォーム。**

---

## 🚀 Concept: Vibe Architect (雰囲気設計)

「作りたいアプリのイメージはある。でも、どう設計すればいいか分からない。」
「AI（Cursor, Windsurf, Antigravity...）に投げたいけど、指示出し（プロンプト）が難しい。」

VibeArchitect は、あなたの**「雰囲気」**を**「設計図」**へと変換します。
プログラミングの知識は不要。対話を通じてプロジェクトの骨組み（Vibe Architecture）を構築し、最新の AI コーディングを最大限に加速させます。

---

## ✨ Key Features

### 🎙️ AI-Driven Hearing: 「話す」が「図」になる

チャット形式でアプリの概要を話すだけで、Gemini AI が「誰が」「何を」「どう動かすか」を抽出。ノードとエッジのビジュアルボード（ReactFlow）としてリアルタイムに可視化します。

### 🧠 Agentic Context: 会話が長くなるほど賢くなる

チャット送信のたびに**インテント前処理**（操作意図・ドメイン・曖昧度スコアの分析）と**グラフ状態の構造化注入**（現在のノード/エッジのラベル・説明・型）を Gemini に渡します。会話ターンを重ねても設計図の一貫性が維持されます。

処理中は「インテントを分析中...」→「設計図を生成中...」のフェーズテキストをリアルタイム表示。何をしているかが見えます。

### 📊 Multi-Blueprint: 複数の視点で設計を固める

一つの対話から、以下の設計図が自動生成されます：

- **画面遷移図 (State Diagram)**: ユーザーの導線を可視化。
- **データ構造図 (ER Diagram)**: データベースの「雰囲気」を定義。
- **要件定義書 (Markdown)**: 非エンジニアでも読める言葉で仕様を明文化。
- **即時プロトタイプ (Wireframe)**: その場で動く簡易版 HTML。

Mermaid 図はクリックでインライン編集可能（双方向編集）。

### ⚡ Manifest Prompt (MP): Vibe Coding の究極燃料

設計したデータを**一つの「Manifest Prompt」**として出力。含まれる情報：

| セクション | 内容 |
| --- | --- |
| 要件定義書 | 会話から自動生成された Markdown 仕様書 |
| ノード・エッジ一覧 | 各ノードのラベル・説明・型・フロー構造 |
| 画面フロー図 | Mermaid stateDiagram-v2 |
| ER ダイアグラム | Mermaid erDiagram |
| 技術スタック・制約 | 自由記述（任意） |

これを Cursor や Windsurf などの AI ツールに貼り付けるだけで、AI はあなたの「意図」を完璧に理解し、高精度なコードを生成します。

---

## 🛠️ Usage Workflow

1. **Vibe Chat**: AI と対話しながら、アイデアをぶつけます。
2. **Visual Refine**: ボード上のノードを動かしたり、詳細を追記して設計をブラッシュアップ。
3. **Vibe Code**: `設計データを出力` をクリックして Manifest Prompt を取得。お気に入りの AI コード生成ツールに投入！

---

## 🚦 Getting Started

### Prerequisites

- Node.js 20.19+ または 22.12+ (22.11.0 は非対応)
- Gemini API Key

### Installation

```bash
# リポジトリのクローン
git clone https://github.com/samejima-ai/req-assistant.git
cd req-assistant

# 依存関係のインストール
npm install

# 環境設定
cp .env.example .env
# .env を開き、 VITE_GEMINI_API_KEY を設定してください
```

### Run

```bash
npm run dev
# → http://localhost:5173 を開く
```

---

## ⚙️ Environment Variables

`.env.local` に設定（`.env.example` 参照）:

| 変数名 | 説明 | デフォルト |
| --- | --- | --- |
| `VITE_GEMINI_API_KEY` | Gemini API キー（必須） | — |
| `VITE_GEMINI_MODEL_INTENT` | インテント分析モデル | `gemini-2.0-flash-lite` |
| `VITE_GEMINI_MODEL_CHAT` | チャットモデル | `gemini-3.1-flash-lite-preview` |
| `VITE_GEMINI_MODEL_DOC` | 要件書生成モデル | `gemini-3.1-flash-lite-preview` |
| `VITE_GEMINI_MODEL_REVIEW` | レビューモデル | `gemini-3-flash-preview` |

APIキー未設定でもモック出力でアプリ動作可能。

---

## 🛡️ Powered By

- **Frontend**: React + Vite + TailwindCSS
- **Visualization**: ReactFlow + Mermaid
- **Brain**: Google Gemini 2.0 / 3.x Flash (via Gemini API)
- **Architecture**: ARC (Agentic Requirement Computing)

---

## 🤝 Contribution

雰囲気が合う方のコントリビューションをお待ちしています！Issue や PR はお気軽にどうぞ。

---

## 📄 License

MIT License - Copyright (c) 2026 Samejima AI
