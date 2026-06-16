import { useEffect } from 'react';

/**
 * 將實際「可顯示區域高度」寫入 CSS 變數 --app-height。
 *
 * 為什麼不直接用 100vh / 100dvh：
 * - 100vh 會把瀏覽器導航列（如 Chrome 上方網址列）也算進去，導致頁面比可視範圍高，
 *   出現不必要的內捲動。
 * - 100dvh 雖然理論上對應動態視窗，但在 iPad 以 Safari 安裝的 PWA（standalone）
 *   及部分瀏覽器上量測不準，仍會留白或溢出。
 *
 * window.innerHeight 是實際可繪製的畫布高度：已扣除瀏覽器 UI，且（在多數瀏覽器上）
 * 不會因虛擬鍵盤彈出而縮減——正是我們要的版面基準。
 */
export function useAppHeight(): void {
  useEffect(() => {
    const setHeight = () => {
      document.documentElement.style.setProperty(
        '--app-height',
        `${window.innerHeight}px`,
      );
    };

    setHeight();

    window.addEventListener('resize', setHeight);
    window.addEventListener('orientationchange', setHeight);
    // visualViewport 在瀏覽器列收合/展開時的回報比 resize 更即時。
    window.visualViewport?.addEventListener('resize', setHeight);

    return () => {
      window.removeEventListener('resize', setHeight);
      window.removeEventListener('orientationchange', setHeight);
      window.visualViewport?.removeEventListener('resize', setHeight);
    };
  }, []);
}
