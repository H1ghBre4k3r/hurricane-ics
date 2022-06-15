export const parseDate = (rawDate: string, rawTime: string): Date => {
    const [year, month, day] = /(\d\d)(\d\d)(\d\d)/
        .exec(rawDate)!
        .slice(1)
        .map((d) => parseInt(d, 10));
    const [hour, minute] = /(\d+):(\d+)/
        .exec(rawTime)!
        .slice(1)
        .map((d) => parseInt(d, 10));
    return new Date(2000 + year, month - 1, day, hour, minute);
};
