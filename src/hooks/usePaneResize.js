/**
 * usePaneResize
 *
 * 責務: 左右ペイン間のドラッグハンドルによるリサイズを管理する
 *
 * ARC原則:
 * - ドラッグ中のマウスイベントをグローバル（document）で補足し、
 *   ペインの外に出ても追従するようにする
 * - pxではなく「vw%」で幅を管理し、ウィンドウリサイズにも追従する
 * - 最小幅・最大幅をクランプして破綻を防ぐ
 *
 * Input:  initialPercent（初期のチャット幅 %）, min, max
 * Output: { chatWidthPercent, handleMouseDown }
 */
import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY = 'req-assistant-pane-width';
const DEFAULT_PERCENT = 33; // 1/3
const MIN_PERCENT = 18;     // チャット最小幅
const MAX_PERCENT = 65;     // チャット最大幅

export function usePaneResize() {
  // localStorage から前回の幅を復元
  const [chatWidthPercent, setChatWidthPercent] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const v = saved ? parseFloat(saved) : DEFAULT_PERCENT;
      return isNaN(v) ? DEFAULT_PERCENT : Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, v));
    } catch {
      return DEFAULT_PERCENT;
    }
  });

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startPctRef = useRef(0);

  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    const windowWidth = window.innerWidth;
    const deltaPct = (dx / windowWidth) * 100;
    const next = Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, startPctRef.current + deltaPct));
    setChatWidthPercent(next);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    // 幅を永続化
    try {
      localStorage.setItem(STORAGE_KEY, chatWidthPercent.toString());
    } catch { /* ignore */ }
  }, [chatWidthPercent]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // handleMouseUp 内で chatWidthPercent が古くなる問題を回避するため
  // mouseup 時に最新の幅をrefから取得する方式にする
  const chatWidthRef = useRef(chatWidthPercent);
  useEffect(() => { chatWidthRef.current = chatWidthPercent; }, [chatWidthPercent]);

  const persistOnMouseUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try {
      localStorage.setItem(STORAGE_KEY, chatWidthRef.current.toString());
    } catch { /* ignore */ }
  }, []);

  // persistOnMouseUp を使う最終版
  useEffect(() => {
    document.addEventListener('mouseup', persistOnMouseUp);
    return () => document.removeEventListener('mouseup', persistOnMouseUp);
  }, [persistOnMouseUp]);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startPctRef.current = chatWidthRef.current;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  return { chatWidthPercent, handleMouseDown };
}
