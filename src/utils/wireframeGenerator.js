/**
 * UI_ComponentノードのdescriptionやlabelからシンプルなHTMLワイヤーフレームを生成する
 * @param {import('reactflow').Node[]} uiNodes
 * @returns {string} HTML文字列
 */
export function generateWireframe(uiNodes) {
  if (uiNodes.length === 0) return '';

  const screens = uiNodes.map(node => {
    const label = node.data.label ?? '画面';
    const desc = node.data.description ?? '';
    const template = detectTemplate(label, desc);
    return renderScreen(label, desc, template);
  });

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ワイヤーフレーム</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, sans-serif; }
    body { background: #f1f5f9; padding: 24px; display: flex; flex-wrap: wrap; gap: 24px; }
    .screen { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); width: 320px; overflow: hidden; }
    .screen-header { background: #e2e8f0; padding: 10px 16px; font-size: 12px; font-weight: bold; color: #475569; display: flex; align-items: center; gap: 8px; }
    .screen-header::before { content: ''; display: block; width: 8px; height: 8px; border-radius: 50%; background: #94a3b8; }
    .screen-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .wf-input { border: 1.5px solid #cbd5e1; border-radius: 6px; height: 36px; padding: 0 12px; display: flex; align-items: center; font-size: 12px; color: #94a3b8; background: #f8fafc; }
    .wf-btn { background: #3b82f6; border-radius: 6px; height: 38px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; color: white; }
    .wf-btn.secondary { background: #e2e8f0; color: #475569; }
    .wf-label { font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: -4px; }
    .wf-card { border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 4px; }
    .wf-card-title { font-size: 13px; font-weight: bold; color: #1e293b; }
    .wf-card-sub { font-size: 11px; color: #94a3b8; }
    .wf-list { border: 1.5px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .wf-list-item { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #334155; display: flex; justify-content: space-between; align-items: center; }
    .wf-list-item:last-child { border-bottom: none; }
    .wf-badge { background: #dbeafe; color: #1d4ed8; border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: bold; }
    .wf-camera { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #94a3b8; font-size: 12px; }
    .wf-divider { border: none; border-top: 1px solid #e2e8f0; }
    .wf-nav { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; display: flex; }
    .wf-nav-item { flex: 1; padding: 8px; text-align: center; font-size: 10px; color: #94a3b8; }
    .wf-nav-item.active { color: #3b82f6; font-weight: bold; }
    .wf-title { font-size: 16px; font-weight: bold; color: #1e293b; }
    .wf-desc { font-size: 11px; color: #94a3b8; line-height: 1.5; }
  </style>
</head>
<body>
  ${screens.join('\n')}
</body>
</html>`;
}

function detectTemplate(label, desc) {
  const text = `${label} ${desc}`.toLowerCase();
  if (text.includes('ログイン') || text.includes('認証') || text.includes('サインイン')) return 'login';
  if (text.includes('リスト') || text.includes('一覧') || text.includes('履歴')) return 'list';
  if (text.includes('入力') || text.includes('フォーム') || text.includes('登録') || text.includes('日報')) return 'form';
  if (text.includes('ダッシュボード') || text.includes('メイン') || text.includes('ホーム')) return 'dashboard';
  if (text.includes('詳細') || text.includes('プロフィール')) return 'detail';
  return 'form'; // デフォルト
}

function renderScreen(label, desc, template) {
  const body = TEMPLATES[template](label, desc);
  return `
  <div class="screen">
    <div class="screen-header">${label}</div>
    <div class="screen-body">
      ${body}
    </div>
  </div>`;
}

const TEMPLATES = {
  login: (label) => `
    <div class="wf-title">${label}</div>
    <div class="wf-label">メールアドレス</div>
    <div class="wf-input">例: user@example.com</div>
    <div class="wf-label">パスワード</div>
    <div class="wf-input">••••••••</div>
    <div class="wf-btn">ログイン</div>
    <div class="wf-btn secondary">新規登録はこちら</div>`,

  list: (label, desc) => `
    <div class="wf-title">${label}</div>
    <div class="wf-input">🔍 検索...</div>
    <div class="wf-list">
      <div class="wf-list-item">項目 A <span class="wf-badge">NEW</span></div>
      <div class="wf-list-item">項目 B <span class="wf-badge">済</span></div>
      <div class="wf-list-item">項目 C</div>
      <div class="wf-list-item">項目 D</div>
    </div>
    <div class="wf-btn">＋ 新規追加</div>`,

  form: (label, desc) => `
    <div class="wf-title">${label}</div>
    ${desc ? `<div class="wf-desc">${desc}</div>` : ''}
    <div class="wf-label">作業内容</div>
    <div class="wf-input">テキストを入力...</div>
    <div class="wf-label">写真</div>
    <div class="wf-camera">
      <div style="font-size:24px">📷</div>
      <div>タップして写真を追加</div>
    </div>
    <div class="wf-label">備考</div>
    <div class="wf-input">任意入力</div>
    <hr class="wf-divider">
    <div class="wf-btn">送信する</div>
    <div class="wf-btn secondary">キャンセル</div>`,

  dashboard: (label) => `
    <div class="wf-title">${label}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="wf-card"><div class="wf-card-title">12</div><div class="wf-card-sub">今月の件数</div></div>
      <div class="wf-card"><div class="wf-card-title">3</div><div class="wf-card-sub">未処理</div></div>
    </div>
    <div class="wf-label">最近の活動</div>
    <div class="wf-list">
      <div class="wf-list-item">項目 A <span class="wf-badge">NEW</span></div>
      <div class="wf-list-item">項目 B</div>
    </div>
    <div class="wf-nav">
      <div class="wf-nav-item active">🏠 ホーム</div>
      <div class="wf-nav-item">📋 一覧</div>
      <div class="wf-nav-item">👤 設定</div>
    </div>`,

  detail: (label, desc) => `
    <div class="wf-title">${label}</div>
    ${desc ? `<div class="wf-desc">${desc}</div>` : ''}
    <div class="wf-card">
      <div class="wf-card-title">詳細情報</div>
      <div class="wf-card-sub">名前: ——————</div>
      <div class="wf-card-sub">日付: ——————</div>
      <div class="wf-card-sub">状態: ——————</div>
    </div>
    <div class="wf-btn">編集する</div>
    <div class="wf-btn secondary">削除</div>`
};
