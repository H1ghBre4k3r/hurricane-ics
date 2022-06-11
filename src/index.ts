import http from "http";
import ical, { ICalEventData } from "ical-generator";

const calendar = ical({ name: "Hurricane Calendar" });

enum Day {
    thursday = 0,
    friday = 1,
    saturday = 2,
    sunday = 3,
}

enum Location {
    WildCoastStage = "Wild Coast Stage",
    CoastStage = "Coast Stage",
    ForestStage = "Forest Stage",
    RiverStage = "River Stage",
    MountainStage = "Mountain Stage",
}

function event(day: Day, hour: number, minutes = 0): Date {
    return new Date(2022, 5, 16 + day, hour, minutes);
}

const concerts: ICalEventData[] = [
    {
        summary: "ALEX MOFA GANG",
        location: Location.WildCoastStage,
        start: event(Day.thursday, 20),
        end: event(Day.thursday, 21),
    },
    {
        summary: "MILLIARDEN",
        location: Location.WildCoastStage,
        start: event(Day.thursday, 21, 30),
        end: event(Day.thursday, 22, 30),
    },
    {
        summary: "SONDASCHULE",
        location: Location.WildCoastStage,
        start: event(Day.thursday, 23),
        end: event(Day.friday, 0, 15),
    },
    {
        summary: "MEGALOH",
        location: Location.WildCoastStage,
        start: event(Day.friday, 0, 45),
        end: event(Day.friday, 2),
    },
];

calendar.events(concerts);

http.createServer((_, res) => calendar.serve(res)).listen(3000, "127.0.0.1", () => {
    console.log("Server running at http://127.0.0.1:3000/");
});
