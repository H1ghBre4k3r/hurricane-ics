import express, { Router } from "express";
import { festival } from "./festival";
import { handleGetDayFactory } from "./routes/day.route";
import { handleGetIndexFactory } from "./routes/index.route";

const server = express();

const router = Router();
router.get("/", handleGetIndexFactory(festival));
router.get("/day/:day", handleGetDayFactory(festival));
server.use("/ics/2022", router);

server.listen(3000, () => {
    console.log(`Started listening on port :3000`);
});
