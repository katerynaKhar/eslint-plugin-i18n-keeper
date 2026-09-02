// The plugin is a delivery mechanism: the checks are i18n-keeper's, and what is
// worth asserting here is the part that is this package's own — that a locale
// file is lintable at all, that findings land on the line the key is written
// on, and that the ready-made config actually attaches its rules.
import { ESLint } from 'eslint';
import plugin from '../lib/index.js';

let failed = 0;

function check(label, condition, detail) {
  if (!condition) failed++;
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${label}`);
  if (!condition && detail !== undefined) console.log(`       ${detail}`);
}

const FIXTURE = 'test/fixture/locales';

async function lint(overrideConfig) {
  const eslint = new ESLint({ overrideConfigFile: true, overrideConfig });
  return eslint.lintFiles([`${FIXTURE}/fr.json`]);
}

const explicit = [
  {
    files: [`${FIXTURE}/*.json`],
    plugins: { 'i18n-keeper': plugin },
    processor: 'i18n-keeper/locale',
  },
  {
    files: [`${FIXTURE}/*.json/*.js`],
    plugins: { 'i18n-keeper': plugin },
    rules: {
      'i18n-keeper/keys': 'error',
      'i18n-keeper/placeholders': 'error',
      'i18n-keeper/plurals': 'warn',
    },
  },
];

console.log('=== a locale file is linted at all ===');
const [result] = await lint(explicit);
const messages = result.messages;
check('three findings on fr.json', messages.length === 3, `got ${messages.length}`);

console.log('\n=== findings land on the line the key is written on ===');
// fr.json, line by line: 1 `{`, 2 `"cart": {`, 3 empty, 4 `"total"` … 10 `"logout"`.
const at = (rule) => messages.find((m) => m.ruleId === `i18n-keeper/${rule}`);

check(
  'the lost placeholder points at "total" on line 4',
  at('placeholders')?.line === 4,
  `got line ${at('placeholders')?.line}`,
);
check(
  'the orphan key points at "logout" on line 10',
  at('keys')?.line === 10,
  `got line ${at('keys')?.line}`,
);
check(
  'nothing is reported at line 0',
  messages.every((m) => m.line >= 1),
  JSON.stringify(messages.map((m) => m.line)),
);

console.log('\n=== severity comes from ESLint, not from the core ===');
check(
  'placeholders is an error, plurals a warning',
  at('placeholders')?.severity === 2 && at('plurals')?.severity === 1,
  `${at('placeholders')?.severity} / ${at('plurals')?.severity}`,
);

// The core leaves identical_to_source off by default. Switching the ESLint rule
// on has to be enough, or the config would be a lie.
console.log('\n=== a check the CLI leaves off can be switched on here ===');
const [wording] = await lint([
  explicit[0],
  { ...explicit[1], rules: { 'i18n-keeper/wording': 'warn' } },
]);
check(
  'wording reports when asked, and nothing else does',
  wording.messages.length > 0 && wording.messages.every((m) => m.ruleId === 'i18n-keeper/wording'),
  JSON.stringify(wording.messages.map((m) => `${m.ruleId}: ${m.message}`)),
);

console.log('\n=== the shipped config attaches its rules ===');
const [viaConfig] = await lint(plugin.configs.recommended);
check(
  'recommended finds the same three',
  viaConfig.messages.length === 3,
  JSON.stringify(viaConfig.messages.map((m) => m.ruleId)),
);

// The JSON fixture hid a real bug: a rule was searching the processor's
// commented-out text, and a quoted JSON key survives a `//` prefix while a bare
// YAML key does not. Every finding in a YAML catalogue landed on line 1.
console.log('\n=== a bare YAML key is found, not just a quoted JSON one ===');
const yaml = [
  {
    files: ['test/fixture-yaml/locales/*.yml'],
    plugins: { 'i18n-keeper': plugin },
    processor: 'i18n-keeper/locale',
  },
  {
    files: ['test/fixture-yaml/locales/*.yml/*.js'],
    plugins: { 'i18n-keeper': plugin },
    rules: { 'i18n-keeper/placeholders': 'error' },
  },
];
const [de] = await new ESLint({ overrideConfigFile: true, overrideConfig: yaml }).lintFiles([
  'test/fixture-yaml/locales/de.yml',
]);
check(
  'the lost placeholder points at "total:" on line 4',
  de.messages.length === 1 && de.messages[0].line === 4,
  JSON.stringify(de.messages.map((m) => `${m.line}: ${m.message}`)),
);

console.log('\n=== a file outside any locale project says nothing ===');
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    { files: ['**/*.json'], plugins: { 'i18n-keeper': plugin }, processor: 'i18n-keeper/locale' },
    {
      files: ['**/*.json/*.js'],
      plugins: { 'i18n-keeper': plugin },
      rules: { 'i18n-keeper/keys': 'error' },
    },
  ],
});
const [outside] = await eslint.lintFiles(['package.json']);
check('package.json is left alone', outside.messages.length === 0, JSON.stringify(outside.messages));

console.log(failed === 0 ? '\nall plugin checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
