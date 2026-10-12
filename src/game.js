const { STATS, LISTS } = require("./data");
const { findOnList } = require("./match");

const HOLES = 5;
const MAX_PIN = 100;
const OFF_LIST_RANK = 251; // a player outside a list's top 250 counts as No. 251

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createRound(rng = Math.random) {
  const stats = shuffle(Object.keys(STATS), rng).slice(0, HOLES);
  return {
    holes: stats.map((stat) => {
      const ranks = [...new Set(LISTS[stat].map((r) => r.rank))].filter((r) => r <= MAX_PIN);
      return { stat, pin: ranks[Math.floor(rng() * ranks.length)], guess: null, rank: null, value: null, strokes: null };
    }),
    current: 0,
    total: 0,
    done: false,
  };
}

// Scores the current hole with the given player name and advances the round.
function playHole(round, name) {
  if (round.done) throw new Error("Round is already finished");
  const hole = round.holes[round.current];
  const row = findOnList(hole.stat, name);
  hole.guess = name;
  hole.rank = row ? row.rank : OFF_LIST_RANK;
  hole.value = row ? row.value : null;
  hole.strokes = Math.abs(hole.rank - hole.pin);
  round.total += hole.strokes;
  round.current += 1;
  if (round.current >= HOLES) round.done = true;
  return hole;
}

const answersFor = (stat, pin) =>
  LISTS[stat].filter((r) => r.rank === pin).map((r) => ({ name: r.name, value: r.value }));

// What the client may see: pins for holes reached so far, answers only for holes played.
function publicRound(id, round) {
  return {
    id,
    current: round.current,
    total: round.total,
    done: round.done,
    holes: round.holes.map((h, i) => {
      const out = { stat: h.stat, statName: STATS[h.stat].name, phrase: STATS[h.stat].phrase };
      if (i <= round.current || round.done) out.pin = h.pin;
      if (h.strokes != null) {
        Object.assign(out, { guess: h.guess, rank: h.rank, value: h.value, strokes: h.strokes, answers: answersFor(h.stat, h.pin) });
      }
      return out;
    }),
  };
}

module.exports = { HOLES, MAX_PIN, OFF_LIST_RANK, createRound, playHole, publicRound };
