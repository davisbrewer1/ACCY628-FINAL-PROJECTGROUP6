const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "_compact");
const out = path.join(dir, "apply");
fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) fs.unlinkSync(path.join(out, f));

const MAX = 20000;

function splitMultiValues(sql) {
  const valuesIdx = sql.search(/\bvalues\b/i);
  if (valuesIdx < 0) return [sql.trim().endsWith(";") ? sql.trim() : `${sql.trim()};`];
  const header = sql.slice(0, valuesIdx + "values".length);
  const body = sql.slice(valuesIdx + "values".length).replace(/;\s*$/, "");
  const rows = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "(") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0 && start >= 0) {
        rows.push(body.slice(start, i + 1));
        start = -1;
      }
    }
  }
  if (rows.length <= 1) {
    return [sql.trim().endsWith(";") ? sql.trim() : `${sql.trim()};`];
  }
  const pieces = [];
  let batch = [];
  let size = header.length;
  for (const row of rows) {
    const add = row.length + 2;
    if (batch.length && size + add > MAX) {
      pieces.push(`${header}\n${batch.join(",\n")};`);
      batch = [];
      size = header.length;
    }
    batch.push(row);
    size += add;
  }
  if (batch.length) pieces.push(`${header}\n${batch.join(",\n")};`);
  return pieces;
}

// Load remaining seeds as: remaining c01 already applied; use original chunks 02-10
const files = Array.from({ length: 9 }, (_, i) =>
  path.join(__dirname, `chunk${String(i + 2).padStart(2, "0")}.sql`)
);

// First compact them using existing compact function semantics: group single-row inserts
function compactSql(sql) {
  const parts = sql.split(/(?=^insert into )/im).filter((s) => s.trim());
  const chunks = [];
  let pending = null;
  const flush = () => {
    if (!pending) return;
    chunks.push(`${pending.header} values\n${pending.rows.join(",\n")};`);
    pending = null;
  };
  for (let p of parts) {
    p = p.trim();
    if (!/^insert into /i.test(p)) {
      flush();
      chunks.push(p.endsWith(";") ? p : `${p};`);
      continue;
    }
    const m = p.match(/^insert into ([\s\S]*?)\)\s*values\s*\(([\s\S]*)\)\s*;?\s*$/i);
    if (!m) {
      flush();
      chunks.push(p.endsWith(";") ? p : `${p};`);
      continue;
    }
    const header = `insert into ${m[1].trim()})`;
    const row = `(${m[2].trim()})`;
    if (pending && pending.header === header) pending.rows.push(row);
    else {
      flush();
      pending = { header, rows: [row] };
    }
  }
  flush();
  return chunks;
}

let n = 0;
const manifest = [];
for (const file of files) {
  const stmts = compactSql(fs.readFileSync(file, "utf8"));
  for (const stmt of stmts) {
    const pieces = splitMultiValues(stmt);
    for (const piece of pieces) {
      n += 1;
      const name = `${String(n).padStart(3, "0")}.sql`;
      fs.writeFileSync(path.join(out, name), piece.endsWith("\n") ? piece : `${piece}\n`);
      const table = (piece.match(/insert into\s+([^\s(]+)/i) || [, "?"])[1];
      manifest.push({ name, len: piece.length, table });
    }
  }
}
console.log(JSON.stringify({ count: manifest.length, manifest }, null, 2));
