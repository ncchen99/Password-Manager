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
        // 淺色：中性底 + 單一 accent，符合 WCAG AA
        safevault: {
          primary: '#4f46e5',
          'primary-content': '#ffffff',
          secondary: '#64748b',
          accent: '#0ea5e9',
          neutral: '#1e293b',
          'base-100': '#ffffff',
          'base-200': '#f1f5f9',
          'base-300': '#e2e8f0',
          'base-content': '#0f172a',
          info: '#0284c7',
          success: '#16a34a',
          warning: '#d97706',
          error: '#dc2626',
        },
      },
      {
        // 深色
        'safevault-dark': {
          primary: '#818cf8',
          'primary-content': '#0f172a',
          secondary: '#94a3b8',
          accent: '#38bdf8',
          neutral: '#0f172a',
          'base-100': '#0f172a',
          'base-200': '#1e293b',
          'base-300': '#334155',
          'base-content': '#e2e8f0',
          info: '#38bdf8',
          success: '#4ade80',
          warning: '#fbbf24',
          error: '#f87171',
        },
      },
    ],
    darkTheme: 'safevault-dark',
  },
} satisfies Config;
