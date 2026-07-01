# Apartment Hunting Map

A Hebrew/RTL single-page web app for tracking apartment search progress. Built with Leaflet.js and Tailwind CSS, deployed on GitHub Pages — no backend required.

## Features

- **Interactive map** — apartment pins color-coded by status, workplace marker with pulse animation
- **Sidebar list** — sortable by price, distance, or entry date; filterable by city, status, price range, and more
- **Status tracking** — 6 statuses: מעוניין → מועדף → פניתי → נקבע ביקור → ביקרתי → לא מתאים; auto-advances to "scheduled" when a visit date is set
- **Notes & editing** — tabbed modal per apartment (עריכה / הערות)
- **Viewing mode** — full-screen checklist for use while touring an apartment: pre-set questions to ask, field-inspection items to tick off, ad-hoc per-apartment questions, and photo/video attachments; the question template is customizable per user via the Gist
- **Photos & videos** — attach media per apartment straight from the camera or gallery; images are auto-compressed and everything is stored on-device (IndexedDB), kept out of cloud sync, and auto-cleaned when an apartment is dropped
- **AI import** — paste the `import-prompt.md` into any AI (Claude, ChatGPT, Gemini) with apartment listings; import the returned JSON directly
- **Yad2 import** — `node import-yad2.js <url>` extracts a listing to the clipboard; paste it into the app where it's tagged "auto-generated" for you to complete
- **Share a visit** — export a viewing summary as a colored image (status, price breakdown, answers, checklist, chosen photos) via the phone share sheet
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

## Yad2 import

Extract a single yad2 listing straight into the app (needs Node 18+, no GitHub token). It parses the listing and copies an apartment JSON to your clipboard; in the app open **⋯ → ייבוא מ-yad2 → קרא מהלוח**. The apartment is added tagged **נוצר אוטומטית** (amber badge + filter) so you can fill in whatever the parser missed; duplicates (same link) are skipped.

yad2 runs aggressive anti-bot (PerimeterX/ShieldSquare) that blocks plain fetches **and** automated browsers (Playwright gets stuck on "validating your browser"). The reliable way is the **bookmarklet**, which runs inside a tab you've already opened normally — no anti-bot to beat:

**Desktop / iPhone — bookmarklet:**
1. Open `yad2-bookmarklet.html` in your browser and drag the button to your bookmarks bar (on iOS Safari: save a bookmark, then edit it and paste the code).
2. On any yad2 listing, click the bookmark → the apartment JSON is copied to your clipboard.
3. In the app: **⋯ → ייבוא מ-yad2 → קרא מהלוח**.

**Android — userscript** (stock Chrome can't run bookmarklets):
1. Install **Firefox for Android** + the **Violentmonkey** (or Tampermonkey) add-on.
2. Open `yad2-userscript.user.js` in Firefox → Violentmonkey offers to install it.
3. On any yad2 listing an **"➕ ייבא דירה"** button appears; tap it → the JSON is copied. Then in the app: **⋯ → ייבוא מ-yad2 → קרא מהלוח**. (The same userscript also works with Tampermonkey/Violentmonkey on desktop.)

**CLI alternatives** (`import-yad2.js`, Node 18+) if you prefer the terminal:

```bash
# Saved page — open the listing, Ctrl+S → "Webpage, HTML Only":
node import-yad2.js --html ~/Downloads/saved-listing.html

# Plain fetch (works only for unprotected pages):
node import-yad2.js https://www.yad2.co.il/realestate/item/XXXXXXXX

# Real browser via Playwright — often still blocked by PerimeterX; use the bookmarklet instead:
npm i playwright && npx playwright install chromium
node import-yad2.js --browser https://www.yad2.co.il/realestate/item/XXXXXXXX
```

The bookmarklet and the CLI share the same extractor: they read the page's embedded `__NEXT_DATA__` and/or JSON-LD.

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
