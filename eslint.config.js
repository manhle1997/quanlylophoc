export default [{
  files: ['src/**/*.js'],
  languageOptions: {
    ecmaVersion: 2022, sourceType: 'module',
    globals: Object.fromEntries(['window', 'document', 'navigator', 'crypto', 'console', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'URL', 'Blob', 'FormData', 'TextEncoder', 'ResizeObserver', 'devicePixelRatio', 'matchMedia', 'structuredClone', 'AbortSignal', 'AbortController'].map(key => [key, 'readonly'])),
  },
  rules: { 'no-undef': 'error', 'no-unreachable': 'error', 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
}];
