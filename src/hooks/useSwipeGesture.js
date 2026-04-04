/**
 * useSwipeGesture
 *
 * 責務: タッチ要素への水平スワイプを検出してコールバックを呼ぶ
 *
 * Input:  ref (要素ref), { onSwipeLeft, onSwipeRight, threshold=50, enabled=true }
 * Output: void
 */
import { useEffect, useRef } from 'react';

export function useSwipeGesture(ref, { onSwipeLeft, onSwipeRight, threshold = 50, enabled = true } = {}) {
  const startRef = useRef(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;

    const el = ref.current;

    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e) => {
      if (!startRef.current) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startRef.current.x;
      const deltaY = touch.clientY - startRef.current.y;
      startRef.current = null;

      // 縦スクロールと区別: 横移動が縦の1.5倍以上の場合のみスワイプとみなす
      if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) return;

      if (deltaX < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onSwipeLeft, onSwipeRight, threshold, ref]);
}
