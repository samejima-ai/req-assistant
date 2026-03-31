/**
 * useAutoLayout
 *
 * 責務: nodes/edgesが変化したとき自動レイアウトを適用する。
 *
 * 方針（視認性優先）:
 * - 新ノードが追加されたら全体を毎回再レイアウトする。
 *   「既存位置キャッシュ引き継ぎ」は見た目の散らばりの原因だったため廃止。
 * - ユーザーが手動ドラッグした場合のみ、そのノードをキャッシュに記録し
 *   次回レイアウト時に「ピン留め」として固定する。
 *
 * Input:  nodes[], edges[] (ReactFlow形式)
 * Output: layoutedNodes[], updatePosition()
 */
import { useState, useEffect, useRef } from 'react';
import { getLayoutedElements } from '../utils/layoutUtils.js';

export function useAutoLayout(nodes, edges) {
  const [layoutedNodes, setLayoutedNodes] = useState(nodes);
  // 手動ドラッグしたノードIDのみ記録（「ピン留め」）
  const pinnedRef = useRef(new Map());

  useEffect(() => {
    if (nodes.length === 0) {
      setLayoutedNodes([]);
      pinnedRef.current.clear();
      return;
    }

    // 全体レイアウトを計算
    const { nodes: laid } = getLayoutedElements(nodes, edges);

    // ピン留めノードだけ手動位置を復元、それ以外はdagreの結果を使用
    const result = laid.map(n => {
      const pinned = pinnedRef.current.get(n.id);
      return pinned ? { ...n, position: pinned } : n;
    });

    setLayoutedNodes(result);
  }, [nodes, edges]);

  /**
   * ユーザーがドラッグ完了したとき呼ぶ。
   * そのノードをピン留めしてレイアウト再計算から除外する。
   */
  const updatePosition = (nodeId, position) => {
    pinnedRef.current.set(nodeId, position);
  };

  return { layoutedNodes, updatePosition };
}
