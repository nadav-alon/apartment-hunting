#!/usr/bin/env node
'use strict';
/*
 * import-yad2.js — extract an apartment from a yad2 listing and copy it to the
 * clipboard as JSON, ready to paste into the app ("ייבוא מ-yad2" → קרא מהלוח).
 *
 * Zero dependencies. Node 18+ (uses global fetch).
 *
 *   node import-yad2.js <yad2-url>          fetch + parse the listing
 *   node import-yad2.js --browser <url>     drive a real browser (Playwright) past anti-bot
 *   node import-yad2.js --html page.html    parse a saved page (anti-bot fallback)
 *   node import-yad2.js --stdin  < page.html
 *
 * yad2 runs aggressive anti-bot (PerimeterX/ShieldSquare); a plain fetch is
 * almost always blocked. Three ways past it, most-to-least automated:
 *   1. --browser : needs `npm i playwright`. Opens a real (headful, persistent-
 *      profile) Chrome that passes the bot check like your normal browsing. Add
 *      --headless to try without a window (less reliable). First run may ask you
 *      to solve a one-time captcha; the profile is remembered afterwards.
 *   2. --html    : save the page in your browser (Ctrl+S → "HTML Only") and pass it.
 *   3. <url>     : plain fetch — works only if the page isn't protected.
 * The parser reads embedded __NEXT_DATA__ and/or JSON-LD either way.
 *
 * Output is best-effort and intentionally tagged "auto generated" in the app so
 * you can complete/fix whatever the parser missed. Nothing here needs your GitHub
 * token — the app writes to the Gist.
 */

const fs = require('fs');
const { spawnSync } = require('child_process');

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
};

// ── args ───────────────────────────────────────────────────────────────────
function parseArgs(argv) {
    const a = { url: null, html: null, stdin: false, browser: false, headless: false };
    for (let i = 0; i < argv.length; i++) {
        const t = argv[i];
        if (t === '--html') a.html = argv[++i];
        else if (t === '--stdin') a.stdin = true;
        else if (t === '--browser') a.browser = true;
        else if (t === '--headless') a.headless = true;
        else if (!t.startsWith('-')) a.url = t;
    }
    return a;
}

function die(msg) { console.error(msg); process.exit(1); }

function usage() {
    console.error(`Usage:
  node import-yad2.js <yad2-url>              plain fetch (usually blocked)
  node import-yad2.js --browser <yad2-url>   real browser via Playwright (npm i playwright)
  node import-yad2.js --html <saved-page.html>
  node import-yad2.js --stdin  < saved-page.html
Flags: --headless (with --browser) try without a visible window`);
    process.exit(1);
}

// Drive a real, persistent-profile browser so yad2's anti-bot sees a human-like
// session. Playwright is a lazy/optional dependency — only needed for this mode.
async function fetchHtmlViaBrowser(url, { headless }) {
    const path = require('path');
    let chromium;
    try { ({ chromium } = require('playwright')); }
    catch { die('This mode needs Playwright. Install it once:\n    npm i playwright && npx playwright install chromium'); }

    const profileDir = path.join(process.cwd(), '.yad2-profile');
    // Prefer the user's real Chrome (more trusted fingerprint); fall back to bundled Chromium.
    let ctx;
    for (const opts of [{ channel: 'chrome' }, {}]) {
        try { ctx = await chromium.launchPersistentContext(profileDir, { headless, viewport: { width: 1280, height: 900 }, ...opts }); break; }
        catch (e) { if (opts.channel) continue; throw e; }
    }
    try {
        const page = ctx.pages()[0] || await ctx.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Wait for a data blob to appear — also gives you time to solve a one-off captcha.
        await page.waitForSelector('script#__NEXT_DATA__, script[type="application/ld+json"]', { timeout: 90000 })
            .catch(() => {});
        await page.waitForTimeout(500);
        return await page.content();
    } finally {
        await ctx.close().catch(() => {});
    }
}

// ── html → embedded JSON blobs ──────────────────────────────────────────────
// Collect every JSON root we can find in the page, tolerant of which framework
// yad2 is on: __NEXT_DATA__ (Pages Router) and/or JSON-LD (schema.org, always
// present for SEO and the most stable source).
function collectRoots(html) {
    const roots = [];
    const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (next) { try { roots.push(JSON.parse(next[1])); } catch {} }
    const ld = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of ld) { try { roots.push(JSON.parse(m[1].trim())); } catch {} }
    return roots;
}

