import { Request, Response } from "express";
import { ConcertsApiResponse, FestivalFetchStatus, FetchFestivalFn } from "../../types";

type FetchFestivalWithMetadata = FetchFestivalFn & {
  getStatus: () => FestivalFetchStatus;
};

export const handleGetConcertsApiFactory = (
  fetchFestival: FetchFestivalWithMetadata,
) => {
  return async (_: Request, res: Response) => {
    const festival = await fetchFestival();
    const status = fetchFestival.getStatus();

    const payload = {
      ...festival,
      stale: status.stale,
      staleReason: status.staleReason,
      cacheAvailable: status.cacheAvailable,
      lastUpdated: status.lastSuccessfulFetch,
      health: status.health,
    };

    res.json(payload);
  };
};
