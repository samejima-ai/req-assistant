import dagre from '@dagrejs/dagre';

const NODE_WIDTH = 176;  // w-44 = 11rem = 176px
const NODE_HEIGHT = 80;
const RANK_SEP = 200;   // レイヤー間の水平間隔（エッジラベルが見えるように広げる）
const NODE_SEP = 80;    // 同レイヤー内の垂直間隔（ノードが重ならないよう広げる）

// NodeTypeごとのランク（左→右の列順）
const RANK_ORDER = {
  Actor: 0,
  Action: 1,
  UI_Component: 2,
  Data_Entity: 3
};

/**
 * dagreを使ってReact Flowノードにpositionを付与する。
 * 孤立ノード（エッジなし）も破綻しないよう、フォールバック位置を計算する。
 */
export function getLayoutedElements(nodes, edges, direction = 'LR') {
  if (nodes.length === 0) return { nodes, edges };

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
    marginx: 40,
    marginy: 40
  });

  nodes.forEach(node => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // edgesのsource/targetがnodesに存在するものだけ追加（存在しないIDで壊れないように）
  const nodeIds = new Set(nodes.map(n => n.id));
  edges.forEach(edge => {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(dagreGraph);

  // TypeごとのY位置カウンタ（孤立ノードのフォールバック配置用）
  const typeCounters = {};

  const layoutedNodes = nodes.map(node => {
    const pos = dagreGraph.node(node.id);

    // dagreが位置を計算できた場合はそのまま使用
    if (pos && !isNaN(pos.x) && !isNaN(pos.y)) {
      return {
        ...node,
        position: {
          x: pos.x - NODE_WIDTH / 2,
          y: pos.y - NODE_HEIGHT / 2
        }
      };
    }

    // 孤立ノードのフォールバック：タイプごとに整列配置
    const rank = RANK_ORDER[node.type] ?? 1;
    const count = typeCounters[node.type] ?? 0;
    typeCounters[node.type] = count + 1;

    return {
      ...node,
      position: {
        x: rank * (NODE_WIDTH + RANK_SEP) + 40,
        y: count * (NODE_HEIGHT + NODE_SEP) + 40
      }
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * NodeDataからReact FlowのNode形式に変換する
 */
export function toFlowNode(nodeData) {
  return {
    id: nodeData.id,
    type: nodeData.type,
    // positionはgetLayoutedElementsで上書きされるので仮値でよい
    position: { x: 0, y: 0 },
    data: nodeData
  };
}

/**
 * EdgeDataからReact FlowのEdge形式に変換する
 */
export function toFlowEdge(edgeData) {
  return {
    id: edgeData.id,
    source: edgeData.source,
    target: edgeData.target,
    type: edgeData.type,
    label: edgeData.label ?? '',
    animated: edgeData.type === 'data_flow',
    data: edgeData
  };
}
