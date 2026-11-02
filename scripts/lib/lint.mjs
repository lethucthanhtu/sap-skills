/**
 * Repository lint rules for the SAP skills package.
 *
 * Why this exists: the package is consumed by two hosts with different rules — Claude
 * Code (plugin marketplace) and claude.ai (ZIP upload). A skill that loads in one can be
 * rejected by the other, a reference file nobody routes to is dead weight, and a broken
 * relative link silently drops content the model was told to read. Every rule here maps
 * to one of those failure modes. Rules are pure functions over file contents so they can
 * be unit-tested without touching the real tree.
 * @module lint
 */
import { readFrontmatter } from './frontmatter.mjs';

/** Skill name rules shared by Claude Code and claude.ai (lowercase, digits, hyphens, ≤64). */
export const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Frontmatter keys claude.ai accepts on upload; anything else can make the upload fail. */
export const CLAUDE_AI_KEYS = new Set([
  'name',
  'description',
  'license',
  'allowed-tools',
  'metadata',
  'compatibility',
]);

/** Claude Code accepts a superset; we allow only the keys this repo actually uses. */
export const CLAUDE_CODE_SKILL_KEYS = new Set([
  ...CLAUDE_AI_KEYS,
  'disable-model-invocation',
  'argument-hint',
  'user-invocable',
]);

/** Tools that change files or run commands. Agents in this repo are advisory, so none of them may hold these. */
export const WRITE_TOOLS = new Set([
  'Write',
  'Edit',
  'NotebookEdit',
  'MultiEdit',
  'Bash',
  'PowerShell',
]);

/** Limits from the Agent Skills spec / Claude docs; exceeding them gets a skill rejected or truncated. */
export const LIMITS = { nameMax: 64, descriptionMax: 1024, bodyLinesMax: 500 };

/**
 * Rough token estimate (chars / 4). Good enough to catch budget regressions; the
 * authoritative number comes from `claude plugin details`.
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Lint one SKILL.md.
 * @param {{ dir: string, text: string, packagedForClaudeAi: boolean }} input
 *   `dir` is the skill folder name, which hosts use as the skill id.
 * @returns {{ errors: string[], data: Record<string, unknown> | null, body: string }}
 */
export function lintSkill({ dir, text, packagedForClaudeAi }) {
  const errors = [];
  let fm;
  try {
    fm = readFrontmatter(text);
  } catch (e) {
    return { errors: [`${dir}/SKILL.md: ${e.message}`], data: null, body: '' };
  }
  if (!fm) return { errors: [`${dir}/SKILL.md: missing YAML frontmatter`], data: null, body: '' };
  const { data, body } = fm;
  const where = `${dir}/SKILL.md`;

  const name = data.name;
  if (typeof name !== 'string' || !name) errors.push(`${where}: "name" is required`);
  else {
    if (name !== dir) errors.push(`${where}: name "${name}" must match folder "${dir}"`);
    if (!SKILL_NAME_RE.test(name) || name.length > LIMITS.nameMax) {
      errors.push(
        `${where}: name must be lowercase letters/digits/hyphens, ≤${LIMITS.nameMax} chars`,
      );
    }
    if (/claude|anthropic/.test(name))
      errors.push(`${where}: name must not contain "claude" or "anthropic"`);
  }

  const desc = data.description;
  if (typeof desc !== 'string' || !desc.trim()) errors.push(`${where}: "description" is required`);
  else {
    if (desc.length > LIMITS.descriptionMax) {
      errors.push(`${where}: description is ${desc.length} chars (max ${LIMITS.descriptionMax})`);
    }
    if (/[<>]/.test(desc)) errors.push(`${where}: description must not contain "<" or ">"`);
    if (!/\buse (?:this|when|for)\b/i.test(desc)) {
      errors.push(
        `${where}: description should say when to use the skill ("Use when …") so it triggers reliably`,
      );
    }
  }

  const allowed = packagedForClaudeAi ? CLAUDE_AI_KEYS : CLAUDE_CODE_SKILL_KEYS;
  for (const key of Object.keys(data)) {
    if (!allowed.has(key)) {
      errors.push(
        `${where}: frontmatter key "${key}" is not allowed${packagedForClaudeAi ? ' in a claude.ai-packaged skill' : ''}`,
      );
    }
  }

  const lines = body.split('\n').length;
  if (lines > LIMITS.bodyLinesMax) {
    errors.push(
      `${where}: body is ${lines} lines (max ${LIMITS.bodyLinesMax}); move detail into references/`,
    );
  }
  return { errors, data, body };
}

const BARE_REF_RE = /(?<![\w/.-])references\/([\w.-]+\.md)/g;
const DOMAIN_PATH_RE = /(?<![\w.-])domain\/([\w-]+)\/(DOMAIN\.md|references\/[\w.-]+\.md)/g;

