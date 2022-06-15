export enum Day {
    thursday = 0,
    friday = 1,
    saturday = 2,
    sunday = 3,
    monday = 4,
}

export type Category = {
    id: number;
    name: string;
};

export type Stage = {
    id: number;
    name: string;
};

export type Artist = {
    name: string;
    description: string;
    image: string;
    details_url: string;
    url: string;
};

export type Show = {
    category: Category;
    stage: Stage;
    date_timestamp: string;
    date_start: string;
    time_start: string;
    time_end: string;
    artist: Artist;
    teasertype: number;
};

export type FestivalPlan = {
    shows: Show[];
};

export type FetchFestivalFn = () => Promise<FestivalPlan>;
