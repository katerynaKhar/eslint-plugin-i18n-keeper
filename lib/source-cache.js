/**
 * The text ESLint hands a rule inside a processor block is the virtual text the
 * processor produced — here, every line commented out. That is the right thing
 * to parse and the wrong thing to search: a bare YAML key `long:` becomes
 * `//      long:`, and looking for the key finds nothing.
 *
 * So the processor keeps the original, and the rule asks for it back.
 */

const sources = new Map();

export function remember(filename, text) {
  sources.set(filename, text);
}

export function original(filename) {
  return sources.get(filename) ?? null;
}

/** Only for the tests. */
export function forgetSources() {
  sources.clear();
}
