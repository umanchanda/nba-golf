const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("../src/app");
const { memoryStore, createStore } = require("../src/store");

async function withServer(fn, store = memoryStore()) {
  await store.init();
  const server = createApp(store).listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  try { await fn(call); } finally { server.close(); await store.close(); }
}

const fullRound = async (call) => {
    const { status, body: round } = await call("POST", "/api/rounds");
    assert.equal(status, 201);
    assert.equal(round.holes.length, 5);

    const ambiguous = await call("POST", `/api/rounds/${round.id}/guess`, { name: "Malone" });
    assert.equal(ambiguous.body.status, "pick");

    const unknown = await call("POST", `/api/rounds/${round.id}/guess`, { name: "Zzyzx Qwerty" });
    assert.equal(unknown.body.status, "unknown");

    const early = await call("POST", `/api/rounds/${round.id}/submit`, { player: "Uday" });
    assert.equal(early.status, 409);

    let last;
    for (let i = 0; i < 5; i++) {
      last = await call("POST", `/api/rounds/${round.id}/guess`, { name: "LeBron James" });
      assert.equal(last.body.status, "scored");
    }
    assert.equal(last.body.round.done, true);
    const total = last.body.round.total;

    const over = await call("POST", `/api/rounds/${round.id}/guess`, { name: "LeBron James" });
    assert.equal(over.status, 409);

    assert.equal((await call("POST", `/api/rounds/${round.id}/submit`, { player: "Uday" })).status, 201);
    assert.equal((await call("POST", `/api/rounds/${round.id}/submit`, { player: "Uday" })).status, 409);

    const lb = await call("GET", "/api/leaderboard");
    assert.ok(lb.body.scores.some((s) => s.player === "Uday" && s.total === total));
  };

test("play a full round and post it to the leaderboard", () => withServer(fullRound));

test("the same round works against Postgres", { skip: !process.env.TEST_DATABASE_URL && "set TEST_DATABASE_URL to run" }, () =>
  withServer(fullRound, createStore(process.env.TEST_DATABASE_URL)));

test("confirming a name off every list scores it as No. 251", () =>
  withServer(async (call) => {
    const { body: round } = await call("POST", "/api/rounds");
    const r = await call("POST", `/api/rounds/${round.id}/guess`, { name: "Zzyzx Qwerty", confirm: true });
    assert.equal(r.body.round.holes[0].rank, 251);
  }));

test("unknown round ids return 404", () =>
  withServer(async (call) => {
    assert.equal((await call("GET", "/api/rounds/not-a-real-id")).status, 404);
    assert.equal((await call("GET", "/api/rounds/00000000-0000-0000-0000-000000000000")).status, 404);
  }));

test("the player list covers every list and includes nicknames", () =>
  withServer(async (call) => {
    const { status, body } = await call("GET", "/api/players");
    assert.equal(status, 200);
    assert.ok(body.players.includes("Gail Goodrich"));
    assert.ok(body.players.includes("Victor Wembanyama"));
    assert.equal(new Set(body.players).size, body.players.length);
    assert.equal(body.aliases.shaq, "Shaquille O'Neal");
  }));
