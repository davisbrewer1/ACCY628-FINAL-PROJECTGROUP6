const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "_compact", "apply");
const files = fs
  .readdirSync(dir)
  .filter((f) => /^\d+\.sql$/.test(f))
  .sort();
const outdir = path.join(dir, "merged");
fs.mkdirSync(outdir, { recursive: true });
for (const f of fs.readdirSync(outdir)) fs.unlinkSync(path.join(outdir, f));

const MAX = 40000;
let cur = "";
let n = 0;
const manifest = [];
for (const f of files) {
  const s = `${fs.readFileSync(path.join(dir, f), "utf8").trim()}\n`;
  if (cur && cur.length + s.length > MAX) {
    n += 1;
    const name = `${String(n).padStart(2, "0")}.sql`;
    fs.writeFileSync(path.join(outdir, name), cur);
    manifest.push({ name, len: cur.length });
    cur = "";
  }
  cur += `${s}\n`;
}
if (cur.trim()) {
  n += 1;
  const name = `${String(n).padStart(2, "0")}.sql`;
  fs.writeFileSync(path.join(outdir, name), cur);
  manifest.push({ name, len: cur.length });
}
console.log(JSON.stringify({ count: manifest.length, manifest }, null, 2));
