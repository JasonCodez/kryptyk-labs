// db.js
const { Pool } = require("pg");

const { DATABASE_URL, NODE_ENV } = process.env;

const isProduction = NODE_ENV === "production";

// We *require* DATABASE_URL. This avoids accidentally falling back to localhost in prod.
if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Configure it in your .env (local) and in Render's environment settings."
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isProduction
    ? { rejectUnauthorized: false } // needed for Render / hosted Postgres
    : false                         // no SSL locally by default
});

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};


