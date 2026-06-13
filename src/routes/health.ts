import { Request, Response } from "express";

export const handleHealthCheck = (_req: Request, res: Response) => {
  res.sendStatus(200);
};
