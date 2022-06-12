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
    [Day.saturday]: [
        {
            summary: "SROTTGRENZE",
            location: Location.ForestStage,
            start: date(12),
            end: date(12, 30),
        },
        {
            summary: "PANO",
            location: Location.MountainStage,
            start: date(12),
            end: date(12, 30),
        },
        {
            summary: "HELGEN",
            location: Location.RiverStage,
            start: date(12, 30),
            end: date(13, 15),
        },
        {
            summary: "THE LATHUMS",
            location: Location.WildCoastStage,
            start: date(12, 45),
            end: date(13, 15),
        },
        {
            summary: "BRUTUS",
            location: Location.ForestStage,
            start: date(13),
            end: date(13, 45),
        },
        {
            summary: "FLASH FORWARD",
            location: Location.MountainStage,
            start: date(13),
            end: date(13, 45),
        },
        {
            summary: "HALF MOON RUN",
            location: Location.RiverStage,
            start: date(13, 45),
            end: date(14, 30),
        },
        {
            summary: "HOLLY HUMBERSTONE",
            location: Location.WildCoastStage,
            start: date(13, 45),
            end: date(14, 30),
        },
        {
            summary: "NOTHING BUT THIEVES",
            location: Location.ForestStage,
            start: date(14, 15),
            end: date(15),
        },
        {
            summary: "REIGNWOLF",
            location: Location.MountainStage,
            start: date(14, 15),
            end: date(15, 15),
        },
        {
            summary: "PROVINZ",
            location: Location.RiverStage,
            start: date(15),
            end: date(15, 45),
        },
        {
            summary: "KAT FRANKIE",
            location: Location.WildCoastStage,
            start: date(15),
            end: date(15, 45),
        },
        {
            summary: "BAD RELIGION",
            location: Location.ForestStage,
            start: date(15, 40),
            end: date(16, 25),
        },
        {
            summary: "TURBOSTAAT",
            location: Location.MountainStage,
            start: date(15, 45),
            end: date(16, 45),
        },
        {
            summary: "JUJU",
            location: Location.RiverStage,
            start: date(16, 15),
            end: date(17, 15),
        },
        {
            summary: "JEREMIAS",
            location: Location.WildCoastStage,
            start: date(16, 15),
            end: date(17, 15),
        },
        {
            summary: "JUMMY EAT WORLD",
            location: Location.ForestStage,
            start: date(17, 5),
            end: date(18, 5),
        },
        {
            summary: "JC STEWART",
            location: Location.MountainStage,
            start: date(17, 15),
            end: date(18, 15),
        },
        {
            summary: "FOALS",
            location: Location.RiverStage,
            start: date(18),
            end: date(19),
        },
        {
            summary: "AURORA",
            location: Location.WildCoastStage,
            start: date(18),
            end: date(19),
        },
        {
            summary: "MANDO DIAO",
            location: Location.ForestStage,
            start: date(18, 45),
            end: date(19, 45),
        },
        {
            summary: "FIL BO RIVA",
            location: Location.MountainStage,
            start: date(18, 50),
            end: date(20, 5),
        },
        {
            summary: "IDLES",
            location: Location.RiverStage,
            start: date(19, 45),
            end: date(21),
        },
        {
            summary: "OH WONDER",
            location: Location.WildCoastStage,
            start: date(19, 45),
            end: date(21),
        },
        {
            summary: "VON WEGEN LISBETH",
            location: Location.ForestStage,
            start: date(20, 35),
            end: date(21, 50),
        },
        {
            summary: "ANTILOPEN GANG",
            location: Location.MountainStage,
            start: date(20, 45),
            end: date(22),
        },
        {
            summary: "K.I.Z",
            location: Location.RiverStage,
            start: date(21, 45),
            end: date(23, 15),
        },
        {
            summary: "KOLLEKTIV TURMSTRASSE LIVE",
            location: Location.WildCoastStage,
            start: date(21, 45),
            end: date(23, 15),
        },
        {
            summary: "DEICHKIND",
            location: Location.ForestStage,
            start: date(22, 50),
            end: date(24, 30),
        },
        {
            summary: "KITSCHKRIEG",
            location: Location.MountainStage,
            start: date(23),
            end: date(24, 30),
        },
        {
            summary: "THE STICKMEN PROJECT",
            location: Location.WildCoastStage,
            start: date(23, 45),
            end: date(25, 15),
        },
        {
            summary: "TWENTY ONE PILOTS",
            location: Location.RiverStage,
            start: date(24, 30),
            end: date(26),
        },
    ],
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
