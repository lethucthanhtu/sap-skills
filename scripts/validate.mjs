#!/usr/bin/env node
/**
 * `npm run validate` — offline checks that gate every commit and CI run.
 *
 * Why: the package has no build step that would catch a malformed SKILL.md, a reference
 * file nobody routes to, a dead relative link, an over-privileged agent, or eval cases
 * that drifted from their source. This script fails fast on all of them and prints a
 * token-budget table so description bloat is visible in review.
 *
 * Flags:
 *   --online   also fetch every external URL (slow, network-dependent; not used in CI by default)
 *
 * Forbidden terms (internal names that must never land in this public repo) are read
 * from the untracked file `.forbidden-terms` (one term per line) or `SAP_SKILLS_FORBIDDEN`
 * (comma-separated), so the list itself is never published.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSkills, listDomains, walk } from './lib/repo.mjs';
import {
  lintSkill,
  lintDomainRouting,
  lintAgent,
  lintManifests,
  lintTriggerCases,
  lintContent,
  relativeLinks,
  externalLinks,
  estimateTokens,
} from './lib/lint.mjs';
import { renderAll } from './lib/evals.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const online = process.argv.includes('--online');
const errors = [];
const read = (p) => readFileSync(join(root, p), 'utf8');

// 1. Skill: root SKILL.md frontmatter + routing into domain/<name>/DOMAIN.md.
const skills = listSkills(root);
const domains = listDomains(root);
if (skills.length === 0) errors.push('SKILL.md is missing at the repository root');
if (domains.length === 0) errors.push('no domains found under domain/');
const files = walk(root);
const budget = [];
for (const s of skills) {
  const { errors: e, body } = lintSkill({
    dir: s.dir,
    text: s.text,
    packagedForClaudeAi: s.modelInvocable,
  });
  errors.push(...e.map((m) => m.replace(`${s.dir}/SKILL.md`, 'SKILL.md')));
  errors.push(
    ...lintDomainRouting({
      skillBody: body,
      rootReferences: s.references,
      domains,
      referenceTexts: files
        .filter((f) => /^(?:domain\/[^/]+\/)?references\/[^/]+\.md$/.test(f))
        .map((f) => ({ file: f, text: read(f) })),
    }),
  );
  budget.push({
    file: 'SKILL.md',
    alwaysOn: s.modelInvocable
      ? estimateTokens(`${s.data.name ?? ''} ${s.data.description ?? ''}`)
      : 0,
    onInvoke: estimateTokens(body),
    references: s.references.reduce((n, f) => n + estimateTokens(read(`references/${f}`)), 0),
  });
}
for (const d of domains) {
  budget.push({
    file: `domain/${d.name}/DOMAIN.md`,
    alwaysOn: 0,
    onInvoke: estimateTokens(d.text),
    references: d.references.reduce(
      (n, f) => n + estimateTokens(read(`domain/${d.name}/references/${f}`)),
      0,
    ),
  });
}

// 2. Agents.
for (const f of files.filter((p) => /^agents\/[^/]+\.md$/.test(p)))
  errors.push(...lintAgent({ file: f, text: read(f) }));

// 3. Manifests.
try {
  errors.push(
    ...lintManifests({
      plugin: JSON.parse(read('.claude-plugin/plugin.json')),
      marketplace: JSON.parse(read('.claude-plugin/marketplace.json')),
    }),
  );
} catch (e) {
  errors.push(`manifest: ${e.message}`);
}

// 4. Trigger evals: schema + generated files in sync.
if (existsSync(join(root, 'evals/triggers.json'))) {
  const cases = JSON.parse(read('evals/triggers.json'));
  const invocable = skills.filter((s) => s.modelInvocable).map((s) => s.dir);
  errors.push(...lintTriggerCases({ cases, skillNames: invocable }));
  const expected = renderAll(cases, invocable);
  for (const [p, content] of expected) {
    const actual = existsSync(join(root, p)) ? read(p).replace(/\r\n/g, '\n') : null;
    if (actual !== content) errors.push(`${p}: out of date — run \`npm run evals:gen\``);
  }
  for (const p of files.filter((f) => /^evals\/triggers\/[^/]+\/case\.yaml$/.test(f))) {
    if (!expected.has(p)) errors.push(`${p}: stale case with no entry in evals/triggers.json`);
  }
} else errors.push('evals/triggers.json is missing');

// 5. Relative links, secrets, forbidden terms across every text file.
const forbidden = [
  ...(existsSync(join(root, '.forbidden-terms')) ? read('.forbidden-terms').split(/\r?\n/) : []),
  ...(process.env.SAP_SKILLS_FORBIDDEN ?? '').split(','),
]
  .map((t) => t.trim())
  .filter((t) => t && !t.startsWith('#'));
const textFiles = files.filter(
  (f) => /\.(md|json|ya?ml|mjs|js|txt)$/.test(f) && f !== '.forbidden-terms',
);
const urls = new Map();
for (const f of textFiles) {
  const text = read(f);
  errors.push(...lintContent({ file: f, text, forbiddenTerms: forbidden }));
  if (!f.endsWith('.md')) continue;
  for (const link of relativeLinks(text)) {
    const target = posix.normalize(posix.join(posix.dirname(f), decodeURIComponent(link)));
    if (target.startsWith('..') || !existsSync(join(root, target)))
      errors.push(`${f}: broken relative link → ${link}`);
  }
  for (const m of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)) {
    if (!existsSync(join(root, m[1])))
      errors.push(`${f}: \${CLAUDE_PLUGIN_ROOT}/${m[1]} does not exist`);
  }
  for (const u of externalLinks(text)) if (!urls.has(u)) urls.set(u, f);
}

// 6. Optional online link check.
if (online) {
  const skipHost = /(?:^|\.)(?:example\.com|localhost)$|<|\{/;
  const list = [...urls.keys()].filter((u) => !skipHost.test(new URL(u).hostname + u));
  const results = await Promise.all(
    list.map(async (u) => {
      try {
        const res = await fetch(u, {
          method: 'GET',
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });
        return res.status >= 400 && res.status !== 403 && res.status !== 429
          ? `${res.status}`
          : null;
      } catch (e) {
        return e.name;
      }
    }),
  );
  results.forEach(
    (r, i) => r && errors.push(`${urls.get(list[i])}: dead link (${r}) → ${list[i]}`),
  );
  console.log(`online link check: ${list.length} URLs, ${results.filter(Boolean).length} failing`);
}

console.log('Token budget (estimated, chars/4):');
console.table(budget);
console.log(
  `checked ${skills.length} skill, ${domains.length} domains, ${files.filter((p) => p.startsWith('agents/')).length} agents, ${textFiles.length} text files, ${urls.size} external URLs`,
);

if (errors.length) {
  console.error(`\n✖ ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('✔ validation passed');
