# Dependency security maintenance

## 2026-10-31 CI repair

The ordinary `npm audit` gate remains enabled for all dependencies, including
build and test tooling. The workflow, audit severity and test coverage were not
weakened. This repair is independent of the in-progress surrounding-world art.

The lockfile refresh stays within the existing declared top-level ranges. It
updates Vite to 8.3.5, Vitest/mocker to 4.1.12, fast-uri to 3.1.9,
source-map-js to 1.2.2 and js-yaml to 5.4.1, among their required dependency changes.
A clean Node 24 `npm ci` resolves the checked-in lockfile reproducibly.

### Temporary, narrowly scoped overrides

The current markdownlint packages pin or constrain vulnerable transitive versions,
so a normal non-force audit fix alone leaves six reported dependency findings.
These overrides select upstream fixes rather than suppressing advisories:

| Parent | Package | Fixed version | Reason |
| --- | --- | --- | --- |
| markdownlint-cli2 | markdown-it | 15.0.3 | Parser denial-of-service fixes |
| markdownlint-cli2 | smol-toml | 1.9.1 | Malformed-input and quadratic-parser fixes |
| micromark-extension-math | katex | 0.18.2 | Trust checks with polluted option prototypes |

Primary advisories: [markdown-it](https://github.com/advisories/GHSA-vfgh-jcmw-g37q),
[smol-toml](https://github.com/advisories/GHSA-r4xh-jqrq-34v2) and
[KaTeX](https://github.com/advisories/GHSA-238p-pmpm-9mq7).

`test/ops/dependency-compat.test.mjs` exercises the actual parent package resolution,
Markdown tables/escaping, TOML config types, inline/display mathematics and disabled
unsafe-link trust. The full repository lint/verification and application tests/builds
remain required; these smoke checks are not substitutes.

Remove an override only after the parent package itself selects a patched version,
then regenerate the lockfile, run clean `npm ci`, `npm audit`, `npm test`,
`npm run verify`, both application tests/builds and the freshness gate. Do not use
`--force`, omit development dependencies from the audit, or introduce an allowlist
just to make CI green. Zero findings is the audit result at verification time,
not a guarantee against future advisories.
