// Genera un único HTML autocontenido (para publicar como Artifact de claude.ai).
// Uso: npm run build && node scripts/build-single.mjs <salida.html>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'dist/ritmo-single.html';
const assets = readdirSync('dist/assets');
const css = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.css'))}`, 'utf8');
const js = readFileSync(`dist/assets/${assets.find((f) => f.endsWith('.js'))}`, 'utf8');
if (/<\/script|<!--/i.test(js)) throw new Error('El bundle contiene secuencias que rompen un <script> inline');

const html = `<title>Ritmo</title>
<meta name="description" content="Tracker de hábitos, ánimo y progreso personal.">
<meta name="theme-color" content="#f7f4ee">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap">
<style>
${css}
</style>
<div id="root"></div>
<script type="module">
${js}
</script>
`;
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} KB)`);
