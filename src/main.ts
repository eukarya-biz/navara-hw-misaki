import ThreeView, { Color, degreeToRadian, radianToDegree, vector3ToGeodetic } from "@navara/three";
import { DefaultDescriptions, DefaultPlugin } from "@navara/three_default_plugin";
import { Vector3 } from "three";
import { createCompass } from "./compass";
import { createDatePicker } from "./datePicker";
import { createHeightSlider } from "./heightSlider";
import { createRegionSelect, type RegionOverview } from "./regionSelect";
import { createSpotList } from "./spotList";
import { fetchSunsetSpots, sunsetSpotsToFeatureCollection } from "./sunsetSpots";
import { createTimeSlider } from "./timeSlider";
import { createControlPanel } from "./ui/panel";
import { createWelcomeModal } from "./welcomeModal";

const view = new ThreeView<DefaultDescriptions>({ shadow: true });

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

// Fetch alongside `view.init()` rather than after — an independent network
// request, no reason to serialize it behind WASM/worker startup. Falls back
// to an empty list on failure (CMS down/slow, bad response, ...) rather than
// rejecting — this is a nice-to-have overlay, not core to the map, so it
// shouldn't be able to block the rest of the app from starting up.
const sunsetSpotsPromise = fetchSunsetSpots().catch((error: unknown) => {
  console.error("Failed to load sunset-spot data; continuing without it.", error);
  return [];
});

// Initialization

await view.init();

// Setup scene — sun + sky ambient driven by view.atmosphere.date
const { sky } = defaultPlugin.addDefaultPhotorealScene();

// A bigger sun disc reads more dramatically for a sunset viewer than the
// real ~0.267° angular size (0.004675 rad) the default renders at.
const SUN_ANGULAR_RADIUS_SCALE = 5;
const DEFAULT_SUN_ANGULAR_RADIUS = 0.004675;
sky.update({ sky: { sunAngularRadius: DEFAULT_SUN_ANGULAR_RADIUS * SUN_ANGULAR_RADIUS_SCALE } });

const cameraTarget = { lng: 139.767125, lat: 35.681236, height: 4000 };

// Ground height at `cameraTarget`'s lng/lat, and how far above it the camera
// currently sits — kept separate so the height slider can re-derive
// `cameraTarget.height` for the *current* spot, and so a later click reuses
// whatever margin the user last chose instead of resetting to the default.
let groundHeightAtTarget = 0;
let heightMargin = 120;

// Approximate solar timezone from longitude (15° per hour) — no timezone
// boundary data, so this ignores political borders/DST. Good enough for a
// sunset simulator where "local time at the clicked spot" just needs to be
// roughly right.
function utcOffsetHoursForLng(lng: number): number {
  return Math.round(lng / 15);
}

// Builds the Date for a given wall-clock hour:minute *at* offsetHours, on the
// calendar day `day` falls on at that offset — entirely independent of the
// device's own timezone (unlike `new Date(); .setHours(...)`, which is
// device-local).
function zonedDateAt(offsetHours: number, day: Date, hour: number, minute: number): Date {
  const shiftedDay = new Date(day.getTime() + offsetHours * 3_600_000);
  const utcMillis = Date.UTC(
    shiftedDay.getUTCFullYear(),
    shiftedDay.getUTCMonth(),
    shiftedDay.getUTCDate(),
    hour,
    minute,
  );
  return new Date(utcMillis - offsetHours * 3_600_000);
}

