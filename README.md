# NBA Golf

NBA trivia scored like golf. Each round has five holes. On each hole you're asked who sits at a given spot on an all-time career leaderboard (points, rebounds, assists, blocks, steals or field goal percentage), and every place your answer is away from that spot is a stroke. Lowest total wins.

Example: the pin is No. 69 on the scoring list. You answer LeBron James, who is No. 1, so you take 68 strokes.

## Rules

- Each round uses five of the six lists, with a pin somewhere in the top 100.
- A player outside the top 250 of that list counts as No. 251.
- Tied players share a rank.
- Names are matched loosely: accents, small typos, unique last names and common nicknames (Shaq, KD, The Dream) all work. When a name could mean more than one player, the game asks which one.

## Data

`data/leaders.json` is a snapshot of the top 250 on Basketball Reference's career leader pages (NBA and ABA combined), taken Oct 12, 2026:
<https://www.basketball-reference.com/leaders/>

## How it works

- `src/app.js` is an Express API. Rounds are created and scored on the server, so pins for later holes and answers for unplayed holes never reach the browser.
- `src/store.js` keeps rounds and the leaderboard in Postgres when `DATABASE_URL` is set (tables are created on startup), and in memory otherwise.
- `public/` is the game page, served as static files.

| Method | Path | What it does |
| --- | --- | --- |
| `POST` | `/api/rounds` | Start a round |
| `GET` | `/api/rounds/:id` | Current state of a round |
| `POST` | `/api/rounds/:id/guess` | `{ name, confirm? }`. Returns `pick` with close matches, `unknown`, or `scored` |
| `POST` | `/api/rounds/:id/submit` | `{ player }`. Post a finished round to the leaderboard |
| `GET` | `/api/leaderboard` | Lowest rounds, `?limit=` up to 50 |
| `GET` | `/healthz` | Health check |

## Run locally

```sh
npm install
npm start            # http://localhost:3000, in-memory store
npm test             # add TEST_DATABASE_URL=postgres://... to also test against Postgres
```

## Deploy to Heroku

With the Heroku CLI:

```sh
heroku create nba-golf
heroku addons:create heroku-postgresql:essential-0
git push heroku main
heroku open
```

Or from the dashboard: create an app, add the Heroku Postgres add-on, then under **Deploy** connect this GitHub repo and deploy the `main` branch (optionally turn on automatic deploys). `Procfile` and `app.json` are already set up, and the app reads Heroku's `PORT` and `DATABASE_URL`.
