/* scripts/apply-sql.js
   Usage: node scripts/apply-sql.js <path-to-sql>

   Runs a SQL file against DATABASE_URL.
*/

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const db = require("../db");

async function main() {
  const rel = process.argv[2];
  if (!rel) {
    console.error("Usage: node scripts/apply-sql.js <path-to-sql>");
    process.exit(1);
  }

  const sqlPath = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(sqlPath)) {
    console.error("SQL file not found:", sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf8");
  if (!sql.trim()) {
    console.error("SQL file is empty:", sqlPath);
    process.exit(1);
  }

  try {
    await db.query(sql);
    console.log("Applied:", rel);
  } finally {
    // Ensure Node exits (pg pool keeps event loop alive)
    await db.pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message || err);
  process.exit(1);
});
