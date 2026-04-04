/**
 * mermaidFlowGenerator
 *
 * 責務: canvasのノード/エッジからMermaid stateDiagram-v2形式の画面遷移図を生成する
 *
 * SRP: 純粋関数 — 副作用なし、stateなし
 *
 * Input:  nodes[], edges[] (ReactFlow形式)
 * Output: string (Mermaid定義文字列、UI_Componentが0件なら空文字)
 */

/**
 * UI_Component / Actor / Action / Edgeから画面遷移図（stateDiagram-v2）を生成する
 * @param {import('reactflow').Node[]} nodes
 * @param {import('reactflow').Edge[]} edges
 * @returns {string} Mermaid stateDiagram-v2 定義文字列
 */
export function generateScreenFlowMermaid(nodes, edges, direction = 'LR') {
  const uiNodes = nodes.filter(n => n.type === 'UI_Component');
  if (uiNodes.length === 0) return '';

  const lines = ['stateDiagram-v2'];
  if (direction === 'TB') lines.push('  direction TB');

  // UI_Componentをstateとして定義
  for (const node of uiNodes) {
    const label = (node.data.label ?? '画面').replace(/"/g, "'");
    lines.push(`  state "${label}" as ${node.id}`);
  }

  // Actor → UI_Component のエントリポイント（actor_actionエッジ経由）
  const actorNodes = nodes.filter(n => n.type === 'Actor');
  const actorIds = new Set(actorNodes.map(n => n.id));

  const entryTargets = new Set();
  for (const edge of edges) {
    if (edge.type === 'actor_action' && actorIds.has(edge.source)) {
      const target = nodes.find(n => n.id === edge.target);
      if (target?.type === 'UI_Component') {
        entryTargets.add(target.id);
      }
      // Actor → Action → UI_Component のケースも探す
      if (target?.type === 'Action') {
        for (const e2 of edges) {
          if (e2.source === target.id) {
            const dest = nodes.find(n => n.id === e2.target);
            if (dest?.type === 'UI_Component') {
              entryTargets.add(dest.id);
            }
          }
        }
      }
    }
  }

  // エントリポイントがなければ最初のUI_Componentをエントリにする
  if (entryTargets.size === 0 && uiNodes.length > 0) {
    entryTargets.add(uiNodes[0].id);
  }

  for (const targetId of entryTargets) {
    lines.push(`  [*] --> ${targetId}`);
  }

  // UI_Component間の画面遷移（screen_transitionエッジ）
  const uiIds = new Set(uiNodes.map(n => n.id));

  for (const edge of edges) {
    if (edge.type !== 'screen_transition') continue;
    const src = nodes.find(n => n.id === edge.source);
    const dst = nodes.find(n => n.id === edge.target);

    // Action経由の遷移: UI → Action → UI を UI → UI に展開
    if (src?.type === 'UI_Component' && dst?.type === 'Action') {
      const actionLabel = (dst.data.label ?? '').replace(/"/g, "'");
      // このActionからつながるUI_Componentへのエッジを探す
      for (const e2 of edges) {
        if (e2.source === dst.id && e2.type === 'screen_transition') {
          const dest2 = nodes.find(n => n.id === e2.target);
          if (dest2?.type === 'UI_Component') {
            lines.push(`  ${src.id} --> ${dest2.id} : ${actionLabel}`);
          }
        }
      }
      continue;
    }

    if (!uiIds.has(edge.source) || !uiIds.has(edge.target)) continue;

    const transLabel = (edge.label ?? '').replace(/"/g, "'");
    if (transLabel) {
      lines.push(`  ${edge.source} --> ${edge.target} : ${transLabel}`);
    } else {
      lines.push(`  ${edge.source} --> ${edge.target}`);
    }
  }

  // actor_actionエッジで UI_Component → UI_Component の直接遷移も含む
  for (const edge of edges) {
    if (edge.type === 'actor_action') {
      if (uiIds.has(edge.source) && uiIds.has(edge.target)) {
        const transLabel = (edge.label ?? '').replace(/"/g, "'");
        if (transLabel) {
          lines.push(`  ${edge.source} --> ${edge.target} : ${transLabel}`);
        } else {
          lines.push(`  ${edge.source} --> ${edge.target}`);
        }
      }
    }
  }

  return lines.join('\n');
}