// Last-ditch: pull coordinates / price straight from the raw HTML text when no
// structured blob yielded them (e.g. App-Router RSC streams).
function rawFallback(html) {
    const out = {};
    // \\? tolerates escaped quotes inside JS-string-embedded JSON (App-Router RSC).
    const lat = html.match(/\\?"lat(?:itude)?\\?"\s*:\s*\\?"?(3[0-3]\.\d{3,})/i);
    const lng = html.match(/\\?"l(?:ng|on|ongitude)\\?"\s*:\s*\\?"?(3[4-5]\.\d{3,})/i);
    if (lat && lng) out.coords = [parseFloat(lat[1]), parseFloat(lng[1])];
    const price = html.match(/\\?"price\\?"\s*:\s*\\?"?(\d{3,6})/i);
    if (price) out.price = parseInt(price[1], 10);
    return out;
}

function looksBlocked(html) {
    if (!html || html.length < 1500) return true;
    return /px-captcha|perfdrive|are you (a )?human|shieldsquare|captcha-delivery|distil_r_captcha/i.test(html);
}

async function fetchHtml(url) {
    let res;
    try { res = await fetch(url, { headers: BROWSER_HEADERS, redirect: 'follow' }); }
    catch (e) { return { ok: false, reason: 'network: ' + e.message }; }
    const html = await res.text().catch(() => '');
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, html };
    if (looksBlocked(html)) return { ok: false, reason: 'blocked/anti-bot', html };
    return { ok: true, html };
}

// ── defensive field extraction ──────────────────────────────────────────────
function allObjects(root) {
    const out = [];
    const seen = new Set();
    (function rec(o) {
        if (!o || typeof o !== 'object' || seen.has(o)) return;
        seen.add(o);
        out.push(o);
        for (const k in o) rec(o[k]);
    })(root);
    return out;
}

function resolveText(v) {
    if (v == null) return null;
    if (typeof v === 'string') return v.trim() || null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'object') {
        for (const k of ['text', 'name', 'value', 'title', 'he', 'hebrew', 'label', 'number', 'num']) {
            const r = resolveText(v[k]);
            if (r != null) return r;
        }
    }
    return null;
}

// First resolvable value across the whole tree whose key matches a candidate.
function findByKeys(objs, keys, opts = {}) {
    const set = new Set(keys.map(k => k.toLowerCase()));
    for (const o of objs) {
        for (const k in o) {
            if (!set.has(k.toLowerCase())) continue;
            const val = resolveText(o[k]);
            if (val == null) continue;
            if (opts.number != null) {
                const n = typeof val === 'number' ? val : parseInt(String(val).replace(/[^\d]/g, ''), 10);
                if (!Number.isFinite(n)) continue;
                if (opts.min != null && n < opts.min) continue;
                if (opts.max != null && n > opts.max) continue;
                return n;
            }
            return val;
        }
    }
    return null;
}

const LAT_KEYS = new Set(['lat', 'latitude']);
const LNG_KEYS = new Set(['lng', 'lon', 'long', 'longitude']);

function findCoords(objs) {
    for (const o of objs) {
        let lat = null, lng = null;
        for (const k in o) {
            const lk = k.toLowerCase();
            const n = typeof o[k] === 'number' ? o[k] : (typeof o[k] === 'string' && /^-?\d+\.\d+$/.test(o[k]) ? parseFloat(o[k]) : null);
            if (n == null) continue;
            if (LAT_KEYS.has(lk)) lat = n;
            else if (LNG_KEYS.has(lk)) lng = n;
        }
        // Israel bounding box (roughly)
        if (lat != null && lng != null && lat > 29 && lat < 34 && lng > 34 && lng < 36) return [lat, lng];
    }
    return null;
}

function extractApartment(roots, sourceUrl) {
    const objs = roots.flatMap(allObjects);

    const street = findByKeys(objs, ['street', 'streetname', 'street_name', 'streetaddress']);
    const house  = findByKeys(objs, ['housenumber', 'house_number', 'house', 'streetnumber', 'building']);
    const city   = findByKeys(objs, ['city', 'cityname', 'city_name', 'settlement', 'addresslocality']);
    const hood   = findByKeys(objs, ['neighborhood', 'neighbourhood', 'neighborhoodname', 'area', 'areaname']);
    const price  = findByKeys(objs, ['price'], { number: true, min: 500, max: 500000 });
    const rooms  = findByKeys(objs, ['rooms', 'roomscount', 'rooms_count', 'numberofrooms'], { number: true, min: 1, max: 30 });
    const floor  = findByKeys(objs, ['floor', 'floornumber', 'floor_number'], { number: true, min: -2, max: 120 });
    const size   = findByKeys(objs, ['squaremeter', 'square_meters', 'squaremeters', 'sqm', 'builtuparea', 'area_size', 'floorsize'], { number: true, min: 5, max: 2000 });
    const coords = findCoords(objs);

    const address = [street, house].filter(v => v != null && v !== '').join(' ').trim();

    const details = [
        rooms  != null ? `${rooms} חד'` : null,
        size   != null ? `${size} מ"ר` : null,
        floor  != null ? `קומה ${floor}` : null,
    ].filter(Boolean).join(' · ');

    const apt = {};
    if (address) apt.address = address;
    if (city) apt.city = String(city);
    if (typeof price === 'number') apt.price = price;
    if (coords) apt.coords = coords;
    if (hood) apt.neighborhood = String(hood);
    if (details) apt.details = details;
    if (sourceUrl) apt.link = sourceUrl;
    apt.status = 'interested';
    apt.autoGenerated = true;
    return apt;
}

// ── clipboard ───────────────────────────────────────────────────────────────
function copyToClipboard(text) {
    const cands = process.platform === 'darwin' ? [['pbcopy', []]]
        : process.platform === 'win32' ? [['clip', []]]
        : [['clip.exe', []], ['wl-copy', []], ['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']]];
    for (const [cmd, args] of cands) {
        const r = spawnSync(cmd, args, { input: text });
        if (r.status === 0 && !r.error) return cmd;
    }
    return null;
}