// Formats a Date as "HH:MM" wall-clock time at a given UTC offset — for
// display only (unlike `zonedDateAt`, not meant to round-trip).
function formatTimeOfDay(date: Date, offsetHours: number): string {
  const shifted = new Date(date.getTime() + offsetHours * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

// Sun elevation + azimuth (degrees) at an arbitrary date/lat/lng, via a
// standard low-precision solar position formula (NOAA/Astronomical Almanac;
// accurate to a small fraction of a degree, plenty for both picking a
// viewing time and aiming the camera). Deliberately independent of
// `view.atmosphere.sunDirection`: that value is only guaranteed accurate for
// whatever `date` the engine last actually *rendered*, and doesn't update
// synchronously within the same script turn a `date` write happens in —
// unlike the plain `date` getter/setter, deriving `sunDirection` from it
// involves internal recomputation that lags behind by at least one frame.
// That silently broke two different call sites this way: a tight search
// loop that set `date` dozens of times and always read back the same stale
// direction, and the date picker's immediate re-aim after a single `date`
// write, which produced no visible change (or pointed at empty sky) because
// the frame hadn't caught up yet.
function sunPosition(date: Date, latDeg: number, lngDeg: number): { elevationDeg: number; azimuthDeg: number } {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const wrapToPi = (rad: number) => {
    const twoPi = 2 * Math.PI;
    let r = rad % twoPi;
    if (r < -Math.PI) r += twoPi;
    if (r > Math.PI) r -= twoPi;
    return r;
  };

  const daysSinceJ2000 = date.getTime() / 86_400_000 + 2440587.5 - 2451545.0;

  const meanLongitudeDeg = (280.46 + 0.9856474 * daysSinceJ2000) % 360;
  const meanAnomaly = toRad((357.528 + 0.9856003 * daysSinceJ2000) % 360);
  const eclipticLongitude = toRad(
    meanLongitudeDeg + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly),
  );
  const obliquity = toRad(23.439 - 0.0000004 * daysSinceJ2000);

  const declination = Math.asin(Math.sin(obliquity) * Math.sin(eclipticLongitude));
  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(eclipticLongitude),
    Math.cos(eclipticLongitude),
  );

  const equationOfTimeMinutes = toDeg(wrapToPi(toRad(meanLongitudeDeg) - rightAscension)) * 4;
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const solarTimeHours = utcHours + lngDeg / 15 + equationOfTimeMinutes / 60;
  // `solarTimeHours` isn't confined to a 24h day (adding `lngDeg / 15`, up to
  // ±12h, to `utcHours` can land well outside [0, 24] for longitudes far
  // from where `utcHours` "expects"), so the raw hour angle in degrees can
  // land well outside ±180° too. `Math.cos`/`Math.sin` don't care — they're
  // periodic — but the morning/afternoon branch below keys off its *sign*,
  // which is only meaningful once wrapped to a canonical ±180° range. Left
  // unwrapped, that branch silently picked the wrong formula for anywhere
  // far enough from Japan, mirroring the azimuth ~180° off (a heading that
  // looked like it was aiming at sunrise instead of sunset).
  const hourAngle = wrapToPi(toRad((solarTimeHours - 12) * 15));

  const latRad = toRad(latDeg);
  const elevationRad = Math.asin(
    Math.sin(latRad) * Math.sin(declination) +
      Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle),
  );

  // Azimuth, degrees clockwise from North (matches Navara's `heading`).
  const zenithRad = Math.PI / 2 - elevationRad;
  const cosAzimuth = clamp(
    (Math.sin(latRad) * Math.cos(zenithRad) - Math.sin(declination)) /
      (Math.cos(latRad) * Math.sin(zenithRad)),
    -1,
    1,
  );
  const acosAzimuthDeg = toDeg(Math.acos(cosAzimuth));
  const azimuthDeg = hourAngle > 0 ? (acosAzimuthDeg + 180) % 360 : (540 - acosAzimuthDeg) % 360;

  return { elevationDeg: toDeg(elevationRad), azimuthDeg };
}

// Finds the moment nearest local solar noon at which the sun's elevation at
// (lat, lng) drops to `targetElevationDeg` — the afternoon-to-evening
// approach to sunset, not the morning rise through the same angle. Scans in
// 15-minute steps from local noon toward midnight, then bisects the
// bracketing pair for precision. Sets `atmosphere.date` to the result and
// returns it.
//
// If the sun is already below the target at noon (deep winter at high
// latitude), noon is the closest it gets, so that's used directly. If it
// never drops that low before midnight (polar summer), midnight is used as
// the closest available approximation of "evening".
function setDateToSunsetElevation(
  lat: number,
  lng: number,
  targetElevationDeg: number,
  day: Date,
): Date {
  const elevationAt = (date: Date): number => sunPosition(date, lat, lng).elevationDeg;

  const noon = zonedDateAt(utcOffsetHoursForLng(lng), day, 12, 0);
  let result = noon;
  if (elevationAt(noon) >= targetElevationDeg) {
    // Elevation decreases monotonically from its noon peak toward midnight,
    // so the first sub-threshold sample is the only crossing.
    const STEP_MS = 15 * 60_000;
    const STEPS = (12 * 60 * 60_000) / STEP_MS; // noon → midnight
    let prevTime = noon;
    result = new Date(noon.getTime() + STEPS * STEP_MS); // falls back to midnight if no crossing found
    for (let i = 1; i <= STEPS; i++) {
      const time = new Date(noon.getTime() + i * STEP_MS);
      if (elevationAt(time) < targetElevationDeg) {
        let lo = prevTime.getTime();
        let hi = time.getTime();
        for (let iter = 0; iter < 20; iter++) {
          const mid = (lo + hi) / 2;
          if (elevationAt(new Date(mid)) > targetElevationDeg) lo = mid;
          else hi = mid;
        }
        result = new Date((lo + hi) / 2);
        break;
      }
      prevTime = time;
    }
  }

  view.atmosphere.date = result;
  return result;
}

