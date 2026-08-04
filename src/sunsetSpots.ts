// "Sunset 100 Japan" spot data — fetched once from Re:Earth CMS.

const SUNSET_SPOTS_URL = "https://api.cms.reearth.io/api/p/misa-b/sunset-100-japan/sunset-100";

export interface SunsetSpot {
  id: string;
  name: string;
  prefecture: string;
  municipality: string;
  lat: number;
  lng: number;
}

interface SunsetSpotRecord {
  id: string;
  name: string;
  prefecture: string;
  municipality: string;
  location: { coordinates: [number, number]; type: "Point" };
}

export async function fetchSunsetSpots(): Promise<SunsetSpot[]> {
  const response = await fetch(SUNSET_SPOTS_URL);
  const { results } = (await response.json()) as { results: SunsetSpotRecord[] };
  return results.map((record) => ({
    id: record.id,
    name: record.name,
    prefecture: record.prefecture,
    municipality: record.municipality,
    lng: record.location.coordinates[0],
    lat: record.location.coordinates[1],
  }));
}

// Plain-object GeoJSON shape — not typed against the `geojson` package (not
// installed; @navara/three's own types reference it, but `skipLibCheck`
// means that only matters if we import it ourselves). Only `id` is carried
// as a feature property; the marker-pick handler looks up the rest from the
// `SunsetSpot[]` list itself.
export function sunsetSpotsToFeatureCollection(spots: SunsetSpot[]) {
  return {
    type: "FeatureCollection",
    features: spots.map((spot) => ({
      type: "Feature",
      properties: { id: spot.id },
      geometry: { type: "Point", coordinates: [spot.lng, spot.lat] },
    })),
  };
}
