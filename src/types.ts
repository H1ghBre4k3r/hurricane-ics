export enum Day {
    thursday = 0,
    friday = 1,
    saturday = 2,
    sunday = 3,
    monday = 4,
}

export enum Stage {
    WildCoastStage = "Wild Coast Stage",
    CoastStage = "Coast Stage",
    ForestStage = "Forest Stage",
    RiverStage = "River Stage",
    MountainStage = "Mountain Stage",
}

export type ConcertDate = {
    hours: number;
    minutes: number;
};

export type Concert = {
    summary: string;
    location: Stage;
    start: ConcertDate;
    end: ConcertDate;
};

export type FestivalPlan = {
    [day in Day]: Concert[];
};
