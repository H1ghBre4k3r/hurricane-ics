import http from "http";
import ical, { ICalEventData } from "ical-generator";

const calendar = ical({ name: "Hurricane Calendar" });

enum Day {
    thursday = 0,
    friday = 1,
    saturday = 2,
    sunday = 3,
    monday = 4,
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

type ConcertDate = {
    hours: number;
    minutes: number;
};

function date(hours: number, minutes = 0): ConcertDate {
    return {
        hours,
        minutes,
    };
}

type Concert = {
    summary: string;
    location: Location;
    start: ConcertDate;
    end: ConcertDate;
};

type FestivalPlan = {
    [day in Day]: Concert[];
};

const festival: FestivalPlan = {
    [Day.thursday]: [
        {
            summary: "ALEX MOFA GANG",
            location: Location.WildCoastStage,
            start: date(20),
            end: date(21),
        },
        {
            summary: "MILLIARDEN",
            location: Location.WildCoastStage,
            start: date(21, 30),
            end: date(22, 30),
        },
        {
            summary: "SONDASCHULE",
            location: Location.WildCoastStage,
            start: date(23),
            end: date(24, 15),
        },
        {
            summary: "MEGALOH",
            location: Location.WildCoastStage,
            start: date(24, 45),
            end: date(26),
        },
    ],
    [Day.friday]: [
        {
            summary: "#HURRICANESWIMTEAM",
            location: Location.ForestStage,
            start: date(15),
            end: date(15, 30),
        },
        {
            summary: "INHALER",
            location: Location.RiverStage,
            start: date(15, 30),
            end: date(16),
        },
        {
            summary: "GOAT GIRL",
            location: Location.WildCoastStage,
            start: date(15, 30),
            end: date(16, 15),
        },
        {
            summary: "THE DEAD SOUTH",
            location: Location.ForestStage,
            start: date(16),
            end: date(16, 45),
        },
        {
            summary: "WARGASM",
            location: Location.MountainStage,
            start: date(16),
            end: date(16, 45),
        },
        {
            summary: "GAYLE",
            location: Location.RiverStage,
            start: date(16, 30),
            end: date(17, 15),
        },
        {
            summary: "KELVYN COLT",
            location: Location.WildCoastStage,
            start: date(16, 45),
            end: date(17, 30),
        },
        {
            summary: "GIANT ROOKS",
            location: Location.ForestStage,
            start: date(17, 15),
            end: date(18, 15),
        },
        {
            summary: "MILLENCOLIN",
            location: Location.MountainStage,
            start: date(17, 15),
            end: date(18, 15),
        },
        {
            summary: "LP",
            location: Location.RiverStage,
            start: date(18),
            end: date(19),
        },
        {
            summary: "FONTAINES D.C.",
            location: Location.WildCoastStage,
            start: date(18, 15),
            end: date(19, 15),
        },
        {
            summary: "DERMOT KENNEDY",
            location: Location.ForestStage,
            start: date(19),
            end: date(20),
        },
        {
            summary: "WHILE SHE SLEEPS",
            location: Location.MountainStage,
            start: date(19),
            end: date(20),
        },
        {
            summary: "CHARLI XCX",
            location: Location.RiverStage,
            start: date(19, 45),
            end: date(21),
        },
        {
            summary: "LOOPERS",
            location: Location.WildCoastStage,
            start: date(19, 45),
            end: date(21, 15),
        },
        {
            summary: "THE KILLERS",
            location: Location.ForestStage,
            start: date(20, 45),
            end: date(22),
        },
        {
            summary: "NECK DEEP",
            location: Location.MountainStage,
            start: date(21),
            end: date(22),
        },
        {
            summary: "MATISSE & SADKO",
            location: Location.WildCoastStage,
            start: date(21, 20),
            end: date(22, 50),
        },
        {
            summary: "SDP",
            location: Location.RiverStage,
            start: date(21, 45),
            end: date(23, 15),
        },
        {
            summary: "ELECTRIC CALLBOY",
            location: Location.MountainStage,
            start: date(22, 45),
            end: date(23, 45),
        },
        {
            summary: "JULIAN JORDAN",
            location: Location.WildCoastStage,
            start: date(22, 55),
            end: date(24, 30),
        },
        {
            summary: "SEEED",
            location: Location.ForestStage,
            start: date(23),
            end: date(24, 30),
        },
        {
            summary: "MARTIN GARRIX",
            location: Location.RiverStage,
            start: date(24, 30),
            end: date(26),
        },
    ],
    [Day.saturday]: [],
    [Day.sunday]: [],
    [Day.monday]: [],
};
const concerts = Object.entries(festival).flatMap(([day, concerts]) => {
    return concerts.map<ICalEventData>((concert) => {
        return {
            summary: concert.summary,
            location: concert.location,
            start: event(parseInt(day, 10), concert.start.hours, concert.start.minutes),
            end: event(parseInt(day, 10), concert.end.hours, concert.end.minutes),
            categories: [
                {
                    name: concert.location,
                },
            ],
        };
    });
});

calendar.events(concerts);

http.createServer((_, res) => calendar.serve(res)).listen(3000, "127.0.0.1", () => {
    console.log("Server running at http://127.0.0.1:3000/");
});
