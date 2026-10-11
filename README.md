# GymScope — home treadmill & walking pad comparison site (Amazon.com affiliate)

Part of SpecVersus: https://homegym.specversus.com (sister of scooters., robotvacuums. and powerstations.specversus.com).
Static, data-driven site. Every page is generated from the data files.

```
data/products.json   ← treadmill database (generated first by tools/make_products.py; edit directly afterwards)
data/site.json       ← brand, affiliate tag, categories, buying guides
data/matchups.json   ← head-to-head pages (/vs/)
tools/build.py       ← generator: python3 tools/build.py → dist/
src/assets/          ← CSS, JS (comparator, fit finder, compare tray), favicon, _headers
netlify.toml         ← Netlify build settings (Netlify runs the build on every push)
```

## Rules the data follows
- Affiliate links are always `https://www.amazon.com/dp/ASIN?tag=gymscope00-20` (the build fails otherwise).
- **No exact prices are ever shown** (Amazon only allows prices obtained through its API). `price` is stored only to place
  each model in a price band (Under $150 … $800+). Budget filters and sorting use the band.
- Missing specs are `null` and display as "—". Nothing is estimated; listing contradictions go in `data_note`.
- Scores: incline and belt room are formula-based (see /how-we-rate/); the rest are editorial.
- Fit finder (/fit-finder/) runs in the browser: speed and belt length by use and height, weight limit with 15% headroom,
  incline, storage (tags `stores-under` / `stores-upright`), handrail/desk use, price band.
