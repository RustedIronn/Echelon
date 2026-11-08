# Time of day (phase 1-3 review build)

Default is the approved renderer (diff 0 against the previous capture), kept as the comparison mode. Look-dev panel, "Time of day": Approved, Live clock (device clock, date and timezone), nine presets, an hour slider and a date picker. URL: `?tod=19.5`, `?tod=19.5&date=2026-06-21`, `?tod=live`.

- Artistic solar cycle from the calendar (no location): day length and sun height vary through the year; the sun rises behind the camera, climbs through the open sky and sets in front, behind the mountains. The moon follows the calendar phase (full moon rises near sunset) and crosses the front sky low enough to be seen.
- Mood anchors (morning, afternoon, evening, night) are colour and mood stops blended continuously by solar elevation along a rising and a setting timeline; nothing swaps by hour. Tests check no jump above a set size between any two ten-minute steps on five dates.
- Generated sky (`generatedSky.js`): horizon-to-zenith gradient, sun halo and disc, rose belt opposite the sun, soft clouds, stars, phase-shaded moon. The same function feeds a small environment map so grass, hamlet, mountains and water pick up the sky colour. The water reflection refreshes after each sky change.
- Hemisphere fill has a sage ground colour in every mood; windows glow warm from dusk (and a little before dawn).

Review captures: `diagnostics/out/o-a.png`, `o-b.png`, `n-b.png`, `m-*.png`.

Known gaps: the afternoon sky is still slightly greyer than a clear light blue; evening skies are pale before the sunset colour builds; no cloud drift while the clock is live (static per refresh); clouds cannot yet cast ground shadows; no moon on dates/hours when it sits outside the view; the water tint and murk are not tuned per mood; no seasons.
