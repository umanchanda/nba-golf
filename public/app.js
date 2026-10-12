const HOLES = 5;
const OFF = 251;
const FMT = {
  pts: (v) => v.toLocaleString() + " pts",
  trb: (v) => v.toLocaleString() + " reb",
  ast: (v) => v.toLocaleString() + " ast",
  blk: (v) => v.toLocaleString() + " blk",
  stl: (v) => v.toLocaleString() + " stl",
  fg: (v) => (v * 100).toFixed(1) + "% FG",
};

let R = null;          // round as returned by the server
let view = "ask";      // ask | reveal | done
let pick = null;       // { options } | { unknown: text }
let typed = "";
let error = "";
let submitted = false;
let PLAYERS = [];      // [{ name, n, words }] for the dropdown
let ALIASES = [];      // [[alias, name]]

const norm = (s) =>
  String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[.'\u2019]/g, "").replace(/-/g, " ").replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ").trim();
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function badge(n) {
  if (n === 0) return ["Hole in one", "b-ace"];
  if (n <= 3) return ["Tap-in", "b-green"];
  if (n <= 10) return ["On the green", "b-green"];
  if (n <= 30) return ["Fairway", "b-fair"];
  if (n <= 100) return ["Rough", "b-rough"];
  return ["Water hazard", "b-water"];
}

async function newRound() {
  R = await api("POST", "/api/rounds");
  store.set("nbagolf-round", R.id);
  view = "ask"; pick = null; typed = ""; error = ""; submitted = false;
  render();
}

async function resume() {
  const id = store.get("nbagolf-round");
  if (!id) return newRound();
  try {
    const r = await api("GET", `/api/rounds/${id}`);
    if (r.done) return newRound();
    R = r; view = "ask"; render();
  } catch {
    return newRound();
  }
}

async function guess(name, confirm) {
  error = "";
  try {
    const out = await api("POST", `/api/rounds/${R.id}/guess`, { name, confirm: !!confirm });
    if (out.status === "pick") { pick = { options: out.options }; typed = name; }
    else if (out.status === "unknown") { pick = { unknown: out.text }; typed = name; }
    else {
      R = out.round; pick = null; typed = ""; view = "reveal";
      if (R.done) {
        const best = +store.get("nbagolf-best");
        if (!store.get("nbagolf-best") || R.total < best) store.set("nbagolf-best", String(R.total));
      }
    }
  } catch (e) { error = e.message; }
  render();
}

function next() {
  view = R.done ? "done" : "ask";
  if (R.done) store.del("nbagolf-round");
  render();
}

function questionHTML(h) {
  return `<div class="eyebrow">${h.statName} · Pin No. ${h.pin}</div>
    <h2 class="q">Who is <span class="pin">No.&nbsp;${h.pin}</span> on the ${h.phrase}?</h2>`;
}

function renderTee() {
  const tee = $("tee");
  const errHTML = error ? `<p class="err">${esc(error)}</p>` : "";

  if (view === "done") {
    const lines = R.holes.map((x, k) => `Hole ${k + 1}  ${x.statName.padEnd(8)} pin #${String(x.pin).padEnd(3)}  ${String(x.strokes).padStart(3)}`);
    const share = `NBA Golf: ${R.total} strokes\n` + lines.join("\n");
    const best = store.get("nbagolf-best");
    tee.innerHTML = `<div class="done pop">
      <div class="eyebrow">Round complete</div>
      <div class="n mono">${R.total}</div>
      <p style="margin:0">${best && +best === R.total ? "That's your best round on this device." : best ? `Your best on this device is ${best}.` : ""}</p>
      <pre class="share" id="share">${esc(share)}</pre>
      ${submitted ? `<p style="margin:0">You're on the leaderboard.</p>` : `
      <form id="sf" autocomplete="off"><input type="text" id="player" maxlength="20" placeholder="Your name for the leaderboard" aria-label="Your name for the leaderboard" value="${esc(store.get("nbagolf-name") || "")}"><button class="primary" type="submit">Post score</button></form>`}
      ${errHTML}
      <div class="row"><button class="${submitted ? "primary" : "ghost"}" id="again">Play another round</button><button class="ghost" id="copy">Copy scorecard</button></div>
    </div>`;
    $("again").onclick = () => newRound().catch((e) => { error = e.message; render(); });
    $("copy").onclick = (e) => {
      const btn = e.currentTarget;
      navigator.clipboard.writeText(share).then(() => (btn.textContent = "Copied"), () => {
        const r = document.createRange(); r.selectNodeContents($("share"));
        const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Text selected";
      });
    };
    const sf = $("sf");
    if (sf) {
      sf.onsubmit = async (e) => {
        e.preventDefault();
        const player = $("player").value.trim();
        if (!player) { error = "Enter a name for the leaderboard"; return render(); }
        try {
          await api("POST", `/api/rounds/${R.id}/submit`, { player });
          store.set("nbagolf-name", player); submitted = true; error = "";
          loadLeaders();
        } catch (err) { error = err.message; }
        render();
      };
      $("player").focus();
    } else $("again").focus();
    return;
  }

  if (view === "reveal") {
    const h = R.holes[R.current - 1];
    const fmt = FMT[h.stat];
    const [label, cls] = badge(h.strokes);
    const yours = h.rank === OFF ? `${esc(h.guess)} is not in the top 250, so counts as No. ${OFF}`
      : `${esc(h.guess)} is No. ${h.rank} <span class="mono">(${fmt(h.value)})</span>`;
    tee.innerHTML = `${questionHTML(h)}
      <div class="result pop">
        <div class="strokes"><span class="n">${h.strokes}</span><span>stroke${h.strokes === 1 ? "" : "s"}</span><span class="badge ${cls}">${label}</span></div>
        <dl class="lines">
          <dt>Pin</dt><dd>${h.answers.map((a) => `<b>${esc(a.name)}</b> <span class="mono">(${fmt(a.value)})</span>`).join(" and ")}</dd>
          <dt>You</dt><dd>${yours}</dd>
        </dl>
        <div class="row"><button class="primary" id="next">${R.done ? "See final score" : "Next hole"}</button></div>
      </div>`;
    $("next").onclick = next;
    $("next").focus();
    return;
  }

  const h = R.holes[R.current];
  let picks = "";
  if (pick?.options) {
    picks = `<div class="picks"><p>Did you mean:</p><div class="chips">${
      pick.options.map((n) => `<button type="button" class="chip" data-n="${esc(n)}">${esc(n)}</button>`).join("")
    }<button type="button" class="chip alt" data-off="1">None of these</button></div></div>`;
  } else if (pick?.unknown) {
    picks = `<div class="picks"><p>"${esc(pick.unknown)}" isn't in any of the top-250 lists. Check the spelling, or take the shot and score them as No. ${OFF}.</p><div class="chips"><button type="button" class="chip alt" data-off="1">Score as No. ${OFF}</button></div></div>`;
  }
  tee.innerHTML = `${questionHTML(h)}
    <form id="f" autocomplete="off"><div class="combo"><input type="text" id="guess" maxlength="60" placeholder="Start typing a player" aria-label="Player name"
      role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="suggest" value="${esc(typed)}"><ul id="suggest" role="listbox" hidden></ul></div><button class="primary" type="submit">Swing</button></form>${picks}${errHTML}`;
  const inp = $("guess");
  const dd = attachDropdown(inp, $("suggest"), (name) => guess(name, true));
  $("f").onsubmit = (e) => { e.preventDefault(); if (dd.pickActive()) return; if (inp.value.trim()) guess(inp.value.trim(), false); };
  tee.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => guess(b.dataset.n, true)));
  tee.querySelectorAll("[data-off]").forEach((b) => (b.onclick = () => guess(typed, true)));
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
}

