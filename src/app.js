const path = require("node:path");
const express = require("express");
const { STATS, SOURCE, SNAPSHOT } = require("./data");
const { resolve, isKnownPlayer, PLAYER_NAMES, ALIAS } = require("./match");
const { createRound, playHole, publicRound, OFF_LIST_RANK } = require("./game");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createApp(store) {
  const app = express();
  app.use(express.json({ limit: "4kb" }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  const loadRound = async (req, res) => {
    if (!UUID.test(req.params.id)) {
      res.status(404).json({ error: "Round not found" });
      return null;
    }
    const found = await store.getRound(req.params.id);
    if (!found) res.status(404).json({ error: "Round not found" });
    return found;
  };

  app.get("/healthz", (req, res) => res.json({ ok: true, store: store.kind }));

  app.get("/api/meta", (req, res) => res.json({ stats: STATS, source: SOURCE, snapshot: SNAPSHOT, offListRank: OFF_LIST_RANK }));

  app.get("/api/players", (req, res) => {
    res.set("Cache-Control", "public, max-age=3600");
    res.json({ players: PLAYER_NAMES, aliases: ALIAS });
  });

  app.post("/api/rounds", async (req, res) => {
    const round = createRound();
    const id = await store.createRound(round);
    res.status(201).json(publicRound(id, round));
  });

  app.get("/api/rounds/:id", async (req, res) => {
    const found = await loadRound(req, res);
    if (found) res.json({ ...publicRound(req.params.id, found.round), submitted: found.submitted });
  });

  // Body: { name, confirm? }. Without confirm, the name is matched first and the
  // response may ask the player to pick from close matches. With confirm, the
  // name is scored as given (a listed player, or anyone else at No. 251).
  app.post("/api/rounds/:id/guess", async (req, res) => {
    const found = await loadRound(req, res);
    if (!found) return;
    const { round } = found;
    if (round.done) return res.status(409).json({ error: "This round is already finished" });

    const text = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 60) : "";
    if (!text) return res.status(400).json({ error: "Type a player's name" });

    let name;
    if (req.body.confirm) {
      name = isKnownPlayer(text) ? text : resolve(text, round.holes[round.current].stat).sure || text;
    } else {
      const r = resolve(text, round.holes[round.current].stat);
      if (r.pick) return res.json({ status: "pick", options: r.pick });
      if (r.none) return res.json({ status: "unknown", text });
      name = r.sure;
    }

    playHole(round, name);
    await store.saveRound(req.params.id, round);
    res.json({ status: "scored", round: publicRound(req.params.id, round) });
  });

  app.post("/api/rounds/:id/submit", async (req, res) => {
    const found = await loadRound(req, res);
    if (!found) return;
    if (!found.round.done) return res.status(409).json({ error: "Finish all five holes first" });
    const player = typeof req.body?.player === "string" ? req.body.player.trim().replace(/\s+/g, " ").slice(0, 20) : "";
    if (!player) return res.status(400).json({ error: "Enter a name for the leaderboard" });
    const ok = await store.submitScore(req.params.id, player, found.round.total);
    if (!ok) return res.status(409).json({ error: "This round is already on the leaderboard" });
    res.status(201).json({ ok: true });
  });

  app.get("/api/leaderboard", async (req, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    res.json({ scores: await store.topScores(limit) });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server" });
  });

  return app;
}

module.exports = { createApp };
