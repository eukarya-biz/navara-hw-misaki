import { ensurePanelStyles } from "./style";

// The single floating glass panel every control (date, height, time, spot
// list) lives inside, so they read as one cohesive card instead of four
// separately-styled boxes stacked on top of each other.
export function createControlPanel(): HTMLElement {
  ensurePanelStyles();
  const panel = document.createElement("div");
  panel.className = "sunset-panel";
  document.body.appendChild(panel);
  return panel;
}

// A themed icon+label+control row inside the panel. `control` is where the
// caller appends its actual input(s) — kept generic since some rows are a
// single input (date, select) and others pair an input with a value label
// (the range sliders).
export function createControlRow(
  panel: HTMLElement,
  icon: string,
  labelText: string,
): { row: HTMLElement; control: HTMLElement } {
  const row = document.createElement("div");
  row.className = "sunset-row";

  const iconEl = document.createElement("span");
  iconEl.className = "sunset-row__icon";
  iconEl.textContent = icon;

  const label = document.createElement("span");
  label.className = "sunset-row__label";
  label.textContent = labelText;

  const control = document.createElement("div");
  control.className = "sunset-row__control";

  row.append(iconEl, label, control);
  panel.appendChild(row);
  return { row, control };
}
