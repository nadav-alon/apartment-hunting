# CLAUDE.md — Apartment Hunting App

Single-file app: everything lives in `index.html`. No build step, no bundler, no npm.

## Key constants (top of `<script>`)

```js
const WORKPLACE_KEY  = 'apt-workplace-v1';   // localStorage key for central hub
const DATA_KEY       = 'apt-hunting-v1';     // localStorage key for apartments array
const SYNC_KEY       = 'apt-sync-v1';        // localStorage key for { token, gistId }
const ONBOARDING_KEY = 'apt-onboarding-v1';  // localStorage flag (set to '1' on dismiss)
const GIST_FILE      = 'apartments.json';
const GIST_DESC      = 'apartment-hunting-sync';
```

## Gist data format (v2)

```json
{
  "v": 2,
  "apartments": [ /* apartment objects */ ],
  "workplace": { "name": "...", "address": "...", "coords": [lat, lon] },
  "viewingTemplate": {
    "questions": [ { "id": "...", "section": "...", "label": "...", "type": "cost" } ],
    "checklist": [ { "id": "...", "section": "...", "label": "..." } ]
  }
}
```

A question with `"type": "cost"` (e.g. `arnona`, `vaad`) renders as a numeric ₪ input instead of a textarea; its value is stored in `viewing.answers[id]` like any answer, and added on top of the base rent in a live price breakdown (see Viewing mode). Questions without a `type` are plain textareas.

`gistRead()` returns `{ apartments, workplace, viewingTemplate }` with backward compat for v1 (plain array → both null). When `workplace` or `viewingTemplate` is missing in the remote, `gistPushAll()` is called immediately to upgrade the Gist (the local defaults — `DEFAULT_TEMPLATE`, etc. — get written up). Users customize their template by editing the `viewingTemplate` field directly in the Gist.

`loadTemplate()` runs the stored template through `_withDefaults()`, which unions in any `DEFAULT_TEMPLATE` questions/checklist items missing **by id**. This guarantees code-backed defaults (e.g. new `cost` fields) appear even for templates that were synced before those fields existed. Side effect: a default the user deliberately deleted from their Gist will be re-added.

## Apartment object shape

```js
{
  id: 1700000000000,       // Date.now() at creation
  address: "הרצל 12",
  city: "תל אביב",
  price: 6500,             // monthly rent, integer
  coords: [32.068, 34.787],
  status: "interested",    // see STATUSES array
  dateAdded: "2025-01-01",
  updatedAt: 1700000000000,// Date.now() on every mutation — used for merge
  // optional:
  neighborhood, details, link, contact, entryDate, visitDate, notes,
  viewing: {               // viewing-mode data (synced via Gist)
    answers: { [questionId]: "..." },   // global template question answers
    checklist: { [checklistId]: true }, // ticked field-inspection items
    extra: [ { label, answer } ],       // per-apartment ad-hoc questions
    doneAt: 1700000000000               // set when "סיים ביקור" pressed
  }
}
```

`entryDate` special values: `"asap"` (בהקדם) or `"flexible"` (גמיש).

## Status system

```js
const STATUSES = ['interested','favorite','contacted','scheduled','visited','not-interested'];
const BEFORE_SCHEDULED = new Set(['interested','favorite','contacted']);
```

Setting a `visitDate` on an apartment whose status is in `BEFORE_SCHEDULED` auto-advances it to `"scheduled"`.

## Sorting

`currentSort` ∈ `'price' | 'distance' | 'entryDate' | 'visitDate'`; `setSort(field)` swaps the active pill via `SORT_BTN_ID` and re-runs `buildApp`. The comparator lives inline in `buildApp`'s `.sort()`. `visitDate` order: upcoming/today ascending (soonest first) → past descending (most-recent first) → undated last (dates are ISO `YYYY-MM-DD`, so string compare is chronological; `todayStr` is the pivot).

## Leaflet + Tailwind CDN JIT gotcha

