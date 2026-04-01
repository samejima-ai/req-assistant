/**
 * SystemContext
 *
 * 責務: アプリケーション全体の「単一の真実（SSOT）」を集約するコンテキスト型。
 *
 * CDD（コンテキスト駆動開発）原則:
 * - 「会話履歴（messages）」と「抽出済みグラフ（nodes/edges）」を分離せず、
 *   単一のオブジェクトとして全サービスに渡す
 * - 全てのAI生成成果物（要件定義書、レビューレポート）は
 *   このコンテキストから派生する
 *
 * @typedef {Object} DomainModel
 * @property {Array<{id: string, label: string, description: string}>} actors
 * @property {Array<{id: string, label: string, description: string}>} uiComponents
 * @property {Array<{id: string, label: string, description: string}>} dataEntities
 * @property {Array<{id: string, label: string, description: string}>} actions
 *
 * @typedef {Object} SystemContext
 * @property {Array<{role: string, content: string}>} messages - 会話履歴
 * @property {Array} nodes - ReactFlowノード（生データ）
 * @property {Array} edges - ReactFlowエッジ（生データ）
 * @property {DomainModel} domain - ノードを種別ごとに分類したドメインモデル
 * @property {string} requirementDoc - 直前に生成された要件定義書（差分更新用）
 */

/**
 * messages + nodes + edges から SystemContext を組み立てる
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {Array} nodes - ReactFlow Node[]
 * @param {Array} edges - ReactFlow Edge[]
 * @param {string} [requirementDoc] - 前回生成済みの要件定義書（省略可）
 * @returns {SystemContext}
 */
export function buildSystemContext(messages, nodes, edges, requirementDoc = '') {
  const domain = {
    actors: [],
    uiComponents: [],
    dataEntities: [],
    actions: [],
  };

  for (const node of nodes) {
    // ReactFlow ノードは type プロパティか data.type プロパティのいずれかに種別を持つ
    const nodeType = node.type ?? node.data?.type ?? '';
    const entry = {
      id: node.id,
      label: node.data?.label ?? node.id,
      description: node.data?.description ?? '',
    };

    switch (nodeType) {
      case 'Actor':         domain.actors.push(entry);       break;
      case 'UI_Component':  domain.uiComponents.push(entry); break;
      case 'Data_Entity':   domain.dataEntities.push(entry); break;
      case 'Action':        domain.actions.push(entry);      break;
      // 不明な種別はスキップ（将来のノードタイプ追加に対する寛容な設計）
    }
  }

  return { messages, nodes, edges, domain, requirementDoc };
}

/**
 * SystemContext のドメインモデルを、AIプロンプトに埋め込みやすい
 * Markdown テキストとしてシリアライズする
 *
 * @param {SystemContext} ctx
 * @returns {string}
 */
export function serializeDomainForPrompt(ctx) {
  const { domain, edges } = ctx;
  const lines = [];

  if (domain.actors.length > 0) {
    lines.push('### Actorノード（利用者）');
    domain.actors.forEach(n => lines.push(`- ${n.label}(${n.id}): ${n.description}`));
  }
  if (domain.uiComponents.length > 0) {
    lines.push('### UI_Componentノード（画面）');
    domain.uiComponents.forEach(n => lines.push(`- ${n.label}(${n.id}): ${n.description}`));
  }
  if (domain.dataEntities.length > 0) {
    lines.push('### Data_Entityノード（データ）');
    domain.dataEntities.forEach(n => lines.push(`- ${n.label}(${n.id}): ${n.description}`));
  }
  if (domain.actions.length > 0) {
    lines.push('### Actionノード（処理）');
    domain.actions.forEach(n => lines.push(`- ${n.label}(${n.id}): ${n.description}`));
  }

  if (edges.length > 0) {
    lines.push('### フロー（エッジ）');
    edges.forEach(e => {
      const label = e.label ?? e.data?.label ?? e.type ?? '';
      lines.push(`- ${e.source} --[${label}]--> ${e.target}`);
    });
  }

  return lines.length > 0 ? lines.join('\n') : '（設計図はまだありません）';
}
