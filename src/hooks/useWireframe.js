/**
 * useWireframe
 *
 * 責務: UI_Componentノードが変化したとき、ワイヤーフレームHTMLを生成する。
 *
 * SRP: ワイヤーフレーム生成ロジックをCanvasPaneから切り出し
 *
 * Input:  nodes[] (ReactFlow形式)
 * Output: wireframeHtml: string (UI_Componentが0件なら空文字)
 */
import { useState, useEffect } from 'react';
import { generateWireframe } from '../utils/wireframeGenerator.js';

export function useWireframe(nodes) {
  const [wireframeHtml, setWireframeHtml] = useState('');

  useEffect(() => {
    const uiNodes = nodes.filter(n => n.type === 'UI_Component');
    setWireframeHtml(uiNodes.length > 0 ? generateWireframe(uiNodes) : '');
  }, [nodes]);

  return wireframeHtml;
}