// The sunset-viewing elevation this app aims for whenever it picks a time —
// on the initial view and after every click-to-fly.
const SUNSET_VIEW_ELEVATION_DEG = 0;

const initialOffsetHours = utcOffsetHoursForLng(cameraTarget.lng);

// Calendar day currently in effect, set by the date picker. Carried across
// clicks (only the location changes, not the day) and re-applied whenever
// the sunset time needs recomputing.
let currentDay = new Date();

// Reference instant the time slider offsets from — reset to the freshly
// computed sunset time whenever it, the location, or the day changes.
let baseSunsetDate = setDateToSunsetElevation(
  cameraTarget.lat,
  cameraTarget.lng,
  SUNSET_VIEW_ELEVATION_DEG,
  currentDay,
);

// Compass — reflects the camera's actual current heading. `aimCameraAtSun`
// and `animatePitchToSun` below update it directly (with the heading they
// already just computed) since `view.setCamera` doesn't emit the camera's
// `move` event the way drag-to-rotate does; `move` is still listened for
// separately to catch that manual-rotation case, which those two functions
// don't cover.
const compass = createCompass();
view.camera.on("move", () => {
  compass.setHeading(view.camera.orientation.heading ?? 0);
});

// A fixed heading/pitch only faces the sun by coincidence — the sun's azimuth
// and elevation change with `atmosphere.date`. Re-derive the heading and pitch
// that point at the sun from the camera's ground position each time the date
// changes, so the sun stays in frame instead of drifting out of the frustum.
// Uses the same self-contained `sunPosition` formula as the sunset-time
// search, not `view.atmosphere.sunDirection` — see `sunPosition`'s comment
// for why reading that back right after a `date` write isn't reliable.
function sunOrientation(): { heading: number; pitch: number } {
  const { elevationDeg, azimuthDeg } = sunPosition(
    view.atmosphere.date,
    cameraTarget.lat,
    cameraTarget.lng,
  );
  return { heading: azimuthDeg, pitch: elevationDeg };
}

// Bumped by every orientation change (direct or animated) so a stale
// `animatePitchToSun` loop from an earlier click can tell it's been
// superseded and stop overwriting whatever set the camera afterward — e.g.
// changing the date picker or height slider while that ~600ms landing
// animation is still running previously got silently clobbered a frame
// later by the old animation's next tick.
let orientationGeneration = 0;

function aimCameraAtSun(): void {
  orientationGeneration++;
  const orientation = sunOrientation();
  view.setCamera({ ...cameraTarget, ...orientation, roll: 0 });
  compass.setHeading(orientation.heading);
}

// Region overviews: bright, top-down views used both for the initial
// landing view (Japan) and the region quick-jump control below. A single
// `atmosphere.date` lights the whole globe at once, so wherever that
// terminator currently falls, roughly half the planet is night — a region's
// own overview sidesteps that by setting noon *at that region's own
// longitude* rather than trying to light everywhere simultaneously.
// `cameraTarget` keeps its placeholder value untouched until the user picks
// a spot (click / list / marker), which is what switches to the close-up,
// sunset-timed view via `flyToLocation`.
const REGION_OVERVIEWS: RegionOverview[] = [
  { name: "Japan", lat: 36.5, lng: 138, height: 2_800_000 },
  { name: "North America", lat: 45, lng: -100, height: 4_500_000 },
  { name: "South America", lat: -15, lng: -60, height: 4_200_000 },
  { name: "Europe", lat: 50, lng: 15, height: 3_000_000 },
  { name: "Africa", lat: 2, lng: 20, height: 4_800_000 },
  { name: "Asia", lat: 35, lng: 90, height: 5_500_000 },
  { name: "Oceania", lat: -25, lng: 140, height: 3_800_000 },
];

