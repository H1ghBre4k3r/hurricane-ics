import { Request, Response } from "express";
import { FetchFestivalFn } from "../../types";

export const handleGetConcertsApiFactory = (fetchFestival: FetchFestivalFn) => {
  return async (_: Request, res: Response) => {
    const festival = await fetchFestival();
    res.json(festival);
  };
};
