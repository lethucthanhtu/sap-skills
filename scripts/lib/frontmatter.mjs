/**
 * Minimal YAML-frontmatter reader for SKILL.md and agent files.
 *
 * Why hand-rolled: the repo ships with zero npm dependencies so the checks run on a
 * bare Node install (CI, claude.ai packaging, contributors on Windows). Skill and agent
 * frontmatter only uses a tiny YAML subset — scalars, quoted strings, folded/literal
 * blocks (`>` / `|`), inline lists (`[a, b]`) and dash lists — so that is all we parse.
 * Anything fancier is reported as an error instead of being silently misread.
 * @module frontmatter
 */

/**
 * Split a Markdown document into its frontmatter block and body.
 * Returning `null` for a missing block lets callers report the file instead of crashing.
 * @param {string} text Full file contents.
 * @returns {{ raw: string, body: string } | null}
 */
export function splitFrontmatter(text) {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match) return null;
  return { raw: match[1], body: normalized.slice(match[0].length) };
}

/**
 * Strip matching surrounding quotes, because authors quote descriptions that contain
 * colons and the lint must see the same text the host will.
 * @param {string} value
 * @returns {string}
 */
function unquote(value) {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Parse the YAML subset used by skill/agent frontmatter into a plain object.
 * Throws with a line number so a broken manifest fails CI with an actionable message.
 * @param {string} raw Frontmatter text without the `---` fences.
 * @returns {Record<string, string | string[] | boolean>}
 */
export function parseFrontmatter(raw) {
  /** @type {Record<string, string | string[] | boolean>} */
  const out = {};
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (/^\s/.test(line)) {
      throw new Error(`frontmatter line ${i + 1}: unexpected indentation: "${line.trim()}"`);
    }
    const kv = /^([A-Za-z][\w-]*):(?:\s+(.*))?$/.exec(line);
    if (!kv) throw new Error(`frontmatter line ${i + 1}: expected "key: value", got "${line}"`);
    const [, key, rest = ''] = kv;
    if (key in out) throw new Error(`frontmatter line ${i + 1}: duplicate key "${key}"`);
    const value = rest.trim();

    if (value === '>' || value === '>-' || value === '|' || value === '|-') {
      const block = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1] === '')) {
        block.push(lines[++i].trim());
      }
      out[key] = value.startsWith('>')
        ? block.join(' ').replace(/\s+/g, ' ').trim()
        : block.join('\n').trim();
    } else if (value === '') {
      const items = [];
      while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) {
        items.push(unquote(lines[++i].replace(/^\s+-\s+/, '')));
      }
      out[key] = items;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      out[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => unquote(s))
        .filter(Boolean);
    } else if (value === 'true' || value === 'false') {
      out[key] = value === 'true';
    } else {
      out[key] = unquote(value);
    }
  }
  return out;
}

/**
 * Read frontmatter + body in one call; the common case for every linter rule.
 * @param {string} text
 * @returns {{ data: Record<string, string | string[] | boolean>, body: string } | null}
 */
export function readFrontmatter(text) {
  const split = splitFrontmatter(text);
  if (!split) return null;
  return { data: parseFrontmatter(split.raw), body: split.body };
}
