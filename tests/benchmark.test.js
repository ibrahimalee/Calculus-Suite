// A quick slice of the accuracy benchmark (scripts/benchmark.js --quick): every answer is checked against ground truth that
// does not come from the engine. Any wrong or unreadable answer, any false alarm from "Check my work", or any planted
// mistake it fails to catch, fails the build. The full benchmark is published on accuracy.html.
const test = require('node:test'), assert = require('node:assert');
const { execFileSync } = require('node:child_process'), path = require('node:path');

test('accuracy benchmark (quick slice): no wrong answers, no false alarms, every planted mistake caught', { timeout: 240000 }, () => {
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'scripts', 'benchmark.js'), '--quick', '--no-exit'], { encoding: 'utf8', timeout: 230000 });
  const tot = /^TOTAL\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/m.exec(out); assert.ok(tot, out.slice(-600));
  const [, total, right, declined, wrong, unread] = tot.map(Number);
  assert.ok(total >= 100, 'too few problems: ' + total);
  assert.equal(wrong, 0, out); assert.equal(unread, 0, out); assert.ok(right / total > 0.9, `only ${right} of ${total} right`);
  const acc = /correct working accepted (\d+)\/(\d+)/.exec(out); assert.ok(acc && acc[1] === acc[2], 'false alarms: ' + (acc && acc[0]));
  const planted = [...out.matchAll(/planted mistake, .*?: caught (\d+)\/(\d+)/g)]; assert.ok(planted.length >= 7);
  planted.forEach(m => assert.equal(m[1], m[2], m[0]));
});
