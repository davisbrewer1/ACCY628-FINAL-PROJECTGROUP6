const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "_compact", "apply", "merged");
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  const p = path.join(dir, f);
  const s = fs.readFileSync(p, "utf8");
  const fixed = s
    .replace(/,\s*\n\s*\(id\)\s*;/g, ";")
    .replace(/\n\(id\)\s*;/g, ";");
  if (fixed !== s) {
    fs.writeFileSync(p, fixed);
    console.log("fixed", f, s.length, "->", fixed.length);
  }
}

const chunk10 = fs.readFileSync(path.join(__dirname, "chunk10.sql"), "utf8");
const scores = [...chunk10.matchAll(/insert into public\.security_scores[\s\S]*?;/gi)].map(
  (m) => m[0]
);
const expenses = [...chunk10.matchAll(/insert into public\.ticket_expenses[\s\S]*?;/gi)].map(
  (m) => m[0]
);
const assets = [...chunk10.matchAll(/insert into public\.hardware_assets[\s\S]*?;/gi)].map(
  (m) => m[0]
);
const ann = [...chunk10.matchAll(/insert into public\.announcements[\s\S]*?;/gi)].map(
  (m) => m[0]
);
console.log({
  scores: scores.length,
  expenses: expenses.length,
  assets: assets.length,
  ann: ann.length,
});

function compactInserts(stmts) {
  if (!stmts.length) return "";
  const rows = [];
  let header = null;
  for (const s of stmts) {
    const m = s.match(/^insert into ([\s\S]*?)\)\s*values\s*\(([\s\S]*)\)\s*;?\s*$/i);
    if (!m) return stmts.join("\n\n") + "\n";
    header = `insert into ${m[1].trim()})`;
    rows.push(`(${m[2].trim()})`);
  }
  return `${header} values\n${rows.join(",\n")};\n`;
}

// Only rewrite 14 with remaining scores + announcements from original.
// Extract scores for ids after 000016 if 13 already has earlier ones - safer: rewrite clean scores 17-20 + ann
const scoreCompact = compactInserts(scores);
const annSql = ann.join("\n\n");
// Keep only second half if 13 applied early scores. Check 13 content.
const thirteen = fs.readFileSync(path.join(dir, "13.sql"), "utf8");
const hasScoresIn13 = /security_scores/i.test(thirteen);
console.log("13 has scores", hasScoresIn13);

if (!hasScoresIn13) {
  fs.writeFileSync(path.join(dir, "14.sql"), `${scoreCompact}\n${annSql}\n`);
} else {
  // 13 may still have (id) stubs - already fixed above. Rebuild 14 as leftover scores not in 13 + ann
  const idsIn13 = new Set(
    [...thirteen.matchAll(/a6267800-[0-9a-f-]+/gi)].map((m) => m[0].toLowerCase())
  );
  const remaining = scores.filter((s) => {
    const id = (s.match(/a6267800-[0-9a-f-]+/i) || [])[0];
    return id && !idsIn13.has(id.toLowerCase());
  });
  fs.writeFileSync(
    path.join(dir, "14.sql"),
    `${compactInserts(remaining)}\n${annSql}\n`
  );
  console.log("remaining scores", remaining.length);
}
console.log("14.sql", fs.statSync(path.join(dir, "14.sql")).size);
