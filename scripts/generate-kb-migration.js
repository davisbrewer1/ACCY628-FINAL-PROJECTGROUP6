const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(
  path.join(__dirname, "../src/lib/kb-content.ts"),
  "utf8",
);

const articles = [];
const re =
  /\{\s*title:\s*"([^"]+)"\s*,\s*category:\s*"([^"]+)"\s*,\s*tags:\s*\[([^\]]*)\]\s*,\s*content:\s*`([\s\S]*?)`\s*,?\s*\}/g;

let match;
while ((match = re.exec(src))) {
  const tags = match[3]
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
  articles.push({
    title: match[1],
    category: match[2],
    tags,
    content: match[4],
  });
}

if (articles.length === 0) {
  console.error("No articles parsed from kb-content.ts");
  process.exit(1);
}

function esc(value) {
  return value.replace(/'/g, "''");
}

function valuesSql(rows) {
  return rows
    .map(
      (article) => `(
  '${esc(article.title)}',
  '${esc(article.content)}',
  '${esc(article.category)}',
  array[${article.tags.map((tag) => `'${esc(tag)}'`).join(", ")}]::text[]
)`,
    )
    .join(",\n");
}

const outDir = path.join(__dirname, "../supabase/migrations");
const fullSql = `-- Expand technician Knowledge Base processes (text-only, no client docs)
delete from public.knowledge_base_articles;

insert into public.knowledge_base_articles (title, content, category, tags)
values
${valuesSql(articles)};
`;

fs.writeFileSync(
  path.join(outDir, "20260805150000_expand_technician_kb.sql"),
  fullSql,
);

const splitDir = path.join(__dirname, "kb-sql");
fs.mkdirSync(splitDir, { recursive: true });
fs.writeFileSync(
  path.join(splitDir, "00_delete.sql"),
  "delete from public.knowledge_base_articles;",
);

const byCategory = new Map();
for (const article of articles) {
  const list = byCategory.get(article.category) ?? [];
  list.push(article);
  byCategory.set(article.category, list);
}

let index = 1;
for (const [category, rows] of byCategory.entries()) {
  const slug = category.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const sql = `insert into public.knowledge_base_articles (title, content, category, tags)
values
${valuesSql(rows)};
`;
  fs.writeFileSync(
    path.join(splitDir, `${String(index).padStart(2, "0")}_${slug}.sql`),
    sql,
  );
  console.log(`${index}. ${category}: ${rows.length}`);
  index += 1;
}

console.log(`Total articles: ${articles.length}`);
