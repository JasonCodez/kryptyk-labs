// // server.js
// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const authRoutes = require("./kryptyk-labs-api/routes/auth");
// const db = require("./db");
// const profileRoutes = require("./kryptyk-labs-api/routes/profile");

// const app = express();

// const path = require("path");

// // Allow all origins during development
// app.use(
//     cors({
//         origin: "*",
//         credentials: false
//     })
// );

// app.use(express.static("public"));


// // Parse JSON bodies
// app.use(express.json());

// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// // Profile routes
// app.use("/api/profile", profileRoutes);

// // Health check
// app.get("/api/health", (req, res) => {
//     res.json({ ok: true, status: "Kryptyk Labs core online." });
// });

// // Optional DB debug
// app.get("/api/debug/db", async (req, res) => {
//     try {
//         const result = await db.query("SELECT NOW() AS now");
//         res.json({ ok: true, now: result.rows[0].now });
//     } catch (err) {
//         console.error("Debug DB error:", err);
//         res.status(500).json({ ok: false, error: err.message });
//     }
// });

// // Auth routes
// app.use("/api/auth", authRoutes);

// // 404
// app.use((req, res) => {
//     res.status(404).json({ error: "Route not found." });
// });

// // Error handler
// app.use((err, req, res, next) => {
//     console.error("Unhandled error:", err);
//     res.status(500).json({ error: "Internal server error." });
// });

// // must be *after* your API routes
// app.use((req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });


// const PORT = process.env.PORT || 4000;

// app.listen(PORT, () => {
//     console.log(`Kryptyk Labs API running on port ${PORT}`);
// });

// server.js
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
// If you have a profile routes file, keep this; otherwise comment it out.
const profileRoutes = require("./routes/profile");

const app = express();
const PORT = process.env.PORT || 4000;

// ---------- Middleware ----------
app.use(cors({
  origin: "*",           // or "http://localhost:3000" if you separate frontend
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ---------- API Routes ----------
app.use("/api/auth", authRoutes);
// if you have a profile router:
app.use("/api/profile", profileRoutes);

// ---------- Static Frontend ----------
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// SPA fallback: IMPORTANT — use RegExp, NOT "*"
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`Kryptyk Labs API + Frontend running on http://localhost:${PORT}`);
});