/**
 * Check progressive-disclosure wiring for the root-skill + domain layout:
 *
 * - every `domain/<name>/` folder has a DOMAIN.md and is routed from SKILL.md;
 * - every bare `references/x.md` resolves — inside a domain file to that domain's
 *   `references/` (falling back to the root `references/`), elsewhere to the root;
 * - every explicit `domain/<name>/…` path exists;
 * - nothing is orphaned: each root reference is routed from SKILL.md, and each domain
 *   reference is routed from its own DOMAIN.md (bare path) or SKILL.md (full path).
 *
 * An unrouted file is never loaded, so it is dead weight in the skill.
 * @param {{
 *   skillBody: string,
 *   rootReferences: string[],
 *   domains: { name: string, text: string, references: string[] }[],
 *   referenceTexts?: { file: string, text: string }[],
 * }} input `referenceTexts` are the reference files themselves (repo-relative paths),
 *   checked for dangling paths but not counted as routes.
 * @returns {string[]} errors
 */
export function lintDomainRouting({ skillBody, rootReferences, domains, referenceTexts = [] }) {
  const errors = [];
  const byName = new Map(domains.map((d) => [d.name, d]));
  const exists = (domain, rel) => {
    const d = byName.get(domain);
    if (!d) return false;
    if (rel === 'DOMAIN.md') return d.text !== '';
    return d.references.includes(rel.slice('references/'.length));
  };
  const routed = new Set(); // "root:x.md" or "<domain>:x.md"

  /** @param {string} file @param {string} text @param {string | null} domain @param {boolean} routes */
  const scan = (file, text, domain, routes) => {
    for (const [, ref] of text.matchAll(BARE_REF_RE)) {
      if (domain && byName.get(domain)?.references.includes(ref)) {
        if (routes) routed.add(`${domain}:${ref}`);
      } else if (rootReferences.includes(ref)) {
        if (routes) routed.add(`root:${ref}`);
      } else errors.push(`${file}: routes to missing file references/${ref}`);
    }
    for (const [whole, d, rel] of text.matchAll(DOMAIN_PATH_RE)) {
      if (!exists(d, rel)) errors.push(`${file}: routes to missing file ${whole}`);
      else if (routes && rel !== 'DOMAIN.md') routed.add(`${d}:${rel.slice('references/'.length)}`);
    }
  };

  scan('SKILL.md', skillBody, null, true);
  for (const d of domains) {
    const file = `domain/${d.name}/DOMAIN.md`;
    if (!d.text) {
      errors.push(`domain/${d.name}: missing DOMAIN.md`);
      continue;
    }
    if (!skillBody.includes(file)) errors.push(`${file}: not routed from SKILL.md (orphan domain)`);
    // Only a domain's bare paths count as routes to its own references; full paths to
    // another domain are cross-links and must merely exist.
    for (const [, ref] of d.text.matchAll(BARE_REF_RE)) {
      if (d.references.includes(ref)) routed.add(`${d.name}:${ref}`);
    }
    for (const [, dn, rel] of d.text.matchAll(DOMAIN_PATH_RE)) {
      if (dn === d.name && rel !== 'DOMAIN.md')
        routed.add(`${dn}:${rel.slice('references/'.length)}`);
    }
    scan(file, d.text, d.name, false);
  }
  for (const { file, text } of referenceTexts) {
    const m = /^domain\/([\w-]+)\//.exec(file);
    scan(file, text, m ? m[1] : null, false);
  }

  for (const ref of rootReferences) {
    if (!routed.has(`root:${ref}`))
      errors.push(`references/${ref}: not referenced from SKILL.md (orphan)`);
  }
  for (const d of domains) {
    for (const ref of d.references) {
      if (!routed.has(`${d.name}:${ref}`)) {
        errors.push(
          `domain/${d.name}/references/${ref}: not referenced from its DOMAIN.md (orphan)`,
        );
      }
    }
  }
  return errors;
}

/**
 * Extract relative Markdown link targets, skipping URLs, anchors and code fences.
 * Code fences are skipped because ABAP/CDS samples legitimately contain `[x](y)`-like text.
 * @param {string} text
 * @returns {string[]}
 */
export function relativeLinks(text) {
  const withoutFences = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const links = [];
  for (const m of withoutFences.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = m[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i.test(target)) continue;
    links.push(target.split('#')[0]);
  }
  return links.filter(Boolean);
}

/**
 * Extract absolute http(s) URLs for the optional online link check.
 * @param {string} text
 * @returns {string[]}
 */
