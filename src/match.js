const { LISTS } = require("./data");

const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/-/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Every player on any list, keyed by normalized name.
const PLAYERS = new Map();
for (const k in LISTS) for (const row of LISTS[k]) PLAYERS.set(norm(row.name), row.name);

const ALL = [...PLAYERS].map(([n, name]) => {
  const parts = n.split(" ");
  return { n, name, first: parts[0], last: parts[parts.length - 1] };
});

const BYLAST = new Map();
for (const p of ALL) {
  if (!BYLAST.has(p.last)) BYLAST.set(p.last, []);
  BYLAST.get(p.last).push(p.name);
}

const ALIAS = {
  "lebron": "LeBron James", "bron": "LeBron James", "king james": "LeBron James", "lbj": "LeBron James",
  "kareem": "Kareem Abdul-Jabbar", "lew alcindor": "Kareem Abdul-Jabbar", "the mailman": "Karl Malone", "mailman": "Karl Malone",
  "kobe": "Kobe Bryant", "mamba": "Kobe Bryant", "kd": "Kevin Durant", "mj": "Michael Jordan", "jordan": "Michael Jordan",
  "dirk": "Dirk Nowitzki", "wilt": "Wilt Chamberlain", "dr j": "Julius Erving", "doctor j": "Julius Erving",
  "the beard": "James Harden", "shaq": "Shaquille O'Neal", "melo": "Carmelo Anthony",
  "russ": "Russell Westbrook", "hakeem": "Hakeem Olajuwon", "the dream": "Hakeem Olajuwon", "akeem olajuwon": "Hakeem Olajuwon",
  "big o": "Oscar Robertson", "the iceman": "George Gervin", "iceman": "George Gervin", "steph": "Stephen Curry", "steph curry": "Stephen Curry",
  "timmy": "Tim Duncan", "kg": "Kevin Garnett", "vinsanity": "Vince Carter", "ai": "Allen Iverson", "the answer": "Allen Iverson",
  "sir charles": "Charles Barkley", "chief": "Robert Parish", "d wade": "Dwyane Wade", "dwade": "Dwyane Wade", "dwayne wade": "Dwyane Wade",
  "cp3": "Chris Paul", "dame": "Damian Lillard", "the glide": "Clyde Drexler", "the glove": "Gary Payton", "larry legend": "Larry Bird",
  "giannis": "Giannis Antetokounmpo", "greek freak": "Giannis Antetokounmpo", "the admiral": "David Robinson", "pg13": "Paul George",
  "magic": "Magic Johnson", "earvin johnson": "Magic Johnson", "ad": "Anthony Davis", "the brow": "Anthony Davis", "t mac": "Tracy McGrady", "tmac": "Tracy McGrady",
  "pistol pete": "Pete Maravich", "penny": "Anfernee Hardaway", "penny hardaway": "Anfernee Hardaway", "mutombo": "Dikembe Mutombo", "deke": "Dikembe Mutombo",
  "the worm": "Dennis Rodman", "worm": "Dennis Rodman", "boogie": "DeMarcus Cousins", "manu": "Manu Ginóbili", "yao": "Yao Ming",
  "zo": "Alonzo Mourning", "enes kanter": "Enes Freedom", "kanter": "Enes Freedom", "ron artest": "Metta World Peace", "artest": "Metta World Peace",
  "luka": "Luka Dončić", "jokic": "Nikola Jokić", "joker": "Nikola Jokić", "kawhi": "Kawhi Leonard", "sga": "Shai Gilgeous-Alexander", "shai": "Shai Gilgeous-Alexander",
  "wemby": "Victor Wembanyama", "zion": "Zion Williamson", "kat": "Karl-Anthony Towns", "jjj": "Jaren Jackson Jr.", "kcp": "Kentavious Caldwell-Pope",
  "dray": "Draymond Green", "muggsy": "Muggsy Bogues", "manute": "Manute Bol", "tiny": "Tiny Archibald", "nate archibald": "Tiny Archibald",
  "nene hilario": "Nenê", "spud": "Spud Webb", "stock": "John Stockton", "stockton": "John Stockton", "isiah": "Isiah Thomas", "zeke": "Isiah Thomas",
  "nique": "Dominique Wilkins", "hondo": "John Havlicek", "the logo": "Jerry West", "clyde": "Walt Frazier",
  "cwebb": "Chris Webber", "rasheed": "Rasheed Wallace", "sheed": "Rasheed Wallace", "big ben": "Ben Wallace",
  "rondo": "Rajon Rondo", "dikembe": "Dikembe Mutombo", "kyrie": "Kyrie Irving", "booker": "Devin Booker",
};

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

const findOnList = (stat, name) => LISTS[stat].find((r) => r.name === name) || null;
const isKnownPlayer = (name) => PLAYERS.get(norm(name)) === name;

// Resolve typed text to a player.
// Returns { sure: name } | { pick: [names] } | { none: true } | { empty: true }
function resolve(input, stat) {
  const q = norm(input);
  if (!q) return { empty: true };
  if (ALIAS[q]) return { sure: ALIAS[q] };
  if (PLAYERS.has(q)) return { sure: PLAYERS.get(q) };

  const toks = q.split(" ");
  const preferOnList = (arr) =>
    arr.slice().sort((a, b) => (findOnList(stat, b) ? 1 : 0) - (findOnList(stat, a) ? 1 : 0));

  if (toks.length === 1) {
    const hits = BYLAST.get(q) || ALL.filter((p) => p.first === q).map((p) => p.name);
    if (hits.length === 1) return { sure: hits[0] };
    if (hits.length > 1) return { pick: preferOnList(hits).slice(0, 6) };
  }

  const scored = ALL.map((p) => {
    let d = lev(q, p.n);
    if (toks.length === 1) d = Math.min(d, lev(q, p.last), lev(q, p.first) + 1);
    else d = Math.min(d, lev(q, `${p.first} ${p.last}`));
    return { name: p.name, d };
  }).sort((a, b) => a.d - b.d);

  const lim = Math.max(1, Math.min(3, Math.floor(q.length * 0.3)));
  const close = scored.filter((s) => s.d <= lim).slice(0, 4).map((s) => s.name);
  if (close.length) return { pick: close };
  return { none: true };
}

// Every player on any of the six lists, for the name dropdown. Drawing from all
// lists keeps the dropdown from hinting at who is on the current one.
const PLAYER_NAMES = [...PLAYERS.values()].sort((a, b) => a.localeCompare(b));

module.exports = { norm, lev, resolve, findOnList, isKnownPlayer, PLAYER_NAMES, ALIAS };
