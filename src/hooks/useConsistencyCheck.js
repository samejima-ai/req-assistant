/**
 * useConsistencyCheck
 *
 * 責務: ノード/エッジのグラフ構造に対してルールベースの整合性チェックを実行する
 *
 * ARC原則:
 * - 純粋計算のみ（副作用なし）
 * - useMemo でメモ化: nodes/edges が変わったときのみ再計算
 * - 序盤の false positive を避けるため、ノード数が閾値未満の場合はスキップ
 *
 * Input:  nodes[], edges[] (ReactFlow形式)
 * Output: { issues: Issue[], summary: { errors, warnings } }
 */
import { useMemo } from 'react';

/**
 * @typedef {{ id: string, severity: 'error'|'warning', rule: string, message: string, nodeId?: string }} Issue
 */

// ルール閾値: ノード数がこれ未満なら全チェックをスキップ（序盤の誤報防止）
const MIN_NODES_FOR_CHECK = 2;

export function useConsistencyCheck(nodes, edges) {
  return useMemo(() => {
    if (!nodes || nodes.length < MIN_NODES_FOR_CHECK) {
      return { issues: [], summary: { errors: 0, warnings: 0 } };
    }
    return runChecks(nodes, edges ?? []);
  }, [nodes, edges]);
}

// ---------- private ----------

/**
 * @param {import('reactflow').Node[]} nodes
 * @param {import('reactflow').Edge[]} edges
 * @returns {{ issues: Issue[], summary: { errors: number, warnings: number } }}
 */
function runChecks(nodes, edges) {
  const issues = [];

  // エッジの source/target セットをあらかじめ構築（O(n)）
  const connectedNodeIds = new Set();
  const outgoingEdgesByNode = new Map(); // nodeId -> edge[]
  const incomingEdgesByNode = new Map(); // nodeId -> edge[]
  const dataFlowNodeIds = new Set();

  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);

    if (!outgoingEdgesByNode.has(edge.source)) outgoingEdgesByNode.set(edge.source, []);
    outgoingEdgesByNode.get(edge.source).push(edge);

    if (!incomingEdgesByNode.has(edge.target)) incomingEdgesByNode.set(edge.target, []);
    incomingEdgesByNode.get(edge.target).push(edge);

    if (edge.type === 'data_flow' || edge.data?.type === 'data_flow') {
      dataFlowNodeIds.add(edge.source);
      dataFlowNodeIds.add(edge.target);
    }
  }

  const actorNodes = nodes.filter(n => n.type === 'Actor' || n.data?.type === 'Actor');
  const dataEntityNodes = nodes.filter(n => n.type === 'Data_Entity' || n.data?.type === 'Data_Entity');
  const uiNodes = nodes.filter(n => n.type === 'UI_Component' || n.data?.type === 'UI_Component');

  // ---- ルール1: Actorが存在しない (nodes >= 2) ----
  if (nodes.length >= 2 && actorNodes.length === 0) {
    issues.push({
      id: 'no_actor',
      severity: 'error',
      rule: 'no_actor',
      message: 'Actorノードがありません。誰がこのシステムを使うか定義してください。'
    });
  }

  // ---- ルール2: 孤立ノード (nodes >= 4) ----
  if (nodes.length >= 4) {
    for (const node of nodes) {
      if (!connectedNodeIds.has(node.id)) {
        const label = node.data?.label ?? node.id;
        issues.push({
          id: `isolated_${node.id}`,
          severity: 'warning',
          rule: 'isolated_node',
          message: `「${label}」が他のノードと接続されていません（孤立ノード）。`,
          nodeId: node.id
        });
      }
    }
  }

  // ---- ルール3: Data_Entityにdata_flowエッジがない (nodes >= 3) ----
  if (nodes.length >= 3) {
    for (const node of dataEntityNodes) {
      if (!dataFlowNodeIds.has(node.id)) {
        const label = node.data?.label ?? node.id;
        issues.push({
          id: `disconnected_data_${node.id}`,
          severity: 'warning',
          rule: 'disconnected_data_entity',
          message: `データ「${label}」にdata_flowエッジがありません。どの画面・処理からアクセスされるか定義してください。`,
          nodeId: node.id
        });
      }
    }
  }

  // ---- ルール4: 行き詰まりUI（出口エッジ0のUI_Component）(nodes >= 4) ----
  // ただし、Actorのみを入口とするトップ画面は除外
  if (nodes.length >= 4) {
    for (const node of uiNodes) {
      const outgoing = outgoingEdgesByNode.get(node.id) ?? [];
      const incoming = incomingEdgesByNode.get(node.id) ?? [];

      if (outgoing.length === 0) {
        // Actorからのactor_actionエッジのみが入口のトップ画面は除外しない（ゴール画面は許容）
        // ただし入口が全くない場合（孤立）は孤立ノードルールで検出済みなのでここでは skip
        if (incoming.length > 0) {
          const label = node.data?.label ?? node.id;
          issues.push({
            id: `dead_end_${node.id}`,
            severity: 'warning',
            rule: 'dead_end_ui',
            message: `画面「${label}」に出口（遷移先）がありません。ここから次にどこへ行くか定義してください。`,
            nodeId: node.id
          });
        }
      }
    }
  }

  const summary = {
    errors: issues.filter(i => i.severity === 'error').length,
    warnings: issues.filter(i => i.severity === 'warning').length
  };

  return { issues, summary };
}
