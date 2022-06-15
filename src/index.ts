import express, { Router } from "express";
import { fetchFestivalFactory } from "./festival";
import { handleGetArtistFactory } from "./routes/artist.route";
import { handleGetDayFactory } from "./routes/day.route";
import { handleGetIndexFactory } from "./routes/index.route";

const server = express();
const router = Router();
const fetchFestival = fetchFestivalFactory();

server.use("/", express.static(`${__dirname}/../frontend/build`));

router.get("/", handleGetIndexFactory(fetchFestival));
router.get("/day/:day", handleGetDayFactory(fetchFestival));
router.get("/artist", handleGetArtistFactory(fetchFestival));
server.use("/ics/2022", router);

server.listen(3000, () => {
    console.log(`Started listening on port :3000`);
});
