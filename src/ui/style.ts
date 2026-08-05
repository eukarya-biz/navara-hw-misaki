// Shared visual language for every floating overlay — a warm, glassy dark
// theme (amber accent, matching the sunset-spot markers) so the panel,
// compass, and their inputs read as one cohesive UI instead of separately
// styled boxes. Custom range-slider thumbs specifically require real CSS
// (pseudo-elements aren't reachable via inline `style`), hence a single
// injected <style> tag rather than per-element inline styles.

let injected = false;

const ACCENT = "#ffb703";

export function ensurePanelStyles(): void {
  if (injected) return;
  injected = true;

  const style = document.createElement("style");
  style.textContent = `
    .sunset-panel, .sunset-compass {
      font-family: system-ui, -apple-system, sans-serif;
      color: #fdf6ee;
      background: rgba(24, 18, 14, 0.6);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
    }

    .sunset-panel {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 10;
      width: 260px;
      border-radius: 16px;
      padding: 4px 14px;
    }

    .sunset-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .sunset-row:first-child { border-top: none; }

    .sunset-row__icon {
      font-size: 15px;
      width: 18px;
      flex-shrink: 0;
      text-align: center;
      opacity: 0.85;
    }
    .sunset-row__label {
      font-size: 10.5px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: rgba(253, 246, 238, 0.55);
      width: 46px;
      flex-shrink: 0;
    }
    .sunset-row__control {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sunset-row__value {
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      color: ${ACCENT};
      min-width: 4.4em;
      text-align: right;
      flex-shrink: 0;
    }

    .sunset-panel input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      flex: 1;
      min-width: 0;
      height: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.15);
      outline: none;
    }
    .sunset-panel input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: ${ACCENT};
      box-shadow: 0 0 0 3px rgba(255, 183, 3, 0.25);
      cursor: pointer;
    }
    .sunset-panel input[type="range"]::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border: none;
      border-radius: 50%;
      background: ${ACCENT};
      box-shadow: 0 0 0 3px rgba(255, 183, 3, 0.25);
      cursor: pointer;
    }

    .sunset-panel input[type="date"],
    .sunset-panel select {
      flex: 1;
      min-width: 0;
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      color: #fdf6ee;
      font: inherit;
      font-size: 12px;
      padding: 4px 6px;
      outline: none;
    }
    .sunset-panel input[type="date"]:focus,
    .sunset-panel select:focus {
      border-color: ${ACCENT};
    }
    .sunset-panel input[type="date"]::-webkit-calendar-picker-indicator {
      filter: invert(1);
      opacity: 0.7;
    }
    .sunset-panel select option {
      color: #111;
    }

    .sunset-region-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .sunset-panel .sunset-region-button {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 999px;
      color: #fdf6ee;
      font: inherit;
      font-size: 11px;
      padding: 4px 10px;
      white-space: nowrap;
      cursor: pointer;
    }
    .sunset-panel .sunset-region-button:hover {
      border-color: ${ACCENT};
      color: ${ACCENT};
    }
  `;
  document.head.appendChild(style);
}

export { ACCENT as SUNSET_ACCENT_COLOR };
