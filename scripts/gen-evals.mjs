#!/usr/bin/env node
/**
 * `npm run evals:gen` — regenerate `evals/triggers/<id>/case.yaml` from `evals/triggers.json`.
 *
 * Why: keeps the human-edited trigger list (one line per prompt) as the only source of
 * truth; `npm run validate` fails when the generated files drift. Stale case folders
 * are deleted so removed prompts don't keep running.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSkills } from './lib/repo.mjs';
import { renderAll } from './lib/evals.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cases = JSON.parse(readFileSync(join(root, 'evals/triggers.json'), 'utf8'));
const skills = listSkills(root)
  .filter((s) => s.modelInvocable)
  .map((s) => s.dir); // ['sap']: the root SKILL.md
const files = renderAll(cases, skills);

const triggerDir = join(root, 'evals/triggers');
if (existsSync(triggerDir)) {
  const wanted = new Set(cases.map((c) => c.id));
  for (const d of readdirSync(triggerDir))
    if (!wanted.has(d)) rmSync(join(triggerDir, d), { recursive: true });
}
for (const [p, content] of files) {
  mkdirSync(dirname(join(root, p)), { recursive: true });
  writeFileSync(join(root, p), content);
}
console.log(`wrote ${files.size} trigger cases to evals/triggers/`);
