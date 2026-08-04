import { createControlRow } from "./ui/panel";

// Time-nudge slider row. Offsets the clock by up to a few hours from
// whatever reference instant is currently in effect (e.g. the auto-computed
// sunset time for the current location), rather than picking an absolute
// time — that's what the date picker is for. The label shows the resulting
// clock time, not the raw offset, since "+30min" means less at a glance
// than "17:45".

export interface TimeSliderHandle {
  // Recenters the slider to 0 — call whenever the reference instant it
  // offsets from changes (new location's sunset time, or a manual edit in
  // the date picker), so the slider doesn't silently apply a stale offset
  // on top of the new reference.
  reset(): void;
}

export function createTimeSlider(options: {
  panel: HTMLElement;
  minMinutes: number;
  maxMinutes: number;
  formatValue: (offsetMinutes: number) => string;
  onChange: (offsetMinutes: number) => void;
}): TimeSliderHandle {
  const { control } = createControlRow(options.panel, "🕐", "Time");

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(options.minMinutes);
  input.max = String(options.maxMinutes);
  input.value = "0";

  const valueLabel = document.createElement("span");
  valueLabel.className = "sunset-row__value";
  valueLabel.textContent = options.formatValue(0);

  input.addEventListener("input", () => {
    const offsetMinutes = Number(input.value);
    valueLabel.textContent = options.formatValue(offsetMinutes);
    options.onChange(offsetMinutes);
  });

  control.append(input, valueLabel);

  return {
    reset(): void {
      input.value = "0";
      valueLabel.textContent = options.formatValue(0);
    },
  };
}
