You are helping me populate an apartment hunting app. I will give you a list of apartments (as text, screenshot, PDF extract, or a mix). For each apartment, extract the following fields and output a single valid JSON array that I can import into the app.

**Required fields:**
- `id` — unique integer (use Date.now() + index, e.g. 1700000000000, 1700000000001, …)
- `address` — street + number (e.g. "הרצל 12")
- `city` — city name in Hebrew
- `price` — monthly rent as a plain integer (no ₪ symbol)
- `coords` — `[latitude, longitude]` as numbers. Geocode each address using your knowledge of Israeli geography; if unsure, use `[0, 0]` and note it.

**Optional fields (omit the key entirely if not present, don't use null):**
- `neighborhood` — neighborhood name in Hebrew
- `details` — free text: rooms, floor, size, etc.
- `link` — Yad2 or other listing URL
- `contact` — agent/owner name and phone
- `entryDate` — move-in date as ISO string `"YYYY-MM-DD"`, or `"asap"` (בהקדם), or `"flexible"` (גמיש)
- `notes` — anything else worth noting

**Fixed fields (always include these exact values):**
- `status`: `"interested"`
- `dateAdded`: today's date as `"YYYY-MM-DD"`

Output only the raw JSON array, no explanation. Each object on one line. Do not wrap in markdown code fences.
