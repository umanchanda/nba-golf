const test = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("../src/match");

test("exact names, case and accents are matched", () => {
  assert.deepEqual(resolve("lebron james", "pts"), { sure: "LeBron James" });
  assert.deepEqual(resolve("Nikola Jokic", "ast"), { sure: "Nikola Jokić" });
  assert.deepEqual(resolve("shaquille oneal", "trb"), { sure: "Shaquille O'Neal" });
});

test("nicknames and unique last names are matched", () => {
  assert.deepEqual(resolve("Shaq", "pts"), { sure: "Shaquille O'Neal" });
  assert.deepEqual(resolve("the dream", "blk"), { sure: "Hakeem Olajuwon" });
  assert.deepEqual(resolve("Wembanyama", "blk"), { sure: "Victor Wembanyama" });
});

test("shared last names ask which player, preferring the current list", () => {
  const r = resolve("Malone", "pts");
  assert.ok(r.pick.includes("Karl Malone"));
  assert.ok(r.pick.includes("Moses Malone"));
});

test("typos suggest the closest players", () => {
  assert.deepEqual(resolve("Olajuwan", "blk"), { pick: ["Hakeem Olajuwon"] });
  assert.ok(resolve("Micheal Jordan", "stl").pick.includes("Michael Jordan"));
});

test("unknown names and empty input", () => {
  assert.deepEqual(resolve("Zzyzx Qwerty", "pts"), { none: true });
  assert.deepEqual(resolve("   ", "pts"), { empty: true });
});
