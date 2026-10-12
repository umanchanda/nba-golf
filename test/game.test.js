const test = require("node:test");
const assert = require("node:assert/strict");
const { createRound, playHole, publicRound, OFF_LIST_RANK } = require("../src/game");
const { LISTS } = require("../src/data");

const fixed = (stat, pin) => ({ holes: [{ stat, pin }, { stat: "trb", pin: 1 }, { stat: "ast", pin: 1 }, { stat: "blk", pin: 1 }, { stat: "stl", pin: 1 }], current: 0, total: 0, done: false });

test("every list has 250 rows", () => {
  for (const k in LISTS) assert.equal(LISTS[k].length, 250, k);
});

test("a round has five different lists with pins in the top 100", () => {
  const r = createRound();
  assert.equal(r.holes.length, 5);
  assert.equal(new Set(r.holes.map((h) => h.stat)).size, 5);
  for (const h of r.holes) assert.ok(h.pin >= 1 && h.pin <= 100);
});

test("strokes are the distance from the pin (LeBron for No. 69 scoring is 68)", () => {
  const r = fixed("pts", 69);
  const h = playHole(r, "LeBron James");
  assert.equal(h.rank, 1);
  assert.equal(h.strokes, 68);
  assert.equal(r.total, 68);
  assert.equal(r.current, 1);
});

test("a player off the list counts as No. 251", () => {
  const r = fixed("pts", 69);
  assert.equal(playHole(r, "Some Guy").rank, OFF_LIST_RANK);
  assert.equal(r.total, OFF_LIST_RANK - 69);
});

test("tied players share a rank", () => {
  const r = fixed("pts", 29);
  assert.equal(playHole(r, "Reggie Miller").strokes, 0);
});

test("public view hides future pins and unplayed answers", () => {
  const r = fixed("pts", 69);
  let v = publicRound("x", r);
  assert.equal(v.holes[0].pin, 69);
  assert.equal(v.holes[1].pin, undefined);
  assert.equal(v.holes[0].answers, undefined);
  playHole(r, "LeBron James");
  v = publicRound("x", r);
  assert.deepEqual(v.holes[0].answers, [{ name: "Gail Goodrich", value: 19181 }]);
  for (let i = 0; i < 4; i++) playHole(r, "LeBron James");
  assert.equal(r.done, true);
  assert.throws(() => playHole(r, "LeBron James"));
});
