import { createControlRow } from "./ui/panel";
import type { SunsetSpot } from "./sunsetSpots";

// Spot list row — a native <select> grouped by prefecture, for choosing a
// sunset spot without having to find its marker on the map.

export interface SpotListHandle {
  // Reflects an externally-driven selection (e.g. clicking the spot's marker
  // on the map) without re-triggering `onSelect`.
  select(id: string): void;
  // Reverts to the placeholder — e.g. when the map is clicked somewhere that
  // isn't one of these spots, so the list stops implying a stale selection.
  clear(): void;
}

export function createSpotList(options: {
  panel: HTMLElement;
  spots: SunsetSpot[];
  onSelect: (spot: SunsetSpot) => void;
}): SpotListHandle {
  const { control } = createControlRow(options.panel, "📍", "Spot");

  const select = document.createElement("select");

  const placeholder = document.createElement("option");
  placeholder.textContent = "Select a spot";
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  const byPrefecture = new Map<string, SunsetSpot[]>();
  for (const spot of options.spots) {
    const group = byPrefecture.get(spot.prefecture) ?? [];
    group.push(spot);
    byPrefecture.set(spot.prefecture, group);
  }

  const spotsById = new Map(options.spots.map((spot) => [spot.id, spot]));

  for (const [prefecture, spots] of byPrefecture) {
    const group = document.createElement("optgroup");
    group.label = prefecture;
    for (const spot of spots) {
      const option = document.createElement("option");
      option.value = spot.id;
      // A dash rather than parentheses — some spot names already carry their
      // own parenthetical (e.g. an alternate name), and stacking another
      // pair around the municipality made entries hard to parse at a glance.
      option.textContent = `${spot.name} — ${spot.municipality}`;
      group.appendChild(option);
    }
    select.appendChild(group);
  }

  select.addEventListener("change", () => {
    const spot = spotsById.get(select.value);
    if (spot) options.onSelect(spot);
  });

  control.appendChild(select);

  return {
    select(id: string): void {
      select.value = id;
    },
    clear(): void {
      select.value = "";
    },
  };
}
