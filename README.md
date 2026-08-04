# Where the Sun Goes

A sunset-viewing map built with [Navara](https://navara-docs.netlify.app/) (`@navara/three`). Click anywhere in the world to preview what sunset looks like there, at ground level, at the moment the sun sits at the horizon.

## Features

- **Click anywhere on the globe** to fly the camera to that spot, at a height sampled from the real terrain.
- **Auto-computed sunset time**: for the currently selected day and location, the app finds the moment the sun's elevation crosses the horizon and aims the camera at the sun.
- **Japan's Sunset 100 (夕陽百選)**: 106 curated scenic sunset spots across Japan are shown as map markers and in a searchable list, sourced from [100sen.cyber-ninja.jp](https://100sen.cyber-ninja.jp/).
- **Adjustable controls**: calendar date picker, a height slider (how far above the ground the camera sits), and a time slider (nudge the clock ± 2 hours from the computed sunset time without moving the camera).
- **Compass**: shows the camera's live heading.
- **Initial overview**: opens on a bright, top-down view of the whole Japanese archipelago before zooming into any specific sunset.

## Setup

1. `pnpm i`
2. `pnpm dev`
3. Access `http://localhost:8080/`

## License

Licensed under either of

- Apache License, Version 2.0
  ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license
  ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.
