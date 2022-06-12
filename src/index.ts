import express from "express";
import { festival } from "./festival";
import { handleGetIndexFactory } from "./routes/index.route";

const server = express();

server.get("/ics/2022", handleGetIndexFactory(festival));

server.listen(3000, () => {
    console.log(`Started listening on port :3000`);
});
