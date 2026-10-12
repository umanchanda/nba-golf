const crypto = require("node:crypto");

const newId = () => crypto.randomUUID();

// In-memory store, used locally and in tests when DATABASE_URL is not set.
function memoryStore() {
  const rounds = new Map();
  const scores = [];
  return {
    kind: "memory",
    async init() {},
    async createRound(round) {
      const id = newId();
      rounds.set(id, { round, submitted: false });
      return id;
    },
    async getRound(id) {
      return rounds.get(id) || null;
    },
    async saveRound(id, round) {
      const r = rounds.get(id);
      if (r) r.round = round;
    },
    async submitScore(id, player, total) {
      const r = rounds.get(id);
      if (!r || r.submitted) return false;
      r.submitted = true;
      scores.push({ player, total, created_at: new Date().toISOString() });
      return true;
    },
    async topScores(limit) {
      return scores
        .slice()
        .sort((a, b) => a.total - b.total || a.created_at.localeCompare(b.created_at))
        .slice(0, limit);
    },
    async close() {},
  };
}

function pgStore(databaseUrl) {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: databaseUrl,
    // Heroku Postgres requires SSL with a certificate Node does not trust by default.
    ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? false : { rejectUnauthorized: false },
  });
  return {
    kind: "postgres",
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS rounds (
          id uuid PRIMARY KEY,
          state jsonb NOT NULL,
          submitted boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS scores (
          id serial PRIMARY KEY,
          round_id uuid UNIQUE REFERENCES rounds(id) ON DELETE CASCADE,
          player text NOT NULL,
          total integer NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS scores_total_idx ON scores (total, created_at);
      `);
    },
    async createRound(round) {
      const id = newId();
      await pool.query("INSERT INTO rounds (id, state) VALUES ($1, $2)", [id, round]);
      return id;
    },
    async getRound(id) {
      const { rows } = await pool.query("SELECT state, submitted FROM rounds WHERE id = $1", [id]);
      return rows[0] ? { round: rows[0].state, submitted: rows[0].submitted } : null;
    },
    async saveRound(id, round) {
      await pool.query("UPDATE rounds SET state = $2 WHERE id = $1", [id, round]);
    },
    async submitScore(id, player, total) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rowCount } = await client.query(
          "UPDATE rounds SET submitted = true WHERE id = $1 AND submitted = false",
          [id]
        );
        if (!rowCount) {
          await client.query("ROLLBACK");
          return false;
        }
        await client.query("INSERT INTO scores (round_id, player, total) VALUES ($1, $2, $3)", [id, player, total]);
        await client.query("COMMIT");
        return true;
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    },
    async topScores(limit) {
      const { rows } = await pool.query(
        "SELECT player, total, created_at FROM scores ORDER BY total, created_at LIMIT $1",
        [limit]
      );
      return rows;
    },
    async close() {
      await pool.end();
    },
  };
}

const createStore = (databaseUrl) => (databaseUrl ? pgStore(databaseUrl) : memoryStore());

module.exports = { createStore, memoryStore };
