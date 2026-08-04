import { ensurePanelStyles, SUNSET_ACCENT_COLOR } from "./ui/style";

// One-time welcome modal — tells first-time visitors the two ways to pick a
// spot (marker or free click) before they've had to guess from the UI alone.
// `regions` is a list, not a single hardcoded description, so adding
// pre-registered spots for another country later is just another entry, not
// a copy rewrite.

export interface WelcomeModalRegion {
  name: string;
  description: string;
  url: string;
}

export function createWelcomeModal(options: {
  title: string;
  intro: string;
  regions: WelcomeModalRegion[];
}): void {
  ensurePanelStyles();

  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(0,0,0,0.45);";

  const modal = document.createElement("div");
  modal.className = "sunset-panel";
  modal.style.cssText =
    "position:static;width:min(420px, 90vw);padding:26px 24px 20px;text-align:center;";

  const title = document.createElement("h2");
  title.textContent = options.title;
  title.style.cssText = `margin:0 0 12px;font-size:20px;font-weight:700;color:${SUNSET_ACCENT_COLOR};`;

  const intro = document.createElement("p");
  intro.textContent = options.intro;
  intro.style.cssText = "margin:0 0 16px;font-size:13px;line-height:1.6;color:rgba(253,246,238,0.85);";

  modal.append(title, intro);

  if (options.regions.length > 0) {
    const regionsHeading = document.createElement("p");
    regionsHeading.textContent = "Currently registered areas:";
    regionsHeading.style.cssText =
      "margin:0 0 8px;font-size:11px;font-weight:600;text-transform:uppercase;" +
      "letter-spacing:0.06em;color:rgba(253,246,238,0.55);text-align:left;";

    const list = document.createElement("ul");
    list.style.cssText = "margin:0 0 20px;padding:0;list-style:none;text-align:left;";

    for (const region of options.regions) {
      const item = document.createElement("li");
      item.style.cssText = "font-size:13px;line-height:1.5;margin-bottom:4px;";

      // The region name (e.g. "Japan") is just context, not the thing being
      // linked — the link is the actual named data source (e.g. "Sunset
      // 100"), so that's what's clickable, not the country name.
      const link = document.createElement("a");
      link.href = region.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = region.description;
      link.style.cssText = "color:inherit;text-decoration:underline;";

      item.append(`${region.name}: `, link);
      list.appendChild(item);
    }

    modal.append(regionsHeading, list);
  }

  const button = document.createElement("button");
  button.textContent = "Start";
  button.style.cssText =
    `background:${SUNSET_ACCENT_COLOR};color:#1a1208;border:none;border-radius:8px;` +
    "padding:9px 28px;font:inherit;font-weight:700;font-size:13px;cursor:pointer;";
  button.addEventListener("click", () => overlay.remove());

  modal.append(button);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
