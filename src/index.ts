import http from "http";
import ical, { ICalEventData } from "ical-generator";

const calendar = ical({ name: "Hurricane Calendar" });

enum Day {
    thursday = 0,
    friday = 1,
    saturday = 2,
    sunday = 3,
}

function event(day: Day, hour: number): Date {
    return new Date(2022, 5, 16 + day, hour);
}

const concerts: ICalEventData[] = [
    {
        summary: "ALEX MOFA GANG",
        location: "Wild Coast Stage",
        start: event(Day.thursday, 20),
        end: event(Day.thursday, 21),
    },
];

calendar.events(concerts);

http.createServer((_, res) => calendar.serve(res)).listen(3000, "127.0.0.1", () => {
    console.log("Server running at http://127.0.0.1:3000/");
});
