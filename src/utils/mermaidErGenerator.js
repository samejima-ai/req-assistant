/**
 * mermaidErGenerator
 *
 * 責務: canvasのノード/エッジからMermaid erDiagram形式のER図を生成する
 *
 * SRP: 純粋関数 — 副作用なし、stateなし
 *
 * Input:  nodes[], edges[] (ReactFlow形式)
 * Output: string (Mermaid定義文字列、Data_Entityが0件なら空文字)
 */

/**
 * descriptionテキストからフィールド候補を抽出する
 * 「ユーザーID, 名前, メール」「id, name, email」のような記述に対応
 * @param {string} description
 * @returns {string[]} フィールド名配列
 */
function extractFields(description) {
  if (!description) return [];
  // 読点・カンマ・スラッシュ・改行で分割
  const raw = description.split(/[、,，/／\n・]+/).map(s => s.trim()).filter(Boolean);
  // 30文字以上の長い説明文は除外（フィールドではなく説明の可能性が高い）
  return raw.filter(s => s.length > 0 && s.length <= 30);
}

/**
 * エンティティ名をMermaid安全な識別子に変換（スペース→_、日本語そのまま許容）
 * @param {string} label
 * @returns {string}
 */
function toEntityName(label) {
  return (label ?? 'Entity').replace(/\s+/g, '_').replace(/[^\w\u3000-\u9FFF\u30A0-\u30FF\u3040-\u309F]/g, '_');
}

/**
 * Data_EntityノードとエッジからMermaid erDiagramを生成する
 * @param {import('reactflow').Node[]} nodes
 * @param {import('reactflow').Edge[]} edges
 * @returns {string} Mermaid erDiagram 定義文字列
 */
export function generateErMermaid(nodes, edges) {
  const entityNodes = nodes.filter(n => n.type === 'Data_Entity');
  if (entityNodes.length === 0) return '';

  const lines = ['erDiagram'];

  // エンティティ定義（nodeId → entityName のマップも作成）
  const idToName = new Map();
  for (const node of entityNodes) {
    const name = toEntityName(node.data.label ?? 'Entity');
    idToName.set(node.id, name);

    const fields = extractFields(node.data.description ?? '');
    if (fields.length > 0) {
      lines.push(`  ${name} {`);
      fields.forEach((f, i) => {
        // 先頭フィールドをPKとして扱う
        const type = i === 0 ? 'string' : 'string';
        const key = i === 0 ? ' PK' : '';
        const safeName = f.replace(/\s+/g, '_').replace(/[^\w\u3000-\u9FFF\u30A0-\u30FF\u3040-\u309F]/g, '_');
        lines.push(`    ${type} ${safeName}${key}`);
      });
      lines.push(`  }`);
    } else {
      // フィールド情報がない場合は最低限のidフィールドを追加
      lines.push(`  ${name} {`);
      lines.push(`    string id PK`);
      lines.push(`  }`);
    }
  }

  // エンティティ間のリレーション（data_flowエッジのうちData_Entity同士のもの）
  const entityIds = new Set(entityNodes.map(n => n.id));

  for (const edge of edges) {
    if (edge.type !== 'data_flow') continue;
    if (!entityIds.has(edge.source) || !entityIds.has(edge.target)) continue;

    const srcName = idToName.get(edge.source);
    const dstName = idToName.get(edge.target);
    if (!srcName || !dstName) continue;

    const relLabel = (edge.label ?? 'relates_to').replace(/\s+/g, '_').replace(/[^\w\u3000-\u9FFF\u30A0-\u30FF\u3040-\u309F]/g, '_') || 'relates_to';
    // 多対多をデフォルトとして使用（ラベルで1対多などの意図が読み取れる場合は変更可）
    lines.push(`  ${srcName} ||--o{ ${dstName} : "${relLabel}"`);
  }

  return lines.join('\n');
}
