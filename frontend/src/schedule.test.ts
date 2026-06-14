import { Show } from "../../src/types";
import { deduplicateShowsByArtist, formatConflictOverlap } from "./schedule";
import { expect, test } from "@jest/globals";

test("deduplicateShowsByArtist keeps same-day duplicates deterministic", () => {
  const shows: Show[] = [
    {
      category: { id: 1, name: "Konzert" },
      stage: { id: 1, name: "B Stage" },
      date_timestamp: "2606181800",
      date_start: "260618",
      time_start: "18:00",
      time_end: "19:00",
      artist: {
        name: "KRAFTKLUB",
        description: "",
        image: "/fileadmin/kraftklub.jpg",
        details_url: "/line-up/act/kraftklub/",
        url: "/line-up/act/kraftklub/",
      },
      teasertype: 0,
    },
    {
      category: { id: 1, name: "Konzert" },
      stage: { id: 2, name: "A Stage" },
      date_timestamp: "2606181930",
      date_start: "260618",
      time_start: "19:30",
      time_end: "20:30",
      artist: {
        name: "KRAFTKLUB",
        description: "",
        image: "/fileadmin/kraftklub.jpg",
        details_url: "/line-up/act/kraftklub/",
        url: "/line-up/act/kraftklub/",
      },
      teasertype: 0,
    },
    {
      category: { id: 1, name: "Konzert" },
      stage: { id: 2, name: "A Stage" },
      date_timestamp: "2606181930",
      date_start: "260618",
      time_start: "19:30",
      time_end: "20:30",
      artist: {
        name: "KRAFTKLUB",
        description: "",
        image: "/fileadmin/kraftklub.jpg",
        details_url: "/line-up/act/kraftklub-alt/",
        url: "/line-up/act/kraftklub-alt/",
      },
      teasertype: 0,
    },
    {
      category: { id: 1, name: "Konzert" },
      stage: { id: 3, name: "B Stage" },
      date_timestamp: "2606192000",
      date_start: "260619",
      time_start: "20:00",
      time_end: "21:00",
      artist: {
        name: "KRAFTKLUB",
        description: "",
        image: "/fileadmin/kraftklub.jpg",
        details_url: "/line-up/act/kraftklub-monday/",
        url: "/line-up/act/kraftklub-monday/",
      },
      teasertype: 0,
    },
  ];

  const deduped = deduplicateShowsByArtist(shows);

  expect(deduped).toHaveLength(3);

  const sameDayShows = deduped
    .filter((show) => show.date_start === "260618" && show.artist.name === "KRAFTKLUB")
    .map((show) => show.stage.name);
  expect(sameDayShows).toHaveLength(1);
  expect(sameDayShows[0]).toBe("A Stage");
});

test("formatConflictOverlap keeps duration readable", () => {
  const overlapStart = new Date(Date.UTC(2026, 5, 18, 19, 0));
  const overlapEnd = new Date(Date.UTC(2026, 5, 18, 20, 45));

  expect(formatConflictOverlap(overlapStart, overlapEnd)).toBe("1h 45m overlap");
});
