import express, { Router } from "express";
import { fetchFestivalFactory } from "./festival";
import { handleGetConcertsApiFactory } from "./routes/api/concerts.api";
import { handleGetArtistIcsFactory } from "./routes/ics/artist.ics";
import { handleGetDayIcsFactory } from "./routes/ics/day.ics";
import { handleGetIndexIcsFactory } from "./routes/ics/index.ics";

const fetchFestival = fetchFestivalFactory();

const server = express();

server.use("/", express.static(`${__dirname}/../frontend/build`));

const icsRouter = Router();

icsRouter.get("/", handleGetIndexIcsFactory(fetchFestival));
icsRouter.get("/day/:day", handleGetDayIcsFactory(fetchFestival));
icsRouter.get("/artist", handleGetArtistIcsFactory(fetchFestival));
server.use("/ics/2022", icsRouter);

const apiRouter = Router();
apiRouter.get("/concerts", handleGetConcertsApiFactory(fetchFestival));
server.use("/api", apiRouter);

server.listen(3000, () => {
    console.log(`Started listening on port :3000`);
});
