import plugin from './lib/index.js';

export default [
  {
    files: ['test/fixture/locales/*.json'],
    plugins: { 'i18n-keeper': plugin },
    processor: 'i18n-keeper/locale',
  },
  {
    files: ['test/fixture/locales/*.json/*.js'],
    plugins: { 'i18n-keeper': plugin },
    rules: {
      'i18n-keeper/keys': 'error',
      'i18n-keeper/placeholders': 'error',
      'i18n-keeper/plurals': 'warn',
    },
  },
];
