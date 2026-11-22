// Builds the app as ONE self-contained HTML file for publishing as a claude.ai artifact.
// Usage: npm run build:artifact  → artifact/icehg.html
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

execSync('npx vite build --mode artifact', { stdio: 'inherit' });
const dir = 'dist-artifact/assets';
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(`${dir}/${f}`, 'utf8'));
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`${dir}/${f}`, 'utf8'));
if (js.length !== 1) throw new Error(`expected one JS bundle, got ${js.length}`);
const safeJs = js[0].replace(/<\/script/gi, '<\\/script');
const html = `<title>I Could Eat a Horse Games</title>
<meta name="theme-color" content="#0b0d12">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap">
<style>:root{color-scheme:dark;background:#0b0d12}body{background:#0b0d12}</style>
<style>${css.join('\n')}</style>
<div id="root"></div>
<script type="module">${safeJs}</script>
`;
mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/icehg.html', html);
console.log(`artifact/icehg.html: ${(html.length / 1024).toFixed(0)} KB`);
