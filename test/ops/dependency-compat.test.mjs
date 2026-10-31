import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { micromark } from 'micromark';
import { math, mathHtml } from 'micromark-extension-math';

// Exercise the actual parent dependency resolution, including scoped overrides.
const lintRequire = createRequire(import.meta.resolve('markdownlint-cli2'));
const MarkdownIt = lintRequire('markdown-it');
const { parse } = lintRequire('smol-toml');

test('patched markdown parser retains tables, escaping and safe links', () => {
  const parser = new MarkdownIt();
  const result = parser.render('| subject | count |\n| --- | --- |\n| math | 12 |\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))\n');
  assert.match(result, /<table>/);
  assert.match(result, /&lt;script&gt;/);
  assert.doesNotMatch(result, /href="javascript:/);
});

test('patched TOML parser retains markdownlint configuration types', () => {
  const result = parse('globs = ["*.md", "docs/*.md"]\n[config]\nMD013 = false\nMD060 = false\n');
  assert.deepEqual(result.globs, ['*.md', 'docs/*.md']);
  assert.equal(result.config.MD013, false);
});

test('math extension remains compatible with patched KaTeX and keeps trust disabled', () => {
  const options = { extensions: [math()], htmlExtensions: [mathHtml({ trust: false, throwOnError: false })] };
  const result = micromark('A formula $x^2 + \\frac{1}{2}$.\n\n$$\n\\sqrt{4} = 2\n$$\n', options);
  assert.match(result, /class="katex"/);
  assert.match(result, /katex-display/);
  assert.doesNotMatch(result, /katex-error/);
  const unsafe = micromark('$\\href{javascript:alert(1)}{x}$', options);
  assert.doesNotMatch(unsafe, /href="javascript:/);
});
