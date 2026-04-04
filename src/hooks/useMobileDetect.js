/**
 * useMobileDetect
 *
 * 責務: ウィンドウ幅が768px以下かどうかをリアクティブに返す
 *
 * Input:  なし
 * Output: { isMobile: boolean }
 */
import { useState, useEffect } from 'react';

export function useMobileDetect() {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 768px)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return { isMobile };
}
