import { ensurePanelStyles } from "./ui/style";

// Compass overlay — shows the camera's current heading. The needle rotates
// by the opposite of the heading, so it always points toward true north
// regardless of which way the camera is currently facing (the standard
// map-compass-button convention).

export interface CompassHandle {
  setHeading(headingDeg: number): void;
}

export function createCompass(): CompassHandle {
  ensurePanelStyles();
  const SIZE = 56;

  const container = document.createElement("div");
  container.className = "sunset-compass";
  container.style.cssText =
    `position:fixed;top:12px;right:12px;z-index:10;width:${SIZE}px;height:${SIZE}px;` +
    "border-radius:50%;user-select:none;";

  const needle = document.createElement("div");
  needle.style.cssText =
    "position:absolute;inset:0;display:flex;justify-content:center;" +
    "padding-top:5px;color:#ff6b4a;font-size:12px;font-weight:700;transform-origin:50% 50%;";
  needle.textContent = "▲N";

  const headingLabel = document.createElement("div");
  headingLabel.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;" +
    "padding-bottom:7px;font-size:11px;color:#fdf6ee;font-variant-numeric:tabular-nums;";

  container.append(needle, headingLabel);
  document.body.appendChild(container);

  const setHeading = (headingDeg: number): void => {
    const normalized = ((headingDeg % 360) + 360) % 360;
    needle.style.transform = `rotate(${-normalized}deg)`;
    headingLabel.textContent = `${Math.round(normalized)}°`;
  };
  setHeading(0);

  return { setHeading };
}
