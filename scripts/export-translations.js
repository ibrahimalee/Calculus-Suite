// Writes translations-review.csv: one row per interface string, one column per language, plus empty columns for a
// native-speaker reviewer to fill in. Open it in any spreadsheet. Usage: npm run i18n:export
const fs = require('fs'), path = require('path');
const I18N = require('../js/i18n.js');
const cols = ['en', 'es', 'fr', 'ar', 'ur', 'hi'];
const q = s => '"' + String(s).replace(/"/g, '""') + '"';
const rows = [['English (source)', 'Español', 'Français', 'العربية', 'اردو', 'हिन्दी', 'Reviewer name', 'Language reviewed', 'Corrected text', 'Notes'].map(q).join(',')];
for (const [en, t] of Object.entries(I18N.D)) rows.push([en, ...t, '', '', '', ''].map(q).join(','));
fs.writeFileSync(path.join(__dirname, '..', 'translations-review.csv'), '﻿' + rows.join('\r\n') + '\r\n');
console.log(`Wrote translations-review.csv with ${rows.length - 1} strings.`);
