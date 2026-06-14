import { Buffer } from "buffer";

export const SHARE_QUERY_PARAM = "artists";

export const encodeArtists = (artists: string[]): string => {
  return encodeURIComponent(
    Buffer.from(JSON.stringify(artists)).toString("base64"),
  );
};

export const decodeArtists = (encodedArtists: string | null): string[] => {
  if (!encodedArtists) {
    return [];
  }

  try {
    const decoded = Buffer.from(
      decodeURIComponent(encodedArtists),
      "base64",
    ).toString("utf8");
    const parsed = JSON.parse(decoded);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return Array.from(
      new Set(
        parsed.filter(
          (artist): artist is string =>
            typeof artist === "string" && artist.trim().length > 0,
        ),
      ),
    );
  } catch {
    return [];
  }
};

export const getSharedArtistsFromSearch = (search: string): string[] => {
  const params = new URLSearchParams(search);
  return decodeArtists(params.get(SHARE_QUERY_PARAM));
};

export const makeSelectionMap = (
  artists: string[],
): { [key: string]: boolean } => {
  return artists.reduce<{ [key: string]: boolean }>((memo, artist) => {
    memo[artist] = true;
    return memo;
  }, {});
};

export const makeCalendarUrl = (
  protocol: "https" | "webcal",
  host: string,
  artists: string[],
): string => {
  const base = `${protocol}://${host}/ics`;
  return artists.length ? `${base}/artist/?q=${encodeArtists(artists)}` : base;
};

export const makeShareUrl = (host: string, artists: string[]): string => {
  const base = `https://${host}/`;
  return artists.length
    ? `${base}?${SHARE_QUERY_PARAM}=${encodeArtists(artists)}`
    : base;
};