Leaflet creates DOM nodes dynamically — Tailwind JIT never scans them. **Never use Tailwind classes inside `L.divIcon` HTML.** Use explicit inline styles for all icon sizes, colors, and layout.

Icon construction:
```js
function makeIcon(bg, faClass, size, pulse) {
    return L.divIcon({
        className: pulse ? 'workplace-pulse' : '',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;...">...`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
        popupAnchor: [0, -size/2-4]
    });
}
```

## Core functions

| Function | Purpose |
|---|---|
| `loadApartments()` | Read from localStorage |
| `saveApartments(data)` | Write localStorage + `gistPushAll()` |
| `loadWorkplace()` | Read workplace from localStorage; returns `null` if unset |
| `saveWorkplace(wp)` | Write workplace to localStorage + `gistPushAll()` |
| `gistPushAll()` | PATCH the Gist with full v2 payload |
| `gistRead()` | GET the Gist; returns `{ apartments, workplace }` or `null` |
| `syncFromGist()` | Pull → merge → write-back if local was newer |
| `mergeApartments(local, remote)` | Per-apartment merge by `updatedAt` (newer wins) |
| `buildApp(fitMap?)` | Re-render sidebar list + map markers from localStorage |
| `updateWorkplaceDisplay()` | Refresh sidebar bar + map marker from `loadWorkplace()` |
| `openWorkplaceModal()` | Show the workplace setup/edit modal |
| `showOnboarding()` | Show onboarding if `ONBOARDING_KEY` not set |
| `loadTemplate()` | Viewing template from localStorage (falls back to `DEFAULT_TEMPLATE`), run through `_withDefaults()` to union in missing default questions/checklist by id |
| `openViewing(id)` | Open full-screen viewing mode for an apartment |
| `persistViewing(immediate?)` | Save viewing draft to localStorage; debounced (2.5s) Gist push unless `immediate` |
| `finishViewing()` | "סיים ביקור" — stamp `doneAt`, auto-advance status to `visited`, push |
| `aptHasViewing(apt)` | True if the apartment has any viewing answers/checks/extras |
| `calcDist(c1, c2)` | Haversine × 1.4 road factor; returns `{ km, mins }` |
| `parseFlexDate(str)` | Parses Hebrew date strings incl. שישי הקרוב/הבא |

## Null-safety: workplace

`loadWorkplace()` returns `null` for new users. All call sites must handle null:
- Map center: `loadWorkplace()?.coords ?? [32.0853, 34.7818]`
- Marker: skipped if null
- Distance rows in cards/popups: omitted if null
- Distance sort: falls back to price sort if null

## Date parsing

`parseFlexDate(str)` handles:
- `DD.MM` / `DD.MM.YY` / `DD.MM.YYYY`
- `היום`, `מחר`
- `שישי הקרוב` — nearest occurrence of that weekday (includes today)
- `שישי הבא` — strictly next occurrence (excludes today)

`HEB_DAYS = { ראשון:0, שני:1, שלישי:2, רביעי:3, חמישי:4, שישי:5, שבת:6 }`

## Viewing mode

Full-screen overlay (`#viewing-mode`, `z-[70]`, opaque) for use while physically visiting an apartment. Not a centered modal — fills the viewport for one-handed mobile use.

