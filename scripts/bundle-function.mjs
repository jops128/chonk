import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('.local', { recursive: true });
await build({ entryPoints: ['supabase/functions/chonk-sheet/index.ts'], bundle: true, format: 'esm', platform: 'neutral', external: ['zod'], outfile: '.local/chonk-sheet.js' });
const code = (await readFile('.local/chonk-sheet.js', 'utf8')).replace('from "zod"', 'from "npm:zod@4"');
await writeFile('.local/chonk-sheet.js', code);
console.log('Dashboard-ready Edge Function written to .local/chonk-sheet.js');
