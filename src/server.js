const { createApp } = require("./app");
const { createStore } = require("./store");

async function main() {
  const store = createStore(process.env.DATABASE_URL);
  await store.init();
  const port = process.env.PORT || 3000;
  createApp(store).listen(port, () => console.log(`NBA Golf listening on ${port} (${store.kind} store)`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
