/**
 * Where a key sits in the file it came from.
 *
 * Findings name a key, not a line — the checks work on a flattened view of the
 * locale, and three formats flatten differently. The neighbouring plugin
 * reports everything at line 0, which is why its output is unusable in an
 * editor. Finding the line back is a small amount of work for the difference
 * between "something is wrong in this file" and a clickable position.
 */

/** The column of `name` used as a key on this line, or -1. */
function columnOf(line, name) {
  // JSON and YAML both write the key before a colon; PHP writes it before =>.
  for (const form of [`"${name}"`, `'${name}'`]) {
    const at = line.indexOf(form);
    if (at !== -1 && /^\s*(:|=>)/.test(line.slice(at + form.length))) return at;
  }
  // Bare YAML key.
  const bare = line.match(/^(\s*)([\w.-]+)\s*:/);
  if (bare && bare[2] === name) return bare[1].length;
  return -1;
}

/**
 * Looks for the outermost segment first, then the next one after it: `cart.total`
 * is found by a line holding `total` that comes after a line holding `cart`.
 * Good enough for locale files, which are shallow and usually sorted, and it
 * never invents a position — an unfound key reports at the top of the file.
 */
export function locate(text, key) {
  const parts = key.split('.').filter(Boolean);
  if (parts.length === 0) return null;

  const lines = text.split(/\r?\n/);
  let from = 0;
  let hit = null;

  for (const name of parts) {
    let found = null;
    for (let i = from; i < lines.length; i++) {
      const column = columnOf(lines[i], name);
      if (column !== -1) {
        found = { line: i + 1, column: column + 1 };
        from = i;
        break;
      }
    }
    // A segment that cannot be found means the flattened key does not follow
    // the file's own nesting — a gettext msgid, say. Keep what was found.
    if (found === null) break;
    hit = found;
  }

  return hit;
}

// U+2028 and U+2029 end a line for JavaScript but not for split('\n'), so a
// comment containing one would run into the next line and fail to parse.
const JS_LINE_BREAKS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');

/**
 * The virtual source ESLint parses: every line commented out, so the file has a
 * valid JavaScript body and exactly the original line count. Reported positions
 * then land on the real lines.
 */
export function commentOut(text) {
  return text
    .replace(JS_LINE_BREAKS, ' ')
    .split('\n')
    .map((line) => `//${line}`)
    .join('\n');
}
