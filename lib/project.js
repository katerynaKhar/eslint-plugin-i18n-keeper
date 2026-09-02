import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, parse, resolve } from 'node:path';
import {
  check,
  detectProject,
  glossaryPath,
  limitsPath,
  loadGlossary,
  loadLimits,
  loadMemory,
  memoryPath,
} from '@katerynakhar/i18n-keeper';

/**
 * i18n-keeper judges a locale against every other locale in the project;
 * ESLint hands over one file at a time. So the project is checked once and the
 * findings are handed out per file, rather than the check being re-run 40 times
 * with 39 of the answers thrown away.
 *
 * The cache is keyed by the modification times of the locale files, so an
 * editor holding ESLint open across an edit still sees the edit.
 */

const roots = new Map(); // starting directory -> project root or null
const reports = new Map(); // project root -> { signature, byFile }

/** Walks up from the linted file until a directory looks like a project. */
function findRoot(from, options) {
  const cached = roots.get(from);
  if (cached !== undefined) return cached;

  let dir = from;
  let found = null;
  for (;;) {
    try {
      detectProject(dir, options);
      found = dir;
      break;
    } catch {
      const up = dirname(dir);
      if (up === dir || parse(dir).root === dir) break;
      dir = up;
    }
  }

  roots.set(from, found);
  return found;
}

/** Cheap fingerprint of the locale tree: enough to notice an edit. */
function signature(localesDir) {
  const parts = [];
  const walk = (dir, depth) => {
    if (depth > 3) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full, depth + 1);
      else {
        try {
          parts.push(`${full}:${statSync(full).mtimeMs}`);
        } catch {
          /* vanished mid-walk */
        }
      }
    }
  };
  walk(localesDir, 0);
  return parts.join('|');
}

function sideFile(loader, path) {
  if (!existsSync(path)) return null;
  try {
    return loader(path);
  } catch {
    // A broken glossary or limits file is the CLI's problem to report, not
    // something to fail every locale file over.
    return null;
  }
}

/**
 * Findings for one file, as a Map of key -> findings, or null when the file is
 * not part of a project this can read.
 */
export function findingsFor(filePath, options = {}) {
  const root = findRoot(dirname(resolve(filePath)), options);
  if (root === null) return null;

  let config;
  try {
    config = detectProject(root, options);
  } catch {
    return null;
  }

  const sig = signature(config.localesDir);
  const cached = reports.get(root);
  if (cached && cached.signature === sig) return cached.byFile.get(resolve(filePath)) ?? new Map();

  // Severity belongs to ESLint here, so the core is asked for everything it
  // knows and the plugin's own rules decide what is worth saying. Without this,
  // the checks the CLI leaves off by default could never be switched on from an
  // ESLint config.
  for (const id of Object.keys(config.rules)) config.rules[id] = 'warning';

  let report;
  try {
    report = check(
      config,
      sideFile(loadMemory, memoryPath(config.root)),
      sideFile(loadGlossary, glossaryPath(config.root)),
      sideFile(loadLimits, limitsPath(config.root)),
    );
  } catch {
    return null;
  }

  const byFile = new Map();
  for (const finding of report.findings) {
    const file = resolve(finding.file);
    let keys = byFile.get(file);
    if (!keys) {
      keys = new Map();
      byFile.set(file, keys);
    }
    const list = keys.get(finding.key) ?? [];
    list.push(finding);
    keys.set(finding.key, list);
  }

  reports.set(root, { signature: sig, byFile });
  return byFile.get(resolve(filePath)) ?? new Map();
}

/** Only for the tests: forget everything learned so far. */
export function forget() {
  roots.clear();
  reports.clear();
}
