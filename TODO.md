# TODO — Apartment Map Planned Features

## Better Commute Estimation
Currently: straight-line (haversine) × 1.4 urban road multiplier at 25 km/h average.

Upgrade to real routing via **OSRM** (Open Source Routing Machine) — free, no API key needed.

Endpoint:
```
https://router.project-osrm.org/route/v1/driving/{lon},{lat};{workplace_lon},{workplace_lat}?overview=false
```

Response fields to use: `routes[0].distance` (meters) and `routes[0].duration` (seconds).

Implementation notes:
- Fire one fetch per apartment in parallel (`Promise.all`) on page load
- Store results in a map keyed by apartment id
- Show a spinner in the distance slot while loading
- Fall back to the multiplier estimate if the request fails

## Apartment Management
- Add/remove/edit apartments from the UI without touching the HTML
- Persist the list in `localStorage` so edits survive a page refresh
- Export/import as JSON for backup

## Per-Apartment Status & Notes
- Status toggle: Interested / Visited / Not Interested
- Color-code map pins and list cards by status
- Free-text notes field per listing
- Persist in `localStorage`