export function externalLinks(text) {
  const urls = new Set();
  for (const m of text.matchAll(/https?:\/\/[^\s)<>"'`\]|]+/g))
    urls.add(m[0].replace(/[.,;:]+$/, ''));
  return [...urls];
}

/**
 * Lint a subagent definition. Agents here are research/review helpers, so they must
 * declare an explicit, read-only tool list — inheriting every tool would let a
 * "reviewer" edit the user's code.
 * @param {{ file: string, text: string }} input
 * @returns {string[]} errors
 */
export function lintAgent({ file, text }) {
  const errors = [];
  let fm;
  try {
    fm = readFrontmatter(text);
  } catch (e) {
    return [`${file}: ${e.message}`];
  }
  if (!fm) return [`${file}: missing YAML frontmatter`];
  const { data, body } = fm;
  const expected = file.replace(/^.*\//, '').replace(/\.md$/, '');
  if (data.name !== expected)
    errors.push(`${file}: name "${data.name}" must match file name "${expected}"`);
  if (typeof data.description !== 'string' || data.description.length < 40) {
    errors.push(`${file}: description must explain when to delegate (≥40 chars)`);
  }
  const tools =
    typeof data.tools === 'string' ? data.tools.split(',').map((t) => t.trim()) : data.tools;
  if (!Array.isArray(tools) || tools.length === 0)
    errors.push(`${file}: "tools" must be an explicit allowlist`);
  else {
    for (const t of tools)
      if (WRITE_TOOLS.has(t))
        errors.push(`${file}: tool "${t}" is not allowed (agents are read-only)`);
    if (tools.includes('*')) errors.push(`${file}: wildcard "*" tools are not allowed`);
  }
  if (body.trim().length < 200)
    errors.push(`${file}: body is too short to be a useful system prompt`);
  return errors;
}

/**
 * Lint the plugin + marketplace manifests together, since a mismatch between them
 * (name, version) is what breaks `/plugin install sap@sap-skills`.
 * @param {{ plugin: any, marketplace: any }} input Parsed JSON.
 * @returns {string[]} errors
 */
export function lintManifests({ plugin, marketplace }) {
  const errors = [];
  if (!plugin?.name) errors.push('plugin.json: "name" is required');
  if (!plugin?.description) errors.push('plugin.json: "description" is required');
  if (!marketplace?.name) errors.push('marketplace.json: "name" is required');
  if (!marketplace?.owner?.name) errors.push('marketplace.json: "owner.name" is required');
  const entry = (marketplace?.plugins ?? []).find((p) => p.name === plugin?.name);
  if (!entry) errors.push(`marketplace.json: no plugin entry named "${plugin?.name}"`);
  else if (entry.version && plugin.version && entry.version !== plugin.version) {
    errors.push(
      `marketplace.json: version ${entry.version} ≠ plugin.json version ${plugin.version}`,
    );
  }
  return errors;
}

/**
 * Lint the trigger-eval source file.
 * @param {{ cases: any[], skillNames: string[] }} input
 * @returns {string[]} errors
 */
export function lintTriggerCases({ cases, skillNames }) {
  const errors = [];
  if (!Array.isArray(cases) || cases.length === 0)
    return ['evals/triggers.json: must be a non-empty array'];
  const ids = new Set();
  let positives = 0;
  let negatives = 0;
  for (const c of cases) {
    if (!c.id || !/^[a-z0-9-]+$/.test(c.id)) errors.push(`evals/triggers.json: bad id "${c.id}"`);
    if (ids.has(c.id)) errors.push(`evals/triggers.json: duplicate id "${c.id}"`);
    ids.add(c.id);
    if (typeof c.prompt !== 'string' || c.prompt.length < 10)
      errors.push(`evals/triggers.json: ${c.id} needs a prompt`);
    if (c.expect === null) negatives++;
    else if (skillNames.includes(c.expect)) positives++;
    else errors.push(`evals/triggers.json: ${c.id} expects unknown skill "${c.expect}"`);
  }
  if (positives < 5) errors.push(`evals/triggers.json: need ≥5 positive cases (have ${positives})`);
  if (negatives < 3) errors.push(`evals/triggers.json: need ≥3 negative cases (have ${negatives})`);
  return errors;
}

/** Patterns that look like credentials; a public repo must never contain one. */
export const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  /\bsk-[A-Za-z0-9_-]{32,}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/,
];

/**
 * Scan text for secrets and for owner-supplied forbidden terms (internal customer or
 * product names that must stay out of this public repo; kept in an untracked file so the
 * list itself is not published).
 * @param {{ file: string, text: string, forbiddenTerms: string[] }} input
 * @returns {string[]} errors
 */
export function lintContent({ file, text, forbiddenTerms }) {
  const errors = [];
  for (const re of SECRET_PATTERNS)
    if (re.test(text)) errors.push(`${file}: looks like it contains a secret (${re})`);
  const lower = text.toLowerCase();
  for (const term of forbiddenTerms) {
    if (term && lower.includes(term.toLowerCase()))
      errors.push(`${file}: contains forbidden term "${term}"`);
  }
  return errors;
}
