import { Request, Response } from "express";
import { GetFestivalStatusFn } from "../../types";

export const handleGetStatusApiFactory = (
  getFestivalStatus: GetFestivalStatusFn,
) => {
  return (_req: Request, res: Response) => {
    res.json(getFestivalStatus());
  };
};