// Up to 8 players whose name or nickname matches what's typed. A match at the
// start of the full name ranks first, then the start of any word, then anywhere.
function suggest(q) {
  q = norm(q);
  if (q.length < 2) return [];
  const best = new Map();
  const add = (name, score) => { if (!best.has(name) || best.get(name) > score) best.set(name, score); };
  for (const p of PLAYERS) {
    if (p.n.startsWith(q)) add(p.name, 0);
    else if (p.words.some((w) => w.startsWith(q))) add(p.name, 1);
    else if (q.length >= 3 && p.n.includes(q)) add(p.name, 2);
  }
  for (const [a, name] of ALIASES) if (a.startsWith(q)) add(name, a === q ? 0 : 1);
  return [...best].sort((x, y) => x[1] - y[1] || x[0].localeCompare(y[0])).slice(0, 8).map(([name]) => name);
}

function attachDropdown(inp, list, onPick) {
  let items = [], active = -1;
  const close = () => { list.hidden = true; inp.setAttribute("aria-expanded", "false"); inp.removeAttribute("aria-activedescendant"); active = -1; };
  const paint = () => {
    list.innerHTML = items.map((n, i) => `<li role="option" id="opt-${i}" aria-selected="${i === active}" data-i="${i}">${esc(n)}</li>`).join("");
    if (active >= 0) inp.setAttribute("aria-activedescendant", `opt-${active}`); else inp.removeAttribute("aria-activedescendant");
  };
  const open = () => {
    items = suggest(inp.value); active = -1;
    if (!items.length) return close();
    paint(); list.hidden = false; inp.setAttribute("aria-expanded", "true");
  };
  inp.addEventListener("input", open);
  inp.addEventListener("keydown", (e) => {
    if (list.hidden) { if (e.key === "ArrowDown" && inp.value) { open(); e.preventDefault(); } return; }
    if (e.key === "ArrowDown") { active = (active + 1) % items.length; paint(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = active <= 0 ? items.length - 1 : active - 1; paint(); e.preventDefault(); }
    else if (e.key === "Escape") { close(); e.preventDefault(); }
  });
  inp.addEventListener("blur", () => setTimeout(close, 150));
  // pointerdown keeps focus in the input so the pick registers before blur closes the list
  list.addEventListener("pointerdown", (e) => {
    const li = e.target.closest("li"); if (!li) return;
    e.preventDefault(); close(); onPick(items[+li.dataset.i]);
  });
  return { pickActive() { if (list.hidden || active < 0) return false; const n = items[active]; close(); onPick(n); return true; } };
}

async function loadPlayers() {
  try {
    const { players, aliases } = await api("GET", "/api/players");
    PLAYERS = players.map((name) => { const n = norm(name); return { name, n, words: n.split(" ") }; });
    ALIASES = Object.entries(aliases);
  } catch {
    // The dropdown is a convenience; typing a name still works without it.
  }
}

function renderCard() {
  const reached = view === "done" ? HOLES : R.current + (view === "reveal" ? 0 : 1);
  $("rows").innerHTML = R.holes.map((h, k) => {
    const cur = view !== "done" && (view === "reveal" ? k === R.current - 1 : k === R.current);
    const played = h.strokes != null;
    return `<tr class="${cur ? "cur" : ""}"><td class="mono">${k + 1}</td><td>${h.statName}</td>
      <td class="num">${k < reached && h.pin != null ? h.pin : "–"}</td>
      <td class="who ${played ? "" : "pending"}">${played ? esc(h.guess) : cur ? "On the tee" : ""}</td>
      <td class="num c-rank">${played ? (h.rank === OFF ? "250+" : h.rank) : ""}</td>
      <td class="num">${played ? h.strokes : ""}</td></tr>`;
  }).join("");
  $("total").textContent = R.total;
  const b = store.get("nbagolf-best");
  $("best").textContent = b == null ? "" : `Best ${b}`;
  $("holeno").innerHTML = view === "done" ? `Final<b>${R.total}</b>`
    : `Hole<b>${Math.min(view === "reveal" ? R.current : R.current + 1, HOLES)}/${HOLES}</b>`;
}

function render() {
  if (!R) return;
  renderTee();
  renderCard();
}

async function loadLeaders() {
  try {
    const { scores } = await api("GET", "/api/leaderboard?limit=10");
    $("leaders").innerHTML = scores.length
      ? `<ol>${scores.map((s, i) => `<li><span class="pos">${i + 1}</span><span class="who">${esc(s.player)}</span><span class="tot">${s.total}</span></li>`).join("")}</ol>`
      : `<p class="empty">No rounds posted yet. Finish a round and post your score to take the top spot.</p>`;
  } catch {
    $("leaders").innerHTML = `<p class="empty">The leaderboard couldn't load. Refresh the page to try again.</p>`;
  }
}

loadPlayers();
resume().catch((e) => { $("tee").innerHTML = `<p class="err">${esc(e.message)}. Refresh the page to try again.</p>`; });
loadLeaders();
