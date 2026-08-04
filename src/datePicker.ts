import { createControlRow } from "./ui/panel";

// Calendar date picker row. Selects which calendar day to view — the
// time-of-day is handled separately (an auto-computed sunset time, nudged
// via the time slider), not by this control.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Formats a Date as the wall-clock calendar day (Y-M-D) at a given UTC
// offset, for the native <input type="date"> value format.
function formatForInput(date: Date, offsetHours: number): string {
  const shifted = new Date(date.getTime() + offsetHours * 3_600_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

// Parses an <input type="date"> value into the Date for local midnight of
// that day at the given UTC offset.
function parseInput(value: string, offsetHours: number): Date {
  return new Date(Date.parse(`${value}T00:00Z`) - offsetHours * 3_600_000);
}

export interface DatePickerHandle {
  // Re-labels the displayed day for a new location's UTC offset, without
  // changing the underlying day (so moving to a nearby location doesn't
  // visually flip the calendar by a day).
  setOffsetHours(offsetHours: number): void;
  // Displays a new day under a given UTC offset.
  setDay(day: Date, offsetHours: number): void;
}

export function createDatePicker(options: {
  panel: HTMLElement;
  initial: Date;
  initialOffsetHours: number;
  onChange: (day: Date) => void;
}): DatePickerHandle {
  let offsetHours = options.initialOffsetHours;

  const { control } = createControlRow(options.panel, "📅", "Date");

  const input = document.createElement("input");
  input.type = "date";
  input.value = formatForInput(options.initial, offsetHours);
  input.addEventListener("change", () => {
    if (!input.value) return;
    options.onChange(parseInput(input.value, offsetHours));
  });

  control.appendChild(input);

  return {
    setOffsetHours(newOffsetHours: number): void {
      if (newOffsetHours === offsetHours || !input.value) {
        offsetHours = newOffsetHours;
        return;
      }
      const current = parseInput(input.value, offsetHours);
      offsetHours = newOffsetHours;
      input.value = formatForInput(current, offsetHours);
    },
    setDay(day: Date, newOffsetHours: number): void {
      offsetHours = newOffsetHours;
      input.value = formatForInput(day, offsetHours);
    },
  };
}
