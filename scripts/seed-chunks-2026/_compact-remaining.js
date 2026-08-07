const fs = require("fs");
const path = require("path");

const dir = __dirname;
const out = path.join(dir, "_compact");
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) fs.unlinkSync(path.join(out, f));

function compactSql(sql) {
  const parts = sql.split(/(?=^insert into )/im).filter((s) => s.trim());
  const chunks = [];
  let pending = null;

  function flush() {
    if (!pending) return;
    chunks.push(
      `${pending.header} values\n${pending.rows.join(",\n")};`
    );
    pending = null;
  }

  for (let p of parts) {
    p = p.trim();
    if (!p.toLowerCase().startsWith("insert into")) {
      flush();
      chunks.push(p);
      continue;
    }
    const m = p.match(
      /^insert into ([\s\S]*?)\)\s*values\s*\(([\s\S]*)\)\s*;?\s*$/i
    );
    if (!m) {
      flush();
      chunks.push(p.endsWith(";") ? p : `${p};`);
      continue;
    }
    const header = `insert into ${m[1].trim()})`;
    const row = `(${m[2].trim()})`;
    if (pending && pending.header === header) {
      pending.rows.push(row);
    } else {
      flush();
      pending = { header, rows: [row] };
    }
  }
  flush();
  return `${chunks.join("\n\n")}\n`;
}

const files = [
  path.join(dir, "_batches", "003_c01.sql"),
  ...Array.from({ length: 9 }, (_, i) =>
    path.join(dir, `chunk${String(i + 2).padStart(2, "0")}.sql`)
  ),
];

const results = [];
let n = 0;
for (const file of files) {
  const base = path.basename(file);
  const compact = compactSql(fs.readFileSync(file, "utf8"));
  let cur = "";
  for (const stmt of compact.split(/\n\n(?=insert into |delete from |update |-- )/i)) {
    if (cur && cur.length + stmt.length > 45000) {
      n += 1;
      const name = `${String(n).padStart(2, "0")}_${base}`;
      fs.writeFileSync(path.join(out, name), cur);
      results.push({ name, len: cur.length });
      cur = "";
    }
    cur += (cur ? "\n\n" : "") + stmt;
  }
  if (cur.trim()) {
    n += 1;
    const name = `${String(n).padStart(2, "0")}_${base}`;
    fs.writeFileSync(path.join(out, name), cur);
    results.push({ name, len: cur.length });
  }
}

console.log(JSON.stringify({ count: results.length, results }, null, 2));
