// Usage: node find.js <file> <needle> [contextBefore] [contextAfter]
const fs = require('fs');
const [file, needle, before, after] = process.argv.slice(2);
const src = fs.readFileSync(file, 'utf8');
const B = Number(before || 300), A = Number(after || 600);
let idx = 0, count = 0;
while ((idx = src.indexOf(needle, idx)) !== -1 && count < 5) {
  console.log(`\n===== @${idx} =====`);
  console.log(src.slice(Math.max(0, idx - B), idx + A).replace(/\n/g, ' '));
  idx += needle.length;
  count++;
}
if (count === 0) console.log('NOT FOUND');