// ── main ────────────────────────────────────────────────────────────────────
(async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.url && !args.html && !args.stdin) usage();

    let html, sourceUrl = args.url || null;
    if (args.html) {
        html = fs.readFileSync(args.html, 'utf8');
    } else if (args.stdin) {
        html = fs.readFileSync(0, 'utf8');
    } else if (args.browser) {
        if (!/^https?:\/\//.test(args.url || '')) die('Provide a full https://www.yad2.co.il/... URL');
        html = await fetchHtmlViaBrowser(args.url, { headless: args.headless });
    } else {
        if (!/^https?:\/\//.test(args.url)) die('Provide a full https://www.yad2.co.il/... URL');
        const res = await fetchHtml(args.url);
        if (!res.ok) {
            console.error(`\n⚠️  Could not fetch the page (${res.reason}) — yad2 blocked it. Options:`);
            console.error('  • Drive a real browser:  node import-yad2.js --browser ' + args.url);
            console.error('  • Or save the page (Ctrl+S → "Webpage, HTML Only") and run:');
            console.error('      node import-yad2.js --html <saved-file.html>\n');
            process.exit(2);
        }
        html = res.html;
    }

    const roots = collectRoots(html);
    if (!roots.length) die('Found no embedded JSON (__NEXT_DATA__ / ld+json) in the page. Is this a saved yad2 listing page?');

    const apt = extractApartment(roots, sourceUrl);
    // Backfill price/coords from raw HTML if the structured parse missed them.
    const fb = rawFallback(html);
    if (apt.price == null && fb.price != null) apt.price = fb.price;
    if (apt.coords == null && fb.coords) apt.coords = fb.coords;
    if (!apt.address || !apt.city || typeof apt.price !== 'number') {
        console.error('⚠️  Extracted only partial data — the app will still accept it if it has address, city & price.');
    }

    const json = JSON.stringify(apt);
    process.stdout.write(json + '\n');

    const via = copyToClipboard(json);
    if (via) console.error(`\n✓ Copied to clipboard (${via}). In the app: ייבוא מ-yad2 → קרא מהלוח.`);
    else     console.error('\n(!) No clipboard tool found — copy the JSON line above manually.');

    const missing = ['address', 'city', 'price', 'coords'].filter(k => apt[k] == null);
    if (missing.length) console.error('   Missing (complete in the app): ' + missing.join(', '));
})();
