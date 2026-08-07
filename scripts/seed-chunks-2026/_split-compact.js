const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "_compact");
const files = fs
  .readdirSync(dir)
  .filter((f) => /_chunk\d+\.sql$/.test(f))
  .sort();

function splitRows(sql) {
  const valuesIdx = sql.search(/\bvalues\b/i);
  if (valuesIdx < 0) return null;
  const header = sql.slice(0, valuesIdx + "values".length);
  let body = sql.slice(valuesIdx + "values".length).replace(/;\s*$/, "");
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
  return { header, rows };
}

for (const name of files) {
  const p = path.join(dir, name);
  const sql = fs.readFileSync(p, "utf8");
  if (sql.length <= 22000) {
    console.log(name, "keep", sql.length);
    continue;
  }
  const parsed = splitRows(sql);
  if (!parsed || parsed.rows.length < 2) {
    console.log(name, "unsplit", sql.length, parsed && parsed.rows.length);
    continue;
  }
  const mid = Math.ceil(parsed.rows.length / 2);
  const a = `${parsed.header}\n${parsed.rows.slice(0, mid).join(",\n")};\n`;
  const b = `${parsed.header}\n${parsed.rows.slice(mid).join(",\n")};\n`;
  fs.writeFileSync(`${p}.a`, a);
  fs.writeFileSync(`${p}.b`, b);
  console.log(name, "rows", parsed.rows.length, "a", a.length, "b", b.length);
}
