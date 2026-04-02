/**
 * useMermaidDiagram
 *
 * 責務: nodes/edgesが変化したとき、Mermaid SVGを非同期で生成する
 *
 * SRP: useWireframe.js と同パターン（入力nodes/edges → 出力SVG文字列）
 *
 * Input:  nodes[], edges[] (ReactFlow形式)
 * Output: { flowSvg, erSvg, flowCode, erCode }
 *   - flowSvg: 画面遷移図のSVG文字列（空文字なら未生成）
 *   - erSvg:   ER図のSVG文字列（空文字なら未生成）
 *   - flowCode: Mermaid定義文字列（コピー用）
 *   - erCode:   Mermaid定義文字列（コピー用）
 */
import { useState, useEffect } from 'react';
import mermaid from 'mermaid';
import { generateScreenFlowMermaid } from '../utils/mermaidFlowGenerator.js';
import { generateErMermaid } from '../utils/mermaidErGenerator.js';

// 遅延初期化フラグ（モジュールスコープでinitializeを実行しない）
let initialized = false;
let renderCounter = 0;

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'neutral',
    securityLevel: 'antiscript', // SVG許可・script要素はブロック（CSP安全）
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: 13,
  });
}

/**
 * Mermaid定義文字列からSVG文字列を生成する
 * @param {string} code Mermaid定義
 * @param {string} prefix ID prefix
 * @returns {Promise<string>} SVG文字列（失敗時は空文字）
 */
async function renderToSvg(code, prefix) {
  if (!code) return '';
  renderCounter += 1;
  const id = `mermaid-${prefix}-${renderCounter}`;
  try {
    const { svg } = await mermaid.render(id, code);
    return svg;
  } catch {
    return '';
  }
}

/**
 * @param {import('reactflow').Node[]} nodes
 * @param {import('reactflow').Edge[]} edges
 */
export function useMermaidDiagram(nodes, edges) {
  const [flowSvg, setFlowSvg] = useState('');
  const [erSvg, setErSvg] = useState('');
  const [flowCode, setFlowCode] = useState('');
  const [erCode, setErCode] = useState('');

  useEffect(() => {
    // 初回useEffect実行時に初期化（モジュール評価時ではなくレンダリング後）
    ensureInitialized();

    const fc = generateScreenFlowMermaid(nodes, edges);
    const ec = generateErMermaid(nodes, edges);
    setFlowCode(fc);
    setErCode(ec);

    let cancelled = false;

    Promise.all([
      renderToSvg(fc, 'flow'),
      renderToSvg(ec, 'er'),
    ]).then(([fSvg, eSvg]) => {
      if (!cancelled) {
        setFlowSvg(fSvg);
        setErSvg(eSvg);
      }
    });

    return () => { cancelled = true; };
  }, [nodes, edges]);

  return { flowSvg, erSvg, flowCode, erCode };
}