- **Entry points:** clipboard icon on each apartment card (emerald when `aptHasViewing` is true), and a "מצב ביקור" button at the top of the notes tab.
- **Three sections:** template questions (label + textarea, grouped by `section`), per-apartment extra questions (editable label + answer + delete), and a tap-to-tick field checklist.
- **Cost fields:** questions with `type: 'cost'` render via `_vCostRow` (a **text** input, not `number`, so pasted `1,250`/`₪` are accepted — stripped to digits on input). After the section that contains them, `buildCostSummary()` renders a live breakdown box (`#viewing-cost-summary`): base rent + each cost = total monthly. `updateCostSummary()` rebuilds it on every keystroke. Base rent comes from `currentViewing.price` (stashed in `openViewing`).
- **Export/share:** the share icon in the viewing header opens `#export-modal` (`openExportConfig`) — a photo picker over this apartment's IndexedDB media (`_exportSelected` holds chosen ids). `generateExport()` builds an inline-styled RTL card (`_buildExportCard`: status-colored header, price breakdown, answered questions, extra Q&A, ticked checklist, selected photo thumbs), rasterizes it with **html2canvas** (CDN), and shares the PNG via `navigator.share({files})` with a download fallback. **Card uses inline styles only** (same Tailwind-JIT gotcha as Leaflet — the node is built dynamically).
- **Persistence:** every input writes localStorage immediately with a fresh `updatedAt` (so a mid-visit `syncFromGist` keeps local via the merge), and schedules a debounced (2.5s) Gist push. "חזרה" pushes immediately; "סיים ביקור" pushes and advances status to `visited`.
- **Template:** global default (`DEFAULT_TEMPLATE`) synced into the Gist as `viewingTemplate`; per-user customization is done by editing that Gist field. Per-apartment extras live on `apt.viewing.extra`.
- **Photos/videos:** captured/picked via `<input accept="image/*,video/*">`, shown as a 3-col thumbnail grid with a tap-to-open lightbox. See Media storage below.

## Media storage (photos & videos)

**Device-local only — never synced to the Gist.** Stored in IndexedDB, not localStorage (binary blobs, no 5MB cap).

- DB `apt-media`, object store `media` (keyPath `id` autoIncrement, index `aptId`). Record: `{ id, aptId, type:'image'|'video', blob, thumb (jpeg dataURL), createdAt, name }`.
- **IndexedDB transaction rule:** each op (`mediaAdd`/`mediaGetByApt`/`mediaGetAll`/`mediaDelete`) opens its own transaction and issues the request *synchronously* after creating the store — never `await` between tx creation and the request, or the tx auto-commits and the request throws.
- **Images** are compressed on import: drawn to a canvas scaled to ≤1280px, exported `image/jpeg` q0.7; a ≤240px q0.6 dataURL thumbnail is stored alongside. `_loadDrawable` uses `createImageBitmap(file, {imageOrientation:'from-image'})` (EXIF-correct) with an `<img>` fallback.
- **Videos** are stored as-is (no in-browser transcode); only a poster-frame thumbnail is grabbed by seeking a `<video>` to ~0.1s and drawing to canvas.
- `_mediaCounts` (aptId → count) drives the camera badge on cards; refreshed by `refreshMediaCounts()` after any media change.
- **Auto-cleanup:** `cleanupMedia()` (run on init) deletes media for apartments that are gone or `not-interested`; `saveNotes`/`deleteApartment` also delete immediately. Note: there is *no* blanket time-based deletion — it was deemed too aggressive (would wipe photos of apartments still under consideration).

## Mobile layout

Breakpoint: `md:` (768px). Below that:
- Sidebar fills full screen; map is hidden behind a tab
- `setMobileView('list'|'map')` toggles visibility and calls `map.invalidateSize()`
- Card tap → opens notes/edit modal (instead of zooming map)

## Single-tab enforcement

`BroadcastChannel('apt-hunter-tab')`: on load posts `'hello'`; existing tabs reply `'alive'`; the new tab shows an amber warning banner.

## Sync conflict resolution

On `syncFromGist()`:
1. Merge arrays by `updatedAt` (newer timestamp wins per `id`)
2. If local had any apartment not matching remote's `{id}:{updatedAt}` fingerprint, write merged result back to Gist
3. Deletions are not tombstoned — an apartment deleted on one device reappears on next sync from a device that still has it

## Files

| File | Purpose |
|---|---|
| `index.html` | Entire app (HTML + CSS + JS) |
| `import-prompt.md` | AI prompt for batch-importing apartments from listings |
| `serve.sh` | `python3 -m http.server` pointed at this directory |
| `TODO.md` | Planned features (OSRM routing, etc.) |
