// db.js
const { Pool } = require("pg");

const {
  PGHOST,
  PGPORT,
  PGDATABASE,
  PGUSER,
  PGPASSWORD,
  DATABASE_URL,
  NODE_ENV
} = process.env;

let pool;

// Prefer DATABASE_URL if you’re using a single connection string
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    // Optional SSL if you ever host Postgres remotely
    ssl:
      NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
  });
} else {
  // Local dev-style config
  pool = new Pool({
    host: PGHOST || "localhost",
    port: Number(PGPORT || 5432),
    database: PGDATABASE || "kryptyk_labs",
    user: PGUSER || "postgres",
    // IMPORTANT: coerce to string if present, otherwise leave undefined
    password:
      typeof PGPASSWORD === "string" && PGPASSWORD.length > 0
        ? PGPASSWORD
        : undefined
  });
}

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

