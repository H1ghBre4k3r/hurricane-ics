import { fetchFestivalFactory } from "./festival";
import { createServer } from "./server";

const server = createServer(fetchFestivalFactory());

server.listen(3000, () => {
  console.log(`Started listening on port :3000`);
});
