const path = require("node:path");
const fs = require("node:fs");

const STATS = {
  pts: { name: "Points", phrase: "all-time scoring list" },
  trb: { name: "Rebounds", phrase: "all-time rebounding list" },
  ast: { name: "Assists", phrase: "all-time assists list" },
  blk: { name: "Blocks", phrase: "all-time blocks list" },
  stl: { name: "Steals", phrase: "all-time steals list" },
  fg: { name: "FG%", phrase: "all-time career field goal percentage list" },
};

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "leaders.json"), "utf8"));

// Each list holds the top 250 rows from Basketball Reference. Tied players share a rank.
const LISTS = raw.lists;

module.exports = { STATS, LISTS, SOURCE: raw.source, SNAPSHOT: raw.snapshot };
