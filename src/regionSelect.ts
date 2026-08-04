import { createControlRow } from "./ui/panel";

// Region quick-jump row — flies to a bright, top-down overview of a
// continent/country. A row of one-shot buttons rather than a <select>,
// since these are actions ("jump here") rather than a persistent selection
// the way the spot list is.

export interface RegionOverview {
  name: string;
  lat: number;
  lng: number;
  height: number;
}

export function createRegionSelect(options: {
  panel: HTMLElement;
  regions: RegionOverview[];
  onSelect: (region: RegionOverview) => void;
}): void {
  const { control } = createControlRow(options.panel, "🌍", "Region");

  const buttons = document.createElement("div");
  buttons.className = "sunset-region-buttons";

  for (const region of options.regions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sunset-region-button";
    button.textContent = region.name;
    button.addEventListener("click", () => options.onSelect(region));
    buttons.appendChild(button);
  }

  control.appendChild(buttons);
}
