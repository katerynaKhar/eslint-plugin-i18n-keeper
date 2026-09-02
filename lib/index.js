import { commentOut, locate } from './locate.js';
import { original, remember } from './source-cache.js';
import { findingsFor } from './project.js';

/**
 * ESLint lints a file; these checks judge a locale against every other locale.
 * The gap is bridged in project.js, which runs the whole check once and hands
 * out the findings per file. What is left here is the ESLint side: making a
 * locale file parseable, and turning findings into positioned messages.
 */

/** What each rule is responsible for, in the core's own vocabulary. */
const GROUPS = {
  keys: {
    description: 'Keys present in one locale and not another, or holding the wrong shape',
    ids: ['missing_key', 'orphan_key', 'structure_mismatch', 'unreadable_file'],
  },
  placeholders: {
    description: 'Interpolations lost or invented, judged by how the framework substitutes them',
    ids: ['placeholder_missing', 'placeholder_extra'],
  },
  plurals: {
    description: 'Plural forms the target language requires, and forms it never selects',
    ids: [
      'icu_syntax_error',
      'plural_missing_category',
      'plural_extra_category',
      'plural_selector_lost',
      'plural_needs_placeholder',
    ],
  },
  glossary: {
    description: 'Terms that must be translated one way, and terms that must not be translated',
    ids: ['dnt_violation', 'glossary_violation'],
  },
  length: {
    description: 'Translations wider than the space reserved for them',
    ids: ['length_over_max', 'length_overflow'],
  },
  wording: {
    description: 'Untranslated strings and the same source rendered two ways',
    ids: ['identical_to_source', 'inconsistent_translation'],
  },
  memory: {
    description: 'Translations older than the source they were made from',
    ids: ['stale', 'untracked'],
  },
};

const schema = [
  {
    type: 'object',
    properties: {
      localesDir: { type: 'string' },
      sourceLocale: { type: 'string' },
    },
    additionalProperties: false,
  },
];

const collapse = (text) => text.replace(/\s+/g, ' ').trim();

/** One ESLint rule over a set of the core's rule ids. */
function ruleFor(name, { description, ids }) {
  const wanted = new Set(ids);

  return {
    meta: {
      type: 'problem',
      docs: { description, url: `https://github.com/katerynaKhar/eslint-plugin-i18n-keeper#${name}` },
      schema,
    },
    create(context) {
      return {
        Program(node) {
          // Inside a processor block `filename` is the virtual name the
          // processor invented; the file on disk — the one the findings name —
          // is the physical one.
          const file = context.physicalFilename ?? context.filename;
          const byKey = findingsFor(file, context.options[0] ?? {});
          // Not a locale file, or a project this cannot read: say nothing
          // rather than guess. The CLI reports why.
          if (byKey === null) return;

          // The virtual text is commented out; searching it for a bare YAML
          // key would never match. The processor kept the original.
          const text = original(file) ?? context.sourceCode.text;
          for (const [key, findings] of byKey) {
            const at = locate(text, key);
            for (const finding of findings) {
              if (!wanted.has(finding.rule)) continue;
              context.report({
                node,
                loc: at
                  ? { line: at.line, column: Math.max(0, at.column - 1) }
                  : { line: 1, column: 0 },
                // A key can be a whole sentence, newlines and all, when the
                // project keys by the English text. One line per finding.
                message: collapse(`${finding.locale} ${key}: ${finding.detail} (${finding.rule})`),
              });
            }
          }
        },
      };
    },
  };
}

const rules = Object.fromEntries(
  Object.entries(GROUPS).map(([name, group]) => [name, ruleFor(name, group)]),
);

/**
 * Locale files are not JavaScript, so ESLint cannot parse them. Commenting out
 * every line gives a valid empty program with the original line count, which is
 * what lets a finding be reported on the line its key is written on. The
 * neighbouring plugin folds the file into a single comment and reports
 * everything at line 0.
 */
const processor = {
  meta: { name: 'i18n-keeper/locale', version: '0.1.0' },
  preprocess(text, filename) {
    remember(filename, text);
    return [{ text: commentOut(text), filename: 'locale.js' }];
  },
  postprocess(messages) {
    return messages.flat();
  },
  supportsAutofix: false,
};

const plugin = {
  meta: { name: 'eslint-plugin-i18n-keeper', version: '0.1.0' },
  rules,
  processors: { locale: processor },
};

/**
 * Ready-made flat config. Severities follow the core's own reasoning: anything
 * that breaks at runtime is an error, anything that reads badly is a warning,
 * and the two that need a translation memory are left off until there is one.
 */
const LOCALE_FILES = ['**/locales/**/*.{json,yml,yaml,po,pot}', '**/lang/**/*.{json,php}'];

// A processor hands ESLint a virtual file named `<the file>/locale.js`, and
// configs are matched against that path — not against the original. So the
// rules have to be attached to the virtual name, or they silently never run.
const VIRTUAL_FILES = LOCALE_FILES.map((pattern) => `${pattern}/*.js`);

plugin.configs = {
  recommended: [
    {
      name: 'i18n-keeper/processor',
      files: LOCALE_FILES,
      plugins: { 'i18n-keeper': plugin },
      processor: 'i18n-keeper/locale',
    },
    {
      name: 'i18n-keeper/recommended',
      files: VIRTUAL_FILES,
      // Declared again: a config object can only use rules from a plugin it
      // declares itself, and this is a second object.
      plugins: { 'i18n-keeper': plugin },
      rules: {
        'i18n-keeper/keys': 'error',
        'i18n-keeper/placeholders': 'error',
        'i18n-keeper/plurals': 'warn',
        'i18n-keeper/glossary': 'warn',
        'i18n-keeper/length': 'warn',
        'i18n-keeper/wording': 'off',
        'i18n-keeper/memory': 'off',
      },
    },
  ],
};

export default plugin;
export { rules, processor };
