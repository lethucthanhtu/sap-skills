#!/usr/bin/env node
/**
 * `npm run build` — package the skills for claude.ai into `dist/claude-ai/`.
 *
 * Why: claude.ai installs skills from ZIP uploads (Customize → Skills → Upload), with
 * the skill folder at the root of the archive. Claude Code installs straight from the
 * repo, so only claude.ai needs a build. The archive holds `sap/SKILL.md`, `sap/domain/**`,
 * `sap/references/**` plus the licence files.
 *
 * Output:
 *   dist/claude-ai/sap.zip                   the claude.ai upload
 *   dist/claude-ai/project-instructions.md  paste into a claude.ai Project's instructions
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSkills, walk } from './lib/repo.mjs';
import { createZip, listZipEntries } from './lib/zip.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist/claude-ai');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

/** Files every upload carries so the GPL licence and MIT attributions travel with the content. */
const legal = ['LICENSE', 'THIRD_PARTY_NOTICES.md'].filter((f) => existsSync(join(root, f)));

/**
 * The skill is the repo root, so pick only what the skill needs: SKILL.md, the domain
 * routers and their references, and the root references. Tooling, evals and agents
 * stay out — claude.ai has no use for them.
 */
const skillFiles = walk(root).filter(
  (f) =>
    f === 'SKILL.md' ||
    /^domain\/[^/]+\/(?:DOMAIN\.md|references\/[^/]+\.md)$/.test(f) ||
    /^references\/[^/]+\.md$/.test(f),
);

const built = [];
for (const skill of listSkills(root).filter((s) => s.modelInvocable)) {
  const entries = [...skillFiles, ...legal].map((rel) => ({
    name: `${skill.dir}/${rel}`,
    data: readFileSync(join(root, rel)),
  }));
  const zip = createZip(entries);
  const file = join(out, `${skill.dir}.zip`);
  writeFileSync(file, zip);
  built.push({
    zip: `dist/claude-ai/${skill.dir}.zip`,
    files: listZipEntries(zip).length,
    kB: (zip.length / 1024).toFixed(1),
  });
}

const instructions = join(root, 'claude-ai/project-instructions.md');
if (existsSync(instructions))
  writeFileSync(join(out, 'project-instructions.md'), readFileSync(instructions));

console.table(built);
console.log(`✔ built ${built.length} claude.ai skill zip(s) in dist/claude-ai/`);
