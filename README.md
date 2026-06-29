# Apartment Hunting Map

A Hebrew/RTL single-page web app for tracking apartment search progress. Built with Leaflet.js and Tailwind CSS, deployed on GitHub Pages — no backend required.

## Features

- **Interactive map** — apartment pins color-coded by status, workplace marker with pulse animation
- **Sidebar list** — sortable by price, distance, or entry date; filterable by city, status, price range, and more
- **Status tracking** — 6 statuses: מעוניין → מועדף → פניתי → נקבע ביקור → ביקרתי → לא מתאים; auto-advances to "scheduled" when a visit date is set
- **Notes & editing** — tabbed modal per apartment (עריכה / הערות)
- **Viewing mode** — full-screen checklist for use while touring an apartment: pre-set questions to ask, field-inspection items to tick off, and ad-hoc per-apartment questions; the question template is customizable per user via the Gist
- **AI import** — paste the `import-prompt.md` into any AI (Claude, ChatGPT, Gemini) with apartment listings; import the returned JSON directly
- **GitHub Gist sync** — store data in a private Gist and scan a QR code on another device to share state across desktop and mobile
- **Per-apartment conflict resolution** — each mutation is timestamped; on sync the newer version of each apartment wins
- **Central hub location** — configurable workplace/anchor point; all distances are measured from it
- **Transit stations** — rail and tram stops overlaid on the map (toggleable)
- **Mobile-first layout** — full-screen list tab + map tab, floating action button, collapsible filter drawer

## Getting started

Visit the GitHub Pages URL. On first launch:

1. Complete the 3-step onboarding (how to add apartments, AI import, cloud sync)
2. Set your central hub location (address geocoded via Nominatim)
3. Add apartments manually with **+**, or import a batch via **⋯ → ייבוא**

## Cloud sync setup

1. Create a GitHub personal access token with the `gist` scope at **github.com → Settings → Developer settings → Personal access tokens**
2. Open **⋯ → סנכרון ☁** and paste the token — a private Gist is created automatically
3. Scan the displayed QR code from any other device to link it to the same Gist

Once linked, data syncs automatically on every save and on tab focus.

## AI import

Copy `import-prompt.md`, paste it into any AI chat followed by your apartment listings (text, screenshots, or PDF extracts). The AI returns a JSON array — save it as a `.json` file and load it via **⋯ → ייבוא**.

## Local development

```bash
./serve.sh        # starts python http.server on a free port
```

Or open `index.html` directly in a browser (no build step required).

## Stack

- [Leaflet.js 1.9.4](https://leafletjs.com/) — map
- [Tailwind CSS CDN JIT](https://tailwindcss.com/) — styling
- [Font Awesome 6](https://fontawesome.com/) — icons
- [Rubik](https://fonts.google.com/specimen/Rubik) — font (RTL-friendly)
- [qrcodejs](https://github.com/davidshimjs/qrcodejs) — QR code generation
- [Nominatim](https://nominatim.org/) — address geocoding
- GitHub Gist API — cloud persistence
