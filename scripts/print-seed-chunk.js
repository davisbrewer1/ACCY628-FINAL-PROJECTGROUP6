/**
 * Prints one SQL chunk for MCP apply: node scripts/print-seed-chunk.js 1
 */
const fs = require("fs");
const path = require("path");
const n = Number(process.argv[2] || "1");
const file = path.join(__dirname, "seed-chunks-2026", `chunk${String(n).padStart(2, "0")}.sql`);
process.stdout.write(fs.readFileSync(file, "utf8"));
