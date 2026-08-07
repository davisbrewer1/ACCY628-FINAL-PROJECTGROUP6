const fs = require("fs");
const path = require("path");

const srcPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260806260000_seed_msp_2026_year.sql",
);
let src = fs.readFileSync(srcPath, "utf8");
src = src
  .replace(/\bbegin;\s*/gi, "")
  .replace(/\bcommit;\s*/gi, "");

const dir = path.join(__dirname, "seed-chunks-2026");
fs.mkdirSync(dir, { recursive: true });
for (const f of fs.readdirSync(dir)) {
  fs.unlinkSync(path.join(dir, f));
}

const max = 80000;
const statements = src
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => (s.endsWith(";") ? s : `${s};`));

let buf = [];
let size = 0;
let n = 0;
const flush = () => {
  if (!buf.length) return;
  n += 1;
  const body = buf.join("\n\n") + "\n";
  const file = path.join(dir, `chunk${String(n).padStart(2, "0")}.sql`);
  fs.writeFileSync(file, body);
  console.log(file, body.length);
  buf = [];
  size = 0;
};

for (const stmt of statements) {
  if (size + stmt.length > max && buf.length) flush();
  buf.push(stmt);
  size += stmt.length + 2;
}
flush();
console.log("chunks", n, "statements", statements.length);
