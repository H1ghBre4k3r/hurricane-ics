import test from "node:test";
import assert from "node:assert/strict";
import { parseFestivalPlan } from "./festival";

const lineupHtml = `
  <html>
    <body>
      <h1><span>LINE-UP</span> 2026</h1>
      <section class="m0132_lineupv2">
        <div class="m0132_lineupv2__day" data-day="18-06">
          <a class="m0132_lineupv2__show" data-category="33" data-stage="533" href="/line-up/act/massenkaraoke-mit-den-hansemaedchen/">
            <img data-image-imageSrc="/fileadmin/hanse.jpg" alt="" />
            <span class="m0132_lineupv2__time">17:30 - 18:30</span>
            <span class="m0132_lineupv2__artist">HANSEM&Auml;DCHEN</span>
            <span class="m0132_lineupv2__stage">Wild Coast Stage</span>
            <span class="m0132_lineupv2__category">Warm-Up Party</span>
          </a>
          <a class="m0132_lineupv2__show" data-category="33" data-stage="533" href="/line-up/act/juli/">
            <img data-src="/fileadmin/juli.jpg" alt="" />
            <span class="m0132_lineupv2__time">23:00 - 00:15</span>
            <span class="m0132_lineupv2__artist">JULI</span>
            <span class="m0132_lineupv2__stage">Wild Coast Stage</span>
            <span class="m0132_lineupv2__category">Warm-Up Party</span>
          </a>
        </div>
        <div class="m0132_lineupv2__day" data-day="19-06">
          <a class="m0132_lineupv2__show" data-category="6" data-stage="545" href="/line-up/act/kraftklub/">
            <img src="/fileadmin/kraftklub.jpg" alt="" />
            <span class="m0132_lineupv2__time">23:00 - 00:30</span>
            <span class="m0132_lineupv2__artist">KRAFTKLUB</span>
            <span class="m0132_lineupv2__stage">Forest Stage</span>
            <span class="m0132_lineupv2__category">Konzert</span>
          </a>
        </div>
      </section>
    </body>
  </html>
`;

test("parseFestivalPlan extracts current lineup cards", () => {
  const festival = parseFestivalPlan(lineupHtml);

  assert.equal(festival.shows.length, 3);
  assert.deepEqual(
    festival.shows.map((show) => show.date_start),
    ["260618", "260618", "260619"],
  );
  assert.equal(festival.shows[0].artist.name, "HANSEMÄDCHEN");
  assert.equal(
    festival.shows[0].artist.details_url,
    "/line-up/act/massenkaraoke-mit-den-hansemaedchen/",
  );
  assert.equal(festival.shows[0].artist.image, "/fileadmin/hanse.jpg");
  assert.equal(festival.shows[0].stage.name, "Wild Coast Stage");
  assert.equal(festival.shows[0].category.name, "Warm-Up Party");
  assert.equal(festival.shows[1].time_start, "23:00");
  assert.equal(festival.shows[1].time_end, "00:15");
  assert.equal(festival.shows[2].date_timestamp, "2606192300");
});
