/* How well does the bundled text recogniser (Tesseract) read worked solutions? Renders eight short solutions in three
   styles (clean print, slanted serif, jittered "handwriting-like") and scores the characters read correctly.
   Needs the site running locally (npm run serve) and Playwright:  node scripts/ocr-benchmark.js [verbose]
   Result on 2026-11-23: clean print 92.8%, slanted serif 86.8%, handwriting-like 72.4% of characters (3, 2 and 0 of 8
   solutions read perfectly). That is why the app does not claim to read handwriting. */
const { chromium } = require('playwright');
const SAMPLES = [
 'd/dx(x^2 sin x)\n= 2x sin x + x^2 cos x',
 '2x + 3 = 7\n2x = 4\nx = 2',
 'd/dx(cos x)\n= -sin x',
 '(x+1)^2 - (x-1)^2\n= 4x',
 'f(x) = x^3 + 5x\nf\'(x) = 3x^2 + 5',
 '3(x - 2) + 4 = 13\n3x = 15\nx = 5',
 '∫ 3x^2 dx\n= x^3 + C',
 'x^2 - 5x + 6 = 0\n(x-2)(x-3) = 0'];
const STYLES = [['clean print', '30px "Liberation Sans"', 0], ['slanted serif', 'italic 32px "FreeSerif"', 0.35], ['handwriting-like', 'italic 34px "FreeSerif"', 1]];
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const norm = s => s.replace(/[−–]/g, '-').replace(/\s+/g, '').toLowerCase();
(async () => {
  const b = await chromium.launch(); const p = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
  await p.goto((process.env.BASE || 'http://localhost:8080') + '/app.html'); await p.waitForFunction(() => window.__calc);
  await p.evaluate(() => new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'vendor/tesseract/tesseract.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }));
  const results = {};
  for (const [label, font, wobble] of STYLES) {
    let tot = 0, err = 0; const exact = []; 
    for (const smp of SAMPLES) {
      const text = await p.evaluate(async ([smp, font, wobble]) => {
        const lines = smp.split('\n'), cv = document.createElement('canvas'); cv.width = 760; cv.height = 40 + lines.length * 74; const g = cv.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#1a1a2e'; g.font = font; g.textBaseline = 'alphabetic';
        let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        lines.forEach((ln, li) => { let x = 30 + (wobble ? rnd() * 14 : 0), y = 60 + li * 74 + (wobble ? Math.sin(li) * 6 : 0);
          for (const ch of ln) { g.save(); const j = wobble * 5; g.translate(x, y + (rnd() - .5) * j * 2); g.rotate((rnd() - .5) * wobble * 0.22); g.font = font.replace(/(\d+)px/, (m, n) => (+n * (1 + (rnd() - .5) * wobble * 0.3)) + 'px'); g.fillText(ch, 0, 0); x += g.measureText(ch).width + (rnd() - .3) * wobble * 3; g.restore(); } });
        if (wobble) { const c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height; const g2 = c2.getContext('2d'); g2.filter = 'blur(1.1px) contrast(1.5)'; g2.drawImage(cv, 0, 0); cv.getContext('2d').drawImage(c2, 0, 0); }
        const w = await Tesseract.createWorker('eng', 1, { workerPath: 'vendor/tesseract/worker.min.js', corePath: 'vendor/tesseract/', langPath: 'vendor/tesseract/lang/', gzip: true });
        await w.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' }); const r = await w.recognize(cv); await w.terminate(); return r.data.text; }, [smp, font, wobble]);
      const a = norm(smp), bb = norm(text); tot += a.length; err += lev(a, bb); exact.push(a === bb);
      if (process.argv[2]) console.log(`   [${label}] ${JSON.stringify(smp)} -> ${JSON.stringify(text.trim())}`);
    }
    results[label] = { charAccuracy: +(100 * (1 - err / tot)).toFixed(1), perfectLines: `${exact.filter(Boolean).length}/${SAMPLES.length}` };
    console.log(label.padEnd(18), JSON.stringify(results[label]));
  }
  await b.close();
})();
