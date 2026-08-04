import { createControlRow } from "./ui/panel";

// Height slider row. Lets the user adjust how far above the current
// target's ground level the camera sits, after having already flown there.
// The value is a margin in meters above ground, not an absolute altitude —
// the caller combines it with the target's own ground height.

export function createHeightSlider(options: {
  panel: HTMLElement;
  min: number;
  max: number;
  initial: number;
  onChange: (heightMeters: number) => void;
}): void {
  const { control } = createControlRow(options.panel, "⛰️", "Height");

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(options.min);
  input.max = String(options.max);
  input.value = String(options.initial);

  const valueLabel = document.createElement("span");
  valueLabel.className = "sunset-row__value";
  valueLabel.textContent = `${options.initial}m`;

  input.addEventListener("input", () => {
    const heightMeters = Number(input.value);
    valueLabel.textContent = `${heightMeters}m`;
    options.onChange(heightMeters);
  });

  control.append(input, valueLabel);
}
