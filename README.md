# eslint-plugin-i18n-keeper

Lint locale files from ESLint. Placeholders, plural forms and missing keys, checked against **how the framework actually substitutes them** rather than against how the token looks.

Wraps [i18n-keeper](https://github.com/katerynaKhar/i18n-keeper), which is also a CLI and an MCP server. This package is the ESLint door.

```bash
npm install --save-dev eslint-plugin-i18n-keeper
```

```js
// eslint.config.js
import i18nKeeper from 'eslint-plugin-i18n-keeper';

export default [
  ...i18nKeeper.configs.recommended,
];
```

That covers `**/locales/**` and `**/lang/**` in JSON, YAML, gettext and Laravel PHP.

```
locales/fr.json
   4:7  error    fr cart.total: {{amount}} lost (placeholder_missing)
  10:7  error    fr nav.logout: not in source locale (orphan_key)
   2:5  warning  fr cart.items_*: fr needs one/many/other, has one/other (plural_missing_category)
```

## What it catches that a token comparison does not

Comparing placeholders as text is easy and wrong in five common ways. Each of these came from running the checks over Laravel-Lang, rails-i18n, Sphinx and Grafana — real defects and real false alarms, none of which a hand-written fixture produced.

**Every syntax, not just ICU.** `{{name}}` (i18next), `{name}` and `{count, plural, …}` (ICU), `%{name}` (Ruby), `%s` and `%1$s` (printf), `<0>…</0>` (react-i18next `<Trans>`), and `:name` (Laravel). Patterns are applied most-specific first, so `{{name}}` is never also counted as `{name}`.

**Laravel substitutes with `strtr()`, which needs no word boundary.** Somali writes `:attributeka`, gluing the definite article onto the token; Shona writes `ne:terms_of_service`, glued on the left. Both render correctly. Read as plain tokens they are reported twice — as a lost `:attribute` and an invented `:attributeka`. On one repository that was 341 false findings, with whole locales made of noise.

**Pipe segments are alternatives.** `one|other` renders one of them, never both, so a locale that collapses three segments into one has not lost two copies of `:count`.

**Plural forms share their arguments.** English writes `less_than_x_minutes.one` as "less than a minute" and needs no count, because English `one` means exactly 1. A target that keeps the count has not invented anything.

**And the inverse, which nothing else reports.** Scottish Gaelic `one` covers 1 *and* 11; Bosnian `one` covers 21, 31 and 41. A target that drops the count there is telling the reader that twenty-one minutes is less than one minute — and no comparison against the source can see it, because relative to the source nothing is missing.

**Plural categories come from `Intl.PluralRules`.** Polish needing `one/few/many/other` where English has `one/other` is correct pluralisation, not a mismatch. Japanese having only `other` is not a missing key, and it is left out of the coverage denominator.

## Rules

Findings are grouped by concern, so severity is set the way you would set any ESLint rule.

| rule | covers |
|---|---|
| `i18n-keeper/keys` | missing keys, orphan keys, value-versus-object disagreements, unreadable files |
| `i18n-keeper/placeholders` | interpolations lost or invented |
| `i18n-keeper/plurals` | required forms, forms the language never selects, malformed ICU, the case above |
| `i18n-keeper/glossary` | terms that must be translated one way, terms that must not be translated |
| `i18n-keeper/length` | translations wider than the space reserved for them |
| `i18n-keeper/wording` | untranslated strings, one source rendered two ways |
| `i18n-keeper/memory` | translations older than the source they were made from |

`wording` and `memory` are off in the recommended config: the first is right more often than not on real data — country names, product names, borrowed words — and the second needs a translation memory (`i18n-keeper sync`) before it can say anything.

## Options

```js
{
  files: ['**/locales/**/*.json/*.js'],
  rules: {
    'i18n-keeper/keys': ['error', { localesDir: 'src/i18n', sourceLocale: 'en-GB' }],
  },
}
```

Both are optional. The locales directory is found by looking in the usual places, and the source locale defaults to `en` — or, when there is no plain `en`, to the most complete locale rather than the alphabetically first.

Glossary, width limits and the translation memory are read from `.i18n/` at the project root when they exist, the same files the CLI uses.

## How it works, and why the line numbers are right

ESLint lints one file at a time; these checks judge a locale against every other locale in the project. So the whole project is checked once and the findings are handed out per file, with the result cached until a locale file changes.

Locale files are not JavaScript, so a processor comments out every line — giving ESLint a valid empty program with the *original line count*. A finding then reports on the line its key is written on, which is what makes the output usable in an editor rather than a list of problems attributed to line 0.

## Requirements

ESLint 9 or newer, flat config, Node 20 or newer.

## Licence

MIT.
