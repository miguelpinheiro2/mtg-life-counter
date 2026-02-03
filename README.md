# Commander Life Counter

Simple, vanilla JavaScript life counter for Magic: the Gathering (Commander). Tracks life and poison for 1–6 players and persists state in `localStorage`.

> Lightweight, no build step — just open `index.html`.

---

## Demo

![screenshot](screenshot.png)  <!-- Replace with an actual image or GIF -->

---

## Features

- Supports **1–6 players**
- Adjustable starting life (default **40**)
- +1 / -1 and +5 / -5 life buttons
- Per-player **poison counter**
- Player renaming
- Persistent state in `localStorage`

---

## Usage

- Double-click `index.html` to open in your browser, or serve locally:

```bash
# Simple local server (Python 3)
python -m http.server 8000
# or with npm
npx http-server
```

---

## Development

- Repo is plain HTML/CSS/JS — edit `app.js`, `index.html`, and `styles.css`.
- Open `index.html` in a browser to test changes.

---

## Contributing

Bug reports and PRs welcome. Please follow these steps:

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Open a PR describing your change

---

## Roadmap / Ideas

- Commander damage tracking
- Keyboard shortcuts
- Export/import game state
- Improved UI and accessibility

---

## License

MIT © Miguel Pinheiro
