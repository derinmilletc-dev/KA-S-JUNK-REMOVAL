#!/usr/bin/env python3
"""Sehir sayfalarini (junk-removal-<sehir>.html) ve sitemap.xml'i uretir.
Kullanim:  python3 tools/build_cities.py            (alan adi yoksa sitemap/canonical atlanir)
           SITE_URL=https://alanadin.com python3 tools/build_cities.py
"""
import html, json, os, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = os.environ.get("SITE_URL", "").rstrip("/")
PHONE_DISPLAY, PHONE_TEL, WA = "+1 (407) 446-2534", "+14074462534", "14074462534"

CITIES = [
    ("Orlando", ["Winter Park", "Lake Nona", "Dr. Phillips", "Baldwin Park", "Windermere"]),
    ("Tampa", ["Brandon", "Westchase", "South Tampa", "Carrollwood", "Riverview"]),
    ("Miami", ["Coral Gables", "Brickell", "Hialeah", "Kendall", "Miami Beach"]),
    ("Jacksonville", ["Riverside", "Mandarin", "Orange Park", "Jacksonville Beach", "San Marco"]),
    ("Fort Lauderdale", ["Plantation", "Sunrise", "Pompano Beach", "Davie", "Oakland Park"]),
    ("St. Petersburg", ["Gulfport", "Pinellas Park", "Largo", "Clearwater", "Seminole"]),
    ("Tallahassee", ["Midtown", "Killearn", "Southwood", "Bradfordville", "Woodville"]),
    ("Kissimmee", ["Celebration", "St. Cloud", "Poinciana", "Harmony", "Buenaventura Lakes"]),
    ("Sarasota", ["Siesta Key", "Lakewood Ranch", "Bradenton", "Venice", "Osprey"]),
    ("Fort Myers", ["Cape Coral", "Lehigh Acres", "Bonita Springs", "Estero", "Sanibel"]),
    ("Gainesville", ["Alachua", "Newberry", "Archer", "High Springs", "Micanopy"]),
    ("Pensacola", ["Gulf Breeze", "Milton", "Perdido Key", "Cantonment", "Navarre"]),
]

def slug(c): return re.sub(r"[^a-z]+", "-", c.lower()).strip("-")
def e(s): return html.escape(s, quote=True)

PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html{{touch-action:manipulation}}</style><script>document.addEventListener("gesturestart",function(e){{e.preventDefault()}},{{passive:false}})</script>
<title>Junk Removal in {city}, FL | Kais Junk Remove</title>
<meta name="description" content="Junk removal in {city}, Florida. Send photos, get a quote on WhatsApp. Furniture, appliances, garage and yard clean-outs. Open 24/7.">
{canonical}<meta property="og:title" content="Junk Removal in {city}, FL | Kais Junk Remove"><meta property="og:description" content="Photos in, quote back. Junk removal in {city} and nearby. Open 24/7."><meta property="og:image" content="{og}">
<script type="application/ld+json">{ld}</script>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{{--ink:#1F2421;--paper:#F6F3EE;--line:#E2DCD0;--muted:#565D58;--orange:#F26B1D;--deep:#C2500F;--tint:#FCE6D8;--green:#1E8E4E}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.6 'DM Sans',system-ui,sans-serif}}
header{{background:var(--ink);color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center}}header a.l{{color:#fff;text-decoration:none;font:700 18px 'Bricolage Grotesque',sans-serif}}header a.l span{{color:var(--orange)}}header a.p{{color:#fff;font-weight:600;font-size:14px;text-decoration:none;border:1px solid #ffffff55;border-radius:10px;padding:7px 12px}}
main{{max-width:680px;margin:0 auto;padding:24px 20px 50px}}
.pill{{display:inline-block;background:var(--tint);color:var(--deep);font-weight:600;font-size:13px;border-radius:99px;padding:4px 12px}}
h1{{font:700 38px/1.05 'Bricolage Grotesque',sans-serif;letter-spacing:-.02em;margin:12px 0}}h2{{font:700 24px 'Bricolage Grotesque',sans-serif;margin:32px 0 10px}}
.lead{{color:var(--muted);font-size:18px}}.cta{{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0}}
.btn{{display:inline-block;background:var(--orange);color:#fff;text-decoration:none;border-radius:12px;padding:14px 20px;font-weight:600}}.btn:hover{{background:var(--deep)}}.btn.g{{background:#fff;color:var(--ink);border:1px solid var(--line)}}
.card{{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px}}
ul.chips{{list-style:none;display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:0}}ul.chips li{{background:#fff;border:1px solid var(--line);border-radius:99px;padding:6px 14px;font-size:14px}}
ol.steps{{padding-left:20px;margin:0}}.card ul{{margin:0;padding-left:20px}}
.bar{{position:fixed;left:0;right:0;bottom:0;z-index:20;display:flex;gap:8px;padding:10px 14px;background:#fffffff2;border-top:1px solid var(--line);backdrop-filter:blur(8px)}}.bar a{{flex:1;text-align:center;text-decoration:none;font-weight:600;border-radius:12px;padding:13px 8px}}.bar .c{{background:var(--ink);color:#fff}}.bar .w{{background:var(--green);color:#fff}}
body{{padding-bottom:76px}}@media(min-width:800px){{.bar{{display:none}}body{{padding-bottom:0}}}}ol.steps li{{margin:6px 0}}
details{{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:8px 0}}summary{{cursor:pointer;font-weight:600}}details p{{margin:8px 0 0;color:var(--muted)}}
.more a{{color:var(--deep);text-decoration:none;margin-right:10px;white-space:nowrap;display:inline-block;padding:11px 4px}}footer{{text-align:center;color:var(--muted);font-size:13px;padding:0 20px 30px}}footer a{{display:inline-block;padding:11px 6px}}
</style></head><body>
<header><a class="l" href="index.html">Kais <span>Junk Remove</span></a><a class="p" href="tel:{tel}">📞 Call</a></header>
<main>
<span class="pill">Serving {city} and nearby</span>
<h1>Junk Removal in {city}, FL</h1>
<p class="lead">Got furniture, appliances or a full clean-out in {city}? Send us photos, get your quote on WhatsApp, and we take it from there. Open 24/7.</p>
<div class="cta"><a class="btn" href="index.html?utm_source=city-page&amp;utm_campaign={slug}#quote">Get a quote</a><a class="btn g" href="https://wa.me/{wa}?text=Hi%20Kais%20Junk%20Remove%2C%20I%27m%20in%20{cityq}%20and%20need%20a%20quote." target="_blank" rel="noopener">WhatsApp us</a></div>

<h2>Areas we serve around {city}</h2>
<ul class="chips"><li>{city}</li>{areas}</ul>

<h2>What we take</h2>
<div class="card"><ul>
<li>Furniture: sofas, mattresses, tables, dressers</li>
<li>Appliances: fridges, washers, dryers, water heaters</li>
<li>Garage, attic and storage clean-outs</li>
<li>Yard waste and bulk items</li>
<li>Move-outs, tenant turnovers and estate clean-outs</li>
</ul></div>

<h2>How it works</h2>
<ol class="steps"><li><b>Send photos</b> of what needs to go, plus the address.</li><li><b>Get a quote</b> on WhatsApp after we look at the job.</li><li><b>We haul it away</b> and leave the space clear.</li></ol>

<h2>Questions</h2>
<details><summary>How do I get a price in {city}?</summary><p>Send photos and the address. We look at the job and reply on WhatsApp with a quote.</p></details>
<details><summary>When can I reach you?</summary><p>We are open 24/7. Message or call anytime on {phone}.</p></details>
<details><summary>What should I photograph?</summary><p>Everything you want gone. One wide shot of the whole pile and a few close-ups of big items works best.</p></details>
<details><summary>Do you work with realtors and property managers?</summary><p>Yes. See our <a href="business.html">partner page for realtors and property managers</a>.</p></details>

<h2>Other Florida cities</h2>
<p class="more">{others}</p>
</main>
<footer>&copy; 2026 Kais Junk Remove. Serving all of Florida.</footer>
<div class="bar"><a class="c" href="tel:{tel}">📞 Call</a><a class="w" href="https://wa.me/{wa}?text=Hi%20Kais%20Junk%20Remove%2C%20I%27m%20in%20{cityq}%20and%20need%20a%20quote." target="_blank" rel="noopener">WhatsApp quote</a></div>
<script src="attr.js"></script>
</body></html>
"""

def build():
    og = f"{SITE}/og.png" if SITE else "og.png"
    sitemap = []
    for city, areas in CITIES:
        s = slug(city)
        ld = {
            "@context": "https://schema.org", "@type": "LocalBusiness", "name": "Kais Junk Remove",
            "telephone": PHONE_TEL.replace("+1", "+1-"), "serviceType": "Junk removal",
            "areaServed": [{"@type": "City", "name": city}] + [{"@type": "City", "name": a} for a in areas],
            "openingHoursSpecification": {"@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], "opens": "00:00", "closes": "23:59"},
        }
        if SITE: ld["url"] = f"{SITE}/junk-removal-{s}.html"
        others = " ".join(f'<a href="junk-removal-{slug(c)}.html">{e(c)}</a>' for c, _ in CITIES if c != city)
        page = PAGE.format(
            city=e(city), cityq=e(city).replace(" ", "%20"), slug=s, tel=PHONE_TEL, phone=PHONE_DISPLAY, wa=WA, og=og,
            canonical=(f'<link rel="canonical" href="{SITE}/junk-removal-{s}.html">\n' if SITE else ""),
            ld=json.dumps(ld, ensure_ascii=False),
            areas="".join(f"<li>{e(a)}</li>" for a in areas), others=others)
        (ROOT / f"junk-removal-{s}.html").write_text(page, encoding="utf-8")
        sitemap.append(f"{SITE}/junk-removal-{s}.html")
    if SITE:
        urls = [f"{SITE}/", f"{SITE}/business.html"] + sitemap
        xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n"
        (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")
        (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nDisallow: /portal/\nDisallow: /track.html\nDisallow: /receipt.html\nSitemap: {SITE}/sitemap.xml\n", encoding="utf-8")
    print(f"{len(CITIES)} sehir sayfasi uretildi" + (" + sitemap.xml" if SITE else " (SITE_URL yok: sitemap atlandi)"))

if __name__ == "__main__":
    build()
