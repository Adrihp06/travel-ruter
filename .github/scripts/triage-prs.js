// @ts-check

/**
 * Auto-triage for new pull requests.
 * - Labels based on changed file paths.
 * - Labels based on title/description keywords.
 * - No comment is posted (to avoid noise).
 */

// ── Label colors (shared with triage-issues.js) ─────────────────────

const LABEL_COLORS = {
  bug: "d73a4a",
  feature: "a2eeef",
  "docker-error": "f9d0c4",
  "api-issue": "c5def5",
  "ai-provider": "d4c5f9",
  "auth-issue": "fef2c0",
  "env-config": "bfdadc",
  maps: "c2e0c6",
  frontend: "1d76db",
  backend: "0e8a16",
  orchestrator: "5319e7",
  database: "006b75",
  "mcp-server": "b60205",
  "ci-cd": "fbca04",
  documentation: "0075ca",
  bugfix: "d73a4a",
  refactor: "c5def5",
  dependencies: "0366d6",
};

// ── File-path rules ─────────────────────────────────────────────────

const PATH_RULES = [
  { pattern: /^frontend\//, label: "frontend" },
  { pattern: /^app\//, label: "backend" },
  { pattern: /^orchestrator\//, label: "orchestrator" },
  { pattern: /^mcp_server\//, label: "mcp-server" },
  { pattern: /^alembic\//, label: "database" },
  { pattern: /^\.github\/workflows\//, label: "ci-cd" },
  { pattern: /Dockerfile/, label: "ci-cd" },
  { pattern: /^docker-compose\.yml$/, label: "ci-cd" },
  { pattern: /\.md$/, label: "documentation" },
  { pattern: /^requirements.*\.txt$/, label: "backend" },
  { pattern: /^frontend\/package\.json$/, label: "frontend" },
  { pattern: /^frontend\/nginx\.conf$/, label: "frontend" },
  { pattern: /nginx\.conf$/, label: "frontend" },
  { pattern: /^package\.json$/, label: "frontend" },
];

// ── Title/description keyword rules ─────────────────────────────────

const KEYWORD_RULES = [
  {
    label: "bugfix",
    keywords: ["fix", "bug", "patch", "hotfix", "corrige", "soluciona"],
  },
  {
    label: "feature",
    keywords: ["feat", "feature", "add", "implement", "agrega", "implementa"],
  },
  {
    label: "refactor",
    keywords: ["refactor", "cleanup", "restructure", "simplify", "mejora"],
  },
  {
    label: "dependencies",
    keywords: ["deps", "dependency", "bump", "upgrade", "dependencias"],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

async function ensureLabel(github, owner, repo, name) {
  try {
    await github.rest.issues.getLabel({ owner, repo, name });
  } catch {
    await github.rest.issues.createLabel({
      owner,
      repo,
      name,
      color: LABEL_COLORS[name] || "ededed",
    });
  }
}

function labelsFromFiles(files) {
  const labels = new Set();

  for (const file of files) {
    for (const rule of PATH_RULES) {
      if (rule.pattern.test(file)) {
        labels.add(rule.label);
      }
    }
  }

  return [...labels];
}

function labelsFromText(text) {
  const lower = text.toLowerCase();
  const labels = [];

  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        labels.push(rule.label);
        break;
      }
    }
  }

  return labels;
}

// ── Main ────────────────────────────────────────────────────────────

async function run({ github, context }) {
  const pr = context.payload.pull_request;
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  // Get changed files
  const { data: files } = await github.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pr.number,
    per_page: 100,
  });

  const filenames = files.map((f) => f.filename);
  const text = `${pr.title} ${pr.body || ""}`;

  const fileLabels = labelsFromFiles(filenames);
  const textLabels = labelsFromText(text);
  const allLabels = [...new Set([...fileLabels, ...textLabels])];

  if (allLabels.length === 0) return;

  // Ensure all labels exist and apply them
  await Promise.all(
    allLabels.map((l) => ensureLabel(github, owner, repo, l))
  );

  await github.rest.issues.addLabels({
    owner,
    repo,
    issue_number: pr.number,
    labels: allLabels,
  });
}

module.exports = { run };
