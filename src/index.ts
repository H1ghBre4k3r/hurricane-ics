import express, { Router } from "express";
import { fetchFestival } from "./festival";
import { handleGetDayFactory } from "./routes/day.route";
import { handleGetIndexFactory } from "./routes/index.route";

const server = express();

const router = Router();
router.get("/", handleGetIndexFactory(fetchFestival));
router.get("/day/:day", handleGetDayFactory(fetchFestival));
server.use("/ics/2022", router);

server.listen(3000, () => {
    console.log(`Started listening on port :3000`);
});