function showOverview(region: RegionOverview): void {
  view.atmosphere.date = zonedDateAt(utcOffsetHoursForLng(region.lng), currentDay, 12, 0);
  view.setCamera({ lat: region.lat, lng: region.lng, height: region.height, heading: 0, pitch: -90, roll: 0 });
  compass.setHeading(0);
}

showOverview(REGION_OVERVIEWS[0]);

// Eases pitch from `fromPitch` to the sun's current elevation over
// `durationMs`, instead of snapping — used right after a `flyTo` arrival,
// where an instant pitch jump reads as a jarring scene cut.
function animatePitchToSun(fromPitch: number, durationMs: number): void {
  const generation = ++orientationGeneration;
  const { heading, pitch: targetPitch } = sunOrientation();
  compass.setHeading(heading); // heading is constant for this animation — only pitch eases
  const startTime = performance.now();

  function step(now: number): void {
    if (generation !== orientationGeneration) return; // superseded — stop clobbering
    const t = Math.min((now - startTime) / durationMs, 1);
    const eased = 1 - (1 - t) ** 3;
    view.setCamera({
      ...cameraTarget,
      heading,
      pitch: fromPitch + (targetPitch - fromPitch) * eased,
      roll: 0,
    });
    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// Flies to a geodetic location and re-aims everything at it: ground height,
// sunset-viewing time, and sun-facing orientation. Shared by the free
// terrain click, sunset-spot marker picks, and the spot list selector — all
// three just need to name a lat/lng.
function flyToLocation(latDeg: number, lngDeg: number): void {
  // Sampled fresh rather than trusting whatever height the caller's own
  // point data carries (e.g. a click's `event.map`, which is a ray/ellipsoid
  // intersection reading ~0 even where real ground sits far higher) — every
  // height computed below is offset from this baseline, so getting it wrong
  // ends up underground over hills and mountains. Falls back to 0 for
  // `undefined` *and* `NaN` (belt-and-braces — areas with no terrain tiles
  // loaded could plausibly return either).
  const sampledHeight = view.sampleTerrainHeight({
    lat: degreeToRadian(latDeg),
    lng: degreeToRadian(lngDeg),
    height: 0,
  });
  const groundHeight = Number.isFinite(sampledHeight) ? (sampledHeight as number) : 0;

  // Retarget sun-aiming/timezone state to the new spot before computing
  // orientation, so sunOrientation() measures the sun's direction from the
  // new spot. `heightMargin` carries over whatever the height slider was
  // last set to, rather than resetting to a default every time.
  cameraTarget.lng = lngDeg;
  cameraTarget.lat = latDeg;
  groundHeightAtTarget = groundHeight;
  cameraTarget.height = groundHeightAtTarget + heightMargin;

  // Jump the clock to this spot's own sunset-viewing time on the currently
  // picked day — a location 1000km away is very unlikely to already be
  // showing a good sunset angle. This becomes the new reference instant for
  // the time slider, which resets to 0 accordingly. The date picker keeps
  // showing the same day, just re-labeled for the new location's UTC offset.
  baseSunsetDate = setDateToSunsetElevation(latDeg, lngDeg, SUNSET_VIEW_ELEVATION_DEG, currentDay);
  timeSlider.reset();
  datePicker.setOffsetHours(utcOffsetHoursForLng(lngDeg));

  // Fly to the spot already turned toward the sun's compass heading and a
  // pitch clamped to a shallow range. In the common near-horizon sunset case
  // the transit pitch already equals the sun's real elevation, so the
  // post-arrival easing below has nothing left to correct; an unusually
  // steep sun (e.g. a high `SUNSET_VIEW_ELEVATION_DEG`, or the time slider
  // nudging well past sunset into midday) instead gets eased the rest of the
  // way after arrival.
  //
  // Once stationary, ease pitch the rest of the way to the sun's actual
  // elevation (`animatePitchToSun`) instead of snapping instantly — an
  // instant `setCamera` jump right as the flight settles read as a jarring
  // scene cut.
  //
  // Wait for the camera's own `moveend` rather than a `setTimeout` matching
  // the fly duration — a fixed delay fired a beat too early, so `flyTo`'s
  // own last animation frame landed after our orientation set and
  // overwrote it.
  const MAX_TRANSIT_PITCH = 20;
  const { heading: sunHeading, pitch: sunPitch } = sunOrientation();
  const transitPitch = Math.max(-MAX_TRANSIT_PITCH, Math.min(MAX_TRANSIT_PITCH, sunPitch));
  // Arc peak well above any terrain on the flight path (Mt. Fuji is ~3776m;
  // the previous 3000m let the arc clip through tall mountains en route).
  const FLIGHT_ARC_MAX_HEIGHT = 8000;
  view.flyTo(
    { lng: lngDeg, lat: latDeg, height: cameraTarget.height, heading: sunHeading, pitch: transitPitch },
    2000,
    FLIGHT_ARC_MAX_HEIGHT,
  );
  view.camera.once("moveend", () => animatePitchToSun(transitPitch, 600));
}

// Layer declaration

const raster = view.addSource({
  type: "raster-tile",
  url: "https://tiles.maps.eox.at/wmts?layer=s2cloudless-2020_3857&style=default" +
    "&tilematrixset=g&Service=WMTS&Request=GetTile" +
    "&Version=1.0.0&Format=image%2Fjpeg" +
    "&TileMatrix={z}&TileCol={x}&TileRow={y}",
  maxZoom: 16,
});

view.addLayer({
  type: "raster",
  source: raster,
  raster: {},
});

// Terrain — Re:Earth Terrain
const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
  maxZoom: 18,
  requestVertexNormals: true,
  requestWaterMask: true,
});

