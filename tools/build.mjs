import { mkdir, copyFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(root, 'dist');
const files = ['index.html', 'src/app.js', 'src/engine.js', 'src/data.js', 'src/style.css'];
// Explicit allowlist: no tests, development tools, reports or source proposal are published.
await mkdir(resolve(out, 'src'), { recursive: true });
for (const file of files) await copyFile(resolve(root, file), resolve(out, file));
await writeFile(resolve(out, '.nojekyll'), '');
const actual = (await readdir(out, { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => relative(out, resolve(entry.parentPath, entry.name)).replaceAll('\\', '/'));
const allowed = [...files, '.nojekyll'];
if (actual.length !== allowed.length || actual.some(file => !allowed.includes(file))) {
  throw Error('Unexpected files in dist. Use a clean output directory before publishing.');
}
console.log(`GitHub Pages build ready: ${actual.length} files in dist/`);
