/**
 * Unit tests for the zero-dependency tooling. They pin the behaviours the hosts care
 * about: frontmatter is read the way Claude reads it, ZIPs open, lint rules fire.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { parseFrontmatter, readFrontmatter } from '../scripts/lib/frontmatter.mjs';
import { createZip, listZipEntries } from '../scripts/lib/zip.mjs';
import {
  lintSkill,
  lintDomainRouting,
  lintAgent,
  lintManifests,
  lintTriggerCases,
  lintContent,
  relativeLinks,
  externalLinks,
} from '../scripts/lib/lint.mjs';
import { renderCase } from '../scripts/lib/evals.mjs';

const goodSkill = (extra = '') => `---
name: sap
description: >
  SAP help. Use when the user asks
  about ABAP.
${extra}---

# Body
See references/cds.md.
`;

test('frontmatter: folded block, inline list, dash list, booleans, quotes', () => {
  const data = parseFrontmatter(
    [
      'name: x',
      'description: >',
      '  a',
      '  b',
      'tools: [Read, "Grep"]',
      'skills:',
      '  - sap',
      'flag: true',
      'q: "a: b"',
    ].join('\n'),
  );
  assert.deepEqual(data, {
    name: 'x',
    description: 'a b',
    tools: ['Read', 'Grep'],
    skills: ['sap'],
    flag: true,
    q: 'a: b',
  });
});

test('frontmatter: CRLF and BOM are tolerated, missing block returns null', () => {
  assert.equal(readFrontmatter('﻿---\r\nname: a\r\n---\r\nbody').data.name, 'a');
  assert.equal(readFrontmatter('# no frontmatter'), null);
});

test('frontmatter: duplicate keys and junk lines throw with a line number', () => {
  assert.throws(() => parseFrontmatter('a: 1\na: 2'), /line 2: duplicate key/);
  assert.throws(() => parseFrontmatter('not yaml'), /line 1/);
});

test('zip: round-trips names and content, deterministic, rejects traversal', () => {
  const entries = [
    { name: 'sap/SKILL.md', data: Buffer.from('hello') },
    { name: 'sap/references/a.md', data: Buffer.from('x'.repeat(1000)) },
  ];
  const zip = createZip(entries);
  assert.deepEqual(listZipEntries(zip), ['sap/SKILL.md', 'sap/references/a.md']);
  assert.ok(
    createZip([...entries].reverse()).equals(zip),
    'same input in any order → identical bytes',
  );
  // First local header: name at offset 30, data right after.
  const nameLen = zip.readUInt16LE(26);
  const size = zip.readUInt32LE(18);
  assert.equal(inflateRawSync(zip.subarray(30 + nameLen, 30 + nameLen + size)).toString(), 'hello');
  assert.throws(() => createZip([{ name: '../evil', data: Buffer.alloc(0) }]), /unsafe/);
  assert.throws(() => createZip([{ name: 'a\\b', data: Buffer.alloc(0) }]), /unsafe/);
});

test('lintSkill: accepts a good skill', () => {
  assert.deepEqual(
    lintSkill({ dir: 'sap', text: goodSkill(), packagedForClaudeAi: true }).errors,
    [],
  );
});

test('lintSkill: catches name mismatch, missing trigger phrase, long description, bad keys', () => {
  const bad = `---\nname: Other\ndescription: ${'x'.repeat(1100)}\nfoo: bar\n---\nbody`;
  const { errors } = lintSkill({ dir: 'sap', text: bad, packagedForClaudeAi: true });
  const joined = errors.join('\n');
  assert.match(joined, /must match folder/);
  assert.match(joined, /lowercase/);
  assert.match(joined, /max 1024/);
  assert.match(joined, /"Use when/);
  assert.match(joined, /key "foo" is not allowed/);
});

test('lintSkill: Claude Code-only keys are allowed only when not packaged for claude.ai', () => {
  const text = goodSkill('disable-model-invocation: true\n');
  assert.equal(lintSkill({ dir: 'sap', text, packagedForClaudeAi: false }).errors.length, 0);
  assert.match(
    lintSkill({ dir: 'sap', text, packagedForClaudeAi: true }).errors.join(),
    /disable-model-invocation/,
  );
});

test('lintDomainRouting: accepts a fully wired layout', () => {
  const domains = [
    {
      name: 'cds',
      text: 'see references/annotations.md and ../../references/x',
      references: ['annotations.md'],
    },
    {
      name: 'rap',
      text: 'read references/draft.md; cross: domain/cds/references/annotations.md',
      references: ['draft.md'],
    },
  ];
  const errors = lintDomainRouting({
    skillBody: 'route domain/cds/DOMAIN.md and domain/rap/DOMAIN.md; see references/matrix.md',
    rootReferences: ['matrix.md'],
    domains,
    referenceTexts: [
      {
        file: 'domain/rap/references/draft.md',
        text: 'also references/draft.md and references/matrix.md',
      },
    ],
  });
  assert.deepEqual(errors, []);
});

test('lintDomainRouting: missing files, orphans and unrouted domains', () => {
  const errors = lintDomainRouting({
    skillBody: 'route domain/cds/DOMAIN.md and domain/cds/references/gone.md; references/nope.md',
    rootReferences: ['unused.md'],
    domains: [
      {
        name: 'cds',
        text: 'read references/a.md and references/missing.md',
        references: ['a.md', 'orphan.md'],
      },
      { name: 'rap', text: 'x', references: [] },
      { name: 'empty', text: '', references: [] },
    ],
    referenceTexts: [{ file: 'domain/cds/references/a.md', text: 'see references/cloud.md' }],
  });
  const all = errors.join('\n');
  assert.match(all, /SKILL\.md: routes to missing file domain\/cds\/references\/gone\.md/);
  assert.match(all, /SKILL\.md: routes to missing file references\/nope\.md/);
  assert.match(all, /domain\/cds\/DOMAIN\.md: routes to missing file references\/missing\.md/);
  assert.match(all, /domain\/cds\/references\/a\.md: routes to missing file references\/cloud\.md/);
  assert.match(all, /domain\/cds\/references\/orphan\.md: not referenced/);
  assert.match(all, /references\/unused\.md: not referenced from SKILL\.md/);
  assert.match(all, /domain\/rap\/DOMAIN\.md: not routed from SKILL\.md/);
  assert.match(all, /domain\/empty: missing DOMAIN\.md/);
  assert.equal(errors.length, 8);
});

test('lintDomainRouting: a cross-link from another domain does not count as a route', () => {
  const errors = lintDomainRouting({
    skillBody: 'domain/a/DOMAIN.md domain/b/DOMAIN.md',
    rootReferences: [],
    domains: [
      { name: 'a', text: 'nothing routed', references: ['x.md'] },
      { name: 'b', text: 'see domain/a/references/x.md', references: [] },
    ],
  });
  assert.deepEqual(errors, [
    'domain/a/references/x.md: not referenced from its DOMAIN.md (orphan)',
  ]);
});

test('relativeLinks: ignores URLs, anchors and code', () => {
  const md =
    '[a](./x.md) [b](https://e.com) [c](#top) `[d](y.md)`\n```\n[e](z.md)\n```\n[f](dir/g.md#sec)';
  assert.deepEqual(relativeLinks(md), ['./x.md', 'dir/g.md']);
  assert.deepEqual(externalLinks('see https://help.sap.com/docs. and (https://a.b/c)'), [
    'https://help.sap.com/docs',
    'https://a.b/c',
  ]);
});

test('lintAgent: requires explicit read-only tools and matching name', () => {
  const body = 'x'.repeat(250);
  const ok = `---\nname: abap-reviewer\ndescription: Reviews ABAP code for clean core and ABAP Cloud issues.\ntools: Read, Grep, Glob\n---\n${body}`;
  assert.deepEqual(lintAgent({ file: 'agents/abap-reviewer.md', text: ok }), []);
  const bad = `---\nname: wrong\ndescription: short\ntools: Read, Bash, Edit\n---\nhi`;
  const errs = lintAgent({ file: 'agents/abap-reviewer.md', text: bad }).join('\n');
  assert.match(errs, /must match file name/);
  assert.match(errs, /≥40 chars/);
  assert.match(errs, /"Bash" is not allowed/);
  assert.match(errs, /"Edit" is not allowed/);
  assert.match(errs, /too short/);
  assert.match(
    lintAgent({
      file: 'agents/a.md',
      text: `---\nname: a\ndescription: ${'d'.repeat(50)}\n---\n${body}`,
    }).join(),
    /explicit allowlist/,
  );
});

test('lintManifests: plugin entry and version must match', () => {
  const plugin = { name: 'sap', description: 'd', version: '0.2.0' };
  assert.deepEqual(
    lintManifests({
      plugin,
      marketplace: {
        name: 'm',
        owner: { name: 'o' },
        plugins: [{ name: 'sap', version: '0.2.0' }],
      },
    }),
    [],
  );
  assert.match(
    lintManifests({
      plugin,
      marketplace: {
        name: 'm',
        owner: { name: 'o' },
        plugins: [{ name: 'sap', version: '0.1.0' }],
      },
    }).join(),
    /version/,
  );
  assert.match(
    lintManifests({ plugin, marketplace: { name: 'm', owner: { name: 'o' }, plugins: [] } }).join(),
    /no plugin entry/,
  );
});

test('lintTriggerCases: ids, expected skills, positive/negative balance', () => {
  const mk = (id, expect) => ({ id, prompt: 'a realistic prompt', expect });
  const cases = [
    ...['a', 'b', 'c', 'd', 'e'].map((i) => mk(i, 'sap')),
    mk('n1', null),
    mk('n2', null),
    mk('n3', null),
  ];
  assert.deepEqual(lintTriggerCases({ cases, skillNames: ['sap'] }), []);
  const errs = lintTriggerCases({
    cases: [mk('a', 'nope'), mk('a', null)],
    skillNames: ['sap'],
  }).join('\n');
  assert.match(errs, /unknown skill "nope"/);
  assert.match(errs, /duplicate id/);
  assert.match(errs, /≥5 positive/);
});

test('lintContent: secrets and forbidden terms', () => {
  assert.match(
    lintContent({
      file: 'f',
      text: 'key ' + 'AKIA' + 'ABCDEFGHIJKLMNOP',
      forbiddenTerms: [],
    }).join(),
    /secret/,
  );
  assert.match(
    lintContent({ file: 'f', text: 'Hello ACME Corp', forbiddenTerms: ['acme'] }).join(),
    /forbidden term "acme"/,
  );
  assert.deepEqual(
    lintContent({ file: 'f', text: 'clean text', forbiddenTerms: ['acme', ''] }),
    [],
  );
});

test('renderCase: positive and negative graders', () => {
  const pos = renderCase({ id: 'rap', prompt: 'Build a "RAP" BO: draft', expect: 'sap' }, ['sap']);
  assert.match(pos, /name: "trigger-rap"/);
  assert.match(pos, /prompt: "Build a \\"RAP\\" BO: draft"/);
  assert.match(pos, /type: tool_used/);
  assert.doesNotMatch(pos, /max: 0/);
  const neg = renderCase({ id: 'py', prompt: 'Write a Python sort', expect: null }, [
    'sap',
    'other',
  ]);
  assert.match(neg, /min: 0\n {4}max: 0\n {4}arm: both/);
  assert.match(neg, /\(\?:sap\|other\)/);
});
