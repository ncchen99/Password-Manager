import type { Config } from 'tailwindcss';
import daisyui from 'daisyui';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        // 淺色：石灰階（stone）—— 淺灰底、深灰按鈕（反轉對比），堅如磐石。
        // 直角（rounded 全為 0）以呼應極簡。
        safevault: {
          primary: '#44403c', // stone-700：深灰按鈕（淺色模式反轉）
          'primary-content': '#fafaf9',
          secondary: '#78716c', // stone-500
          'secondary-content': '#fafaf9',
          accent: '#57534e', // stone-600：深灰提示
          'accent-content': '#fafaf9',
          neutral: '#292524', // stone-800
          'neutral-content': '#fafaf9',
          'base-100': '#f5f5f4', // stone-100：淺灰主題底
          'base-200': '#e7e5e4', // stone-200
          'base-300': '#d6d3d1', // stone-300
          'base-content': '#1c1917', // stone-900
          info: '#57534e',
          // 安全語意色刻意保留（需確認 / 錯誤 / 成功），但降彩度貼近灰階
          success: '#4d7c0f',
          warning: '#b45309',
          error: '#b91c1c',
          '--rounded-box': '0',
          '--rounded-btn': '0',
          '--rounded-badge': '0',
          '--tab-radius': '0',
        },
      },
      {
        // 深色：深灰底、淺灰按鈕（反轉對比）
        'safevault-dark': {
          primary: '#e7e5e4', // stone-200：淺灰按鈕（深色模式反轉）
          'primary-content': '#1c1917',
          secondary: '#a8a29e', // stone-400
          'secondary-content': '#1c1917',
          accent: '#d6d3d1', // stone-300：淺灰提示
          'accent-content': '#1c1917',
          neutral: '#e7e5e4',
          'neutral-content': '#1c1917',
          'base-100': '#1c1917', // stone-900：深灰主題底
          'base-200': '#292524', // stone-800
          'base-300': '#44403c', // stone-700
          'base-content': '#e7e5e4',
          info: '#a8a29e',
          success: '#84cc16',
          warning: '#d97706',
          error: '#ef4444',
          '--rounded-box': '0',
          '--rounded-btn': '0',
          '--rounded-badge': '0',
          '--tab-radius': '0',
        },
      },
    ],
    darkTheme: 'safevault-dark',
  },
} satisfies Config;