view.addLayer({
  type: "terrain",
  source: terrain,
  terrain: {},
});

// Buildings — Re:Earth Buildings (3D Tiles), for the sunset backlight/shadow effect
const buildings = view.addSource({
  type: "3d-tiles",
  url: "https://buildings.reearth.land/tileset.json",
});

view.addLayer({
  type: "3d-tiles",
  source: buildings,
  model: { castShadow: true, receiveShadow: true },
});

// Sunset-100-Japan spots — small fixed-pixel markers, clamped to the terrain
// surface (so they don't float over hills). `id` is the only feature
// property carried; the pick handler below looks up the rest of each spot
// from `sunsetSpotsById`, so there's nothing per-feature to filter/style on.
const sunsetSpots = await sunsetSpotsPromise;
const sunsetSpotsById = new Map(sunsetSpots.map((spot) => [spot.id, spot]));
const sunsetSpotsSource = view.addSource({
  type: "geojson",
  data: sunsetSpotsToFeatureCollection(sunsetSpots),
});
const sunsetSpotsLayer = view.addLayer({
  type: "vector",
  source: sunsetSpotsSource,
  point: { color: new Color().setStyle("#ffb703"), size: 10, sizeInMeters: false, clampToGround: true },
});

// Attribution

view.attribution?.add([
  {
    attributionHtml: `<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2020)`,
  },
  {
    attribution: "© Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
  {
    attribution: "© OpenStreetMap contributors (ODbL) — Re:Earth Buildings",
    attributionUrl: "https://buildings.reearth.land/",
  },
  {
    attribution: "Japan Sunset 100 (夕陽百選) coordinates — 日本百選と座標値",
    attributionUrl: "https://100sen.cyber-ninja.jp/",
  },
]);

// A single glass panel holds every control below, so they read as one
// cohesive card instead of separately-styled floating boxes.
const controlPanel = createControlPanel();

// Date picker — chooses which calendar day to view; the time-of-day is
// always the sunset-elevation time for that day at the current location
// (nudgeable via the time slider), not something this control sets directly.
const datePicker = createDatePicker({
  panel: controlPanel,
  initial: view.atmosphere.date,
  initialOffsetHours,
  onChange: (day) => {
    currentDay = day;
    baseSunsetDate = setDateToSunsetElevation(
      cameraTarget.lat,
      cameraTarget.lng,
      SUNSET_VIEW_ELEVATION_DEG,
      currentDay,
    );
    timeSlider.reset();
    aimCameraAtSun();
  },
});

// Height slider — margin above the current target's ground level, adjustable
// after having flown there. 0 allows going down to ground level itself.
createHeightSlider({
  panel: controlPanel,
  min: 0,
  max: 500,
  initial: heightMargin,
  onChange: (marginMeters) => {
    heightMargin = marginMeters;
    cameraTarget.height = groundHeightAtTarget + heightMargin;
    aimCameraAtSun();
  },
});

// Time slider — nudges the clock ± 2 hours from the current reference
// instant (the last sunset-elevation time for the current location and
// picked day). The camera deliberately stays put — this is for comparing how
// the light looks at different times from the same fixed viewpoint, not for
// re-aiming.
const timeSlider = createTimeSlider({
  panel: controlPanel,
  minMinutes: -120,
  maxMinutes: 120,
  formatValue: (offsetMinutes) =>
    formatTimeOfDay(
      new Date(baseSunsetDate.getTime() + offsetMinutes * 60_000),
      utcOffsetHoursForLng(cameraTarget.lng),
    ),
  onChange: (offsetMinutes) => {
    view.atmosphere.date = new Date(baseSunsetDate.getTime() + offsetMinutes * 60_000);
  },
});

// Spot list — pick a sunset-100 spot by name instead of finding its marker.
// Kept in sync the other way too: clicking a spot's marker on the map
// reflects that choice back into the list, and clicking anywhere else
// clears it (see the pick/click handlers below).
const spotList = createSpotList({
  panel: controlPanel,
  spots: sunsetSpots,
  onSelect: (spot) => flyToLocation(spot.lat, spot.lng),
});

// Region quick-jump — a bright, top-down overview of a continent/country,
// for when the current `atmosphere.date` leaves wherever you want to browse
// in darkness (one global sun position means roughly half the planet is
// always night). Also resets the time-slider reference to this fresh noon
// and clears the spot list, since a region jump isn't a registered spot.
createRegionSelect({
  panel: controlPanel,
  regions: REGION_OVERVIEWS,
  onSelect: (region) => {
    showOverview(region);
    baseSunsetDate = view.atmosphere.date;
    timeSlider.reset();
    spotList.clear();
  },
});

// Sunset-spot marker picks: `pick` reports the feature (via `layerId` +
// `properties.id`) but not a screen-independent way to stop the generic
// terrain click below from *also* firing for the same interaction — both
// events fire off the same click. Flag it here and let the click handler
// check the flag after yielding to microtasks, which runs after both
// same-tick event dispatches regardless of which one Navara fires first.
let sunsetSpotPickedThisClick = false;

view.on("pick", (info) => {
  if (!info || info.layerId !== sunsetSpotsLayer.id) return;
  const spot = sunsetSpotsById.get(info.properties?.id as string);
  if (!spot) return;
  sunsetSpotPickedThisClick = true;
  spotList.select(spot.id);
  flyToLocation(spot.lat, spot.lng);
});

// Click-to-fly: fly the camera to whatever point on the globe/terrain was clicked.
// (`pick` only reports feature properties, not a position — `click` carries the
// clicked point's ECEF coordinates via `event.map`.)
//
// Navara's `click` fires on every mouseup, including the release at the end of
// a drag-to-rotate gesture — so rotating the camera would otherwise reselect
// whatever ended up under the cursor. Track the mousedown screen position and
// ignore clicks whose mouseup has drifted past a small pixel threshold.
const DRAG_THRESHOLD_PX = 5;
let mouseDownPos: { x: number; y: number } | null = null;

view.on("mousedown", (event) => {
  mouseDownPos = { x: event.clientX, y: event.clientY };
});

view.on("click", (event) => {
  const dragDistance = mouseDownPos
    ? Math.hypot(event.clientX - mouseDownPos.x, event.clientY - mouseDownPos.y)
    : 0;
  if (dragDistance > DRAG_THRESHOLD_PX) return;

  // Yield first so the `pick` handler above (if this click landed on a
  // sunset-spot marker) has had a chance to run and raise its flag,
  // regardless of which of the two same-click events Navara fires first.
  queueMicrotask(() => {
    if (sunsetSpotPickedThisClick) {
      sunsetSpotPickedThisClick = false;
      return;
    }
    spotList.clear();
    const { lng, lat } = vector3ToGeodetic(new Vector3(event.map.x, event.map.y, event.map.z));
    flyToLocation(radianToDegree(lat), radianToDegree(lng));
  });
});

// First-run guidance — the two ways to pick a spot aren't otherwise obvious
// from the UI alone (a marker vs. free click on the overview map). `regions`
// is a list rather than Japan hardcoded into the copy, so pre-registered
// spots for another country later is just another entry here, not a rewrite.
createWelcomeModal({
  title: "Where the Sun Goes",
  intro:
    "Click anywhere in the world to preview the sunset there. Some areas also have recommended spots pre-registered. Click a marker to jump straight to one. If part of the world looks dark, use the Region buttons to jump to a bright overview there.",
  regions: [
    {
      name: "Japan",
      description: "Sunset 100 (夕陽百選) coordinates",
      url: "https://100sen.cyber-ninja.jp/",
    },
  ],
});
