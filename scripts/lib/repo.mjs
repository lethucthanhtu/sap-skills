/**
 * Filesystem discovery shared by validate, build and eval generation.
 *
 * Why one module: the three scripts must agree on what the skill and its domains are.
 * If each script globbed on its own, the build could ship a file the validator never
 * checked.
 * @module repo
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { readFrontmatter } from './frontmatter.mjs';

/**
 * @typedef {object} SkillInfo
 * @property {string} dir            Skill id (the root skill is always `sap`).
 * @property {string} path           Absolute folder path of the skill (the repo root).
 * @property {string} text           Raw SKILL.md contents.
 * @property {Record<string, unknown>} data Parsed frontmatter ({} if unparsable).
 * @property {boolean} modelInvocable False for slash-command-only skills.
 * @property {string[]} references   File names under the root `references/`.
 */

/**
 * @typedef {object} DomainInfo
 * @property {string} name        Folder name under domain/.
 * @property {string} text        Raw DOMAIN.md contents.
 * @property {string[]} references File names under domain/<name>/references/.
 */

/** Skill id; `lintSkill` checks the SKILL.md `name` against it. */
export const SKILL_ID = 'sap';

const mdFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .sort()
    : [];

/**
 * The repository is one skill: `SKILL.md` at the root routes to `domain/<name>/DOMAIN.md`.
 * Returned as a list so validate/build/eval code stays shaped for "skills".
 * @param {string} root Repository root.
 * @returns {SkillInfo[]}
 */
export function listSkills(root) {
  const file = join(root, 'SKILL.md');
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8');
  let data = {};
  try {
    data = readFrontmatter(text)?.data ?? {};
  } catch {
    /* reported by the linter */
  }
  return [
    {
      // The id hosts use: plugin skill `sap` in Claude Code, folder `sap/` in the claude.ai zip.
      dir: SKILL_ID,
      path: root,
      text,
      data,
      modelInvocable: data['disable-model-invocation'] !== true,
      references: mdFiles(join(root, 'references')),
    },
  ];
}

/**
 * Discover domains under `<root>/domain`.
 * @param {string} root
 * @returns {DomainInfo[]}
 */
export function listDomains(root) {
  const base = join(root, 'domain');
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const file = join(base, d.name, 'DOMAIN.md');
      return {
        name: d.name,
        text: existsSync(file) ? readFileSync(file, 'utf8') : '',
        references: mdFiles(join(base, d.name, 'references')),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Recursively list files, returning repo-relative POSIX paths.
 * Skips VCS, build output and generated graph data so checks only see source.
 * @param {string} root
 * @param {string} [dir]
 * @returns {string[]}
 */
export function walk(root, dir = root) {
  const skip = new Set(['.git', 'node_modules', 'dist', 'graphify-out', 'results']);
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(root, full));
    else if (statSync(full).isFile()) out.push(relative(root, full).split(sep).join('/'));
  }
  return out.sort();
}
