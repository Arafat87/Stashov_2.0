# Stashov Memory Palace: visual PRD

## 1. Goal and visual pillars

Rebuild the existing three.js page at `public/palace.html` + `public/palace.js` (served at `http://localhost:3847/palace.html`, data from `GET /api/vault`) from an unfinished-looking flat-colour mesh (flat `woodMat #6B4A2F`, `stoneMat #9C8A68`, untextured boxes, sprite labels on rounded rectangles) into a finished, art-directed paper-and-wood library that matches `refs/hero.jpg` and `refs/detail.jpg`: a warm circular walnut reading room at dusk with a stone dais and central pillar, parchment wing labels, brass fittings, clothbound book stacks, lantern warmth and a treasury corner. Add the rich motion system in §5.4 (swaying parchment labels, drifting dust motes, pulsing/floating glowing wish cubes, slowly rotating budget ring, flickering lantern/hearth light, shimmering treasury liquid and fun-money beam, subtle idle camera drift), all honouring `prefers-reduced-motion` and never fighting user input. Every existing behaviour in §5.2–§5.3 keeps working exactly; zero console errors.

Pillars:
- Paper and wood, nothing plastic: every visible surface is walnut with visible grain, parchment, cloth, brass, stone or glass; no flat untextured colour survives at hero distance (refs: hero.jpg, detail.jpg).
- Warm lantern dusk: interior key light is amber lantern light (≈2700–3200 K read) against a deep blue-violet dusk seen only through arched windows; overall frame is ≈75 % warm browns/ambers, ≈15 % dusk blue, ≈10 % parchment cream (refs: hero.jpg).
- Small, dense, hand-placed detail: brass corner brackets, hinges, book spines in muted cloth colours, stacked (not shelved-only) books, pinned index cards — detail density follows detail.jpg even where the camera is far (refs: detail.jpg).
- Motion is breathing, not performing: every ambient motion is ≤ a few percent in amplitude, ≥ 2 s in period, and stops the instant the user touches the scene (refs: hero.jpg — dust motes and lantern glow imply the still, not a video).
- The palace is the data: wing count, book-stack height, wish cubes, budget ring, shelf and treasury all stay driven by `/api/vault` exactly as today; art direction never invents or drops a data item (refs: hero.jpg).

## 2. Reference index

| File | Shows | Authoritative for | Source |
|---|---|---|---|
| refs/hero.jpg (1920×1280, 3:2) | Wide interior of the circular library: central pillar on octagonal stone dais, 6 bookcases, 6 hanging parchment labels (LORE, DREAMS, VOWS ×2, ECHO, MEMORY), desks with lanterns and cyan glowing cubes, treasury counter bottom-right, arched dusk windows, domed timber ceiling | Room layout, proportions, palette, lighting, camera, label/bookcase/dais design; wins all conflicts | user |
| refs/detail.jpg (1920×1280, 3:2) | Close-up: carved wooden wing on walnut panel, framed parchment "CATEGORY: CHARTS & DATA" plaque with brass corners, 4 clothbound book stacks (green, blue, rust, tan), pinned torn index card, 2 amber glowing cubes, column with brass collars, blurred lantern top-right | Materials at close range: wood grain, parchment texture/typography, brass, cloth book colours, cube glow; wins all close-range conflicts | user |

Assumptions for parts no reference shows:
- Ceiling above the dome ring and the floor outside the dais follow hero.jpg's timber boarding (same walnut, darker in shadow); no new ornament is invented there.
- Bookcase backs and wing sides not facing the atrium mirror the facing side's panelling (hero.jpg shows only atrium-facing fronts).
- The Shelf of Proof and Treasury keep their current world positions (+X at (14, 0, 0) and −X at (−14, 0, 0), palace.js `buildShelf`/`buildTreasury`) and are re-dressed in the §4 materials; hero.jpg's bottom-right treasury counter is the dressing reference, detail.jpg's stacks are the shelf dressing reference.
- Wing cover art (`/cluster-cards/<slug>.svg`) stays as the wing's framed centrepiece, reframed as the detail.jpg parchment plaque (wood frame + brass corners) instead of today's flat gold frame.
- Label text, counts and persona/Judge-Mode panel content are unchanged data, only re-skinned; wording is out of scope for this PRD.

Measured proportions from hero.jpg (fractions of 1920×1280 frame, read off the image):
- Central pillar: x 0.47–0.55 of frame width (0.08 W wide), rises from dais top (y ≈ 0.72 H) to above frame top; carved capital at y ≈ 0.12–0.25 H.
- Stone dais: octagonal, ≈0.33 W across (x 0.34–0.67), top surface at y ≈ 0.70–0.83 H, 2 visible stone steps.
- Bookcases: each ≈0.13–0.16 W wide, ≈0.34 H tall (top at y ≈ 0.35 H, base at y ≈ 0.69 H), 4 shelves of books per case, brass corner brackets at all 4 outer corners.
- Hanging parchment labels: ≈0.11 W × 0.075 H each, hung at y ≈ 0.24–0.40 H, i.e. just above bookcase tops, slightly rotated (≤ 3°) each.
- Arched windows: ≈0.09 W × 0.44 H each (y ≈ 0.06–0.50 H), 8+ visible around the full circle, mullion cross at 0.55 of window height.
- Desks: ≈0.16 W × 0.10 H footprint each, one per bookcase bay, with 1 lantern + 1 glowing cube + 2 book stacks per desk.
- Treasury counter (bottom-right): occupies x 0.72–1.00, y 0.62–1.00; 3 brass bowls, 2 lidded chests, 2 pitchers on top.

Measured proportions from detail.jpg:
- Carved wing: ≈0.33 W × 0.42 H, mounted upper-left of the panel; individual feather barbs visible, wood tone identical to panel.
- Framed plaque: ≈0.16 W × 0.26 H, wood frame ≈0.012 W thick, brass L-brackets ≈0.03 W at each corner with 1 rivet each.
- Book stacks: 4 stacks of 4–5 books; each book ≈0.20 W × 0.045 H, pages cream on the fore-edge, cloth spine with 2 raised bands; stacks lean ≤ 2°.
- Glowing cubes: 2 cubes, ≈0.09 W and ≈0.11 W, amber, internal bright core ≈40 % of face, sitting directly on the desk with a warm pool of light ≈1.6× cube width beneath.
- Index card: ≈0.24 W × 0.13 H, torn deckled edges, 1 brass pin top-centre, 4 lines of mono type, tilted ≈ −4°.

Sampled colours (5×5 px averages from the .jpg files; lit readings, with the intended material base colour after the arrow — a lit surface reads brighter than its base):
- Walnut, lit (detail.jpg desk/panel): sampled #916751 / #A15D36 → base `#6E4526`, roughness 0.62 (hero.jpg shadow side sampled #28160C → shadowed read must reach ≈ #2A160B).
- Parchment, lit (detail.jpg card/plaque): sampled #EDC792 / #E2C19E → base `#E8D9B0`; hero.jpg labels sampled #D7AD7D (dimmer, further) → same base under less light.
- Brass, lit (detail.jpg collars/corners): sampled #CD863E → base `#B08A3E`, metalness 1.0, roughness 0.32.
- Lantern/cube amber glow (detail.jpg): sampled #F7A34C, core near #FFD9A0 → emissive `#FFB45E`.
- Cloth books (detail.jpg): green sampled #6A5D33 → base `#5C6B3C`; blue sampled #5D6474 (lit) / #1C2632 (shadow) → base `#33506E`; rust/tan bases `#8A4A2E` and `#A97E3F`. These match the existing wing accent set in palace.js (`#667C2E`, `#31517E`, `#96603A`, `#A96F12`, `#3D6B4C`, `#A83C2A`, `#5D6D7A`) — keep that set, only add cloth texture.
- Dusk sky through glass (hero.jpg): sampled #516D95 / #949DB4 near horizon → gradient `#7A86B8` horizon to `#2E3A5C` zenith, with warm band `#D9906A` at horizon line.
- Stone dais (hero.jpg, in shadow): sampled #221A17–#371E12 → base `#7A6A52` (today's `#9C8A68` stone lightened by lantern light), roughness 0.95.
- Wish-cube cyan (hero.jpg desks): bright cyan ≈ #7FE8E0 core → emissive per gate status (existing `GATE_COLORS`: cooling `#D99A2B`, ready `#6FAE7D`, snoozed `#7D9BBD`, bought/skipped `#5A4A36`); detail.jpg amber cubes are the same object under warm light — gate colour wins, warm lantern light tints it.

## 3. Global look

- Style: stylised-realistic PBR in three.js (r160, local `vendor/three.module.js` as today), procedural canvas textures only (no external assets), ACESFilmic tone mapping, exposure 1.05, PCFSoft shadows 2048 px — all as today in palace.js; the upgrade is materials, geometry detail and light, not the pipeline.
- Palette (material bases): walnut `#6E4526` (grain streaks `#59371E` / `#845632`), parchment `#E8D9B0` (edge stain `#C9A86A`, ink `#2B2115`), brass `#B08A3E` (metalness 1.0, roughness 0.32), stone `#7A6A52` (dark stone `#57462F`), desk cloth runner sage `#7A8464`, book cloth set above, glow amber `#FFB45E`, existing gold accent `#D8A94E` retained for ring/label accents.
- Wood grain (applies to every walnut surface): procedural canvas texture, 512×512 per surface class, grain lines along the surface's long axis, 18–26 darker streaks per tile with 1–3 px width jitter, plus 2–4 % per-pixel value noise; repeat set so grain pitch reads ≈ 0.35 world units per full light-dark cycle at hero distance; roughnessMap = same canvas inverted at 0.55–0.75 roughness so grain catches lantern light unevenly. No surface may show a repeating tile at hero framing (rotate/offset repeats per part from a seeded index).
- Parchment: procedural canvas 512×256, base `#E8D9B0`, 6 % fibre noise, darker deckled edge (8–14 px irregular border at `#C9A86A`, alpha-torn on hanging labels), faint show-through text lines at 4 % opacity on card backs.
- Lighting (replace today's single hemi + sun + 1 point with the same count of shadow-casters, more non-shadow fill):
  - Hemisphere: sky `#FFE6BB`, ground `#2A1A0C`, 0.55 (down from 0.75 — lanterns take over).
  - Key directional ("last dusk through windows"): `#FFD9B0`, 1.1, from (−30, 38, −18) so window-side rims read; castShadow, 2048 map, camera box ±48, bias −0.0004 (as today).
  - Hearth point at (0, 9, 0): `#FFC37E`, intensity 90, distance 46, decay 2 (as today) — this is the flickering source in §5.4.
  - Lantern points: 1 per wing bay + shelf + treasury, `#FFB45E`, intensity 14, distance 13, decay 2, no shadows; count = wings present (≤ 14) + 2, so ≤ 16 point lights + hearth.
  - Emissive-only glows (no light): window dusk gradient planes, cube cores, budget ring, treasury liquid.
  - Scene background/fog: keep `#1A120A`, fog 48–150, but the room enclosure (§4.1) means background is rarely visible; windows show the dusk gradient, not fog colour.
- Camera: PerspectiveCamera fov 55, near 0.1, far 600; home theta 0.95, phi 1.42, radius 29 (portrait aspect < 0.8: phi 1.38, radius 30), target (0, 3, 0) — an interior eye-level home, changed from the original outside radius-54 dollhouse because refs/hero.jpg wins conflicts (§2): at radius 54 the dais read ≈0.17 W top-down and the dome ribs raked the frame. The camera is additionally clamped inside a 29.5-unit sphere around (0, 3, 0) in `applyCamera`, so zoom/orbit can never leave the room. Home framing reads like hero.jpg: dais centre-frame at ≈0.33 W, full-height pillar rising through top of frame, bookcase bays and labels spread across the horizon, treasury/shelf as foreground corners.
- Background / ground: circular room interior (§4.1) replaces the open void: plank floor radius 30 world units inside walls at radius 30, ground disc radius 75 and star field retained outside/above for any gap; floor = walnut planks (grain along radius), receiveShadow everywhere.
- Render: devicePixelRatio min(dpr, 2) as today; target 60 fps on a mid laptop at 1440×900 (§6); no post-processing pass (keep the single-pass renderer; glow is emissive + additive sprites, as today's dust already is).

## 4. Objects

World scale: 1 unit = 1 unit as today (dais radius 6.5, wings at radius 27, shelf +14 X, treasury −14 X). Base unit for room proportions: dais diameter D = 13 units = 1.0 D.

### 4.1 Room enclosure — walls, arched windows, dome (refs: hero.jpg)

Shape: circular room radius 30 (2.3 D), wall height 11, then timber dome ring rising to a central oculus hub at height 19 above the pillar capital; walls are single-sided inward (`side: BackSide` cylinder + ring segments) and window glass is transparent. Home (radius 29) and flights (radius 19) are both inside the room, reading as hero.jpg's interior; the BackSide treatment plus the `applyCamera` interior clamp means no reachable view shows the room from outside.

Parts:
| Part | Count | Size | Position | Material | Notes |
|---|---|---|---|---|---|
| wall cylinder | 1 | r 30, h 11, open-ended, 48 seg | y 0–11, centre origin | walnut panels (§3 grain), BackSide | panel seams every 3.75 units (16 panels), vertical stiles 0.18 wide |
| window arch | 12 | 2.6 wide × 7.5 high, arch top r 1.3 | every 30°, centred y 6.2, in wall plane | frame walnut; glass dusk gradient (§2), transparent 0.92 | mullion cross at 0.55 height; brass hinge dots 0.06 Ø ×4 per window; skip arches where shelf/treasury proxies sit if occluded |
| dome ring | 1 | r 30 → 4, y 11 → 19, 24 ribs | above walls | walnut boarding, darker (× 0.8) | 24 radial ribs 0.22 wide; oculus hub cylinder r 4 at y 19 |
| floor | 1 | r 30 disc (replaces visible part of ground) | y 0.01 | walnut planks, plank width 0.9, grain radial | receiveShadow; plank seams #3A2412 at 1 px texture line |
| skirting + cornice | 2 rings | h 0.5 / 0.6 | y 0.25 / y 10.7 | walnut × 0.85, brass pin line 0.04 | cornice carries the hanging-lantern hooks |

### 4.2 Atrium — dais, pillar, budget ring (refs: hero.jpg)

Keeps today's positions (dais y 0–1, pillar centre y 5.5 h 9, ring y 6.4 r 2.7); re-dressed.

Parts:
| Part | Count | Size | Position | Material | Notes |
|---|---|---|---|---|---|
| dais | 1 | 8-sided cylinder r 6.5 top / 7.2 base, h 1.0, + 1 step ring r 7.8 h 0.35 | y 0–1 (+ step y 0–0.35) | stone `#7A6A52`, per-face value jitter ±6 % | stone block seams: texture lines every ≈1.6 units, bevelled top edge (torus segment or chamfer ring) — hero.jpg shows 2 worn steps |
| pillar | 1 | octagonal, r 1.1 top / 1.5 base, h 9, plus upper shaft r 0.92–1.08 from the cap to the oculus hub | y 1–10, shaft y 10.5–18.8 | walnut (replaces dark stone) with carved capital: 3 stacked collars r 1.3–1.7 at y 8.6–10.2 + brass bands 0.09 h at y 2.2, 5.5, 8.8 | hero.jpg's pillar runs dais-to-dome, so the column continues past the gold cap disc (r 1.7 at y 10.2) as a slimmer shaft to the hub; turned, bulged base (r swells to 1.8 at y 1–2.2) |
| budget ring | 1 | torus r 2.7, tube 0.16 (as today) | y 6.4, flat (rot.x = π/2) | emissive healthy `#6FAE7D` / over `#D96A4A`, intensity 1.1 base | rotates slowly (§5.4); add 12 small brass tick beads Ø 0.14 on the ring so rotation is visible |
| atrium label | 1 | parchment 6.6 × 1.65 world (smaller than wing labels so it clears the top bar from the interior home) | y 13.4, offset x +3.6 beside the shaft | parchment (§4.6) | sways (§5.4) |

### 4.3 Wings — bookcase bays (refs: hero.jpg, detail.jpg)

One per category (≤ 14, as today), at radius 27, `lookAt(0,0,0)`, replacing today's slab + flat wall + gold-framed cover with a hero.jpg bookcase. Local axes: +Z toward atrium.

Parts:
| Part | Count | Size | Position (local) | Material | Notes |
|---|---|---|---|---|---|
| slab | 1 | 9 × 0.6 × 11 | y 0.3 | stone (as today) | receiveShadow |
| bookcase carcass | 1 | 8.6 wide × 6.8 high × 1.1 deep | centre y 3.7, z −4.6 | walnut | 2 side posts 0.5 wide, top cornice 0.35 h with 0.12 overhang, plinth 0.4 h |
| shelves | 4 boards | 7.6 × 0.14 × 0.95 | y 1.35 / 2.95 / 4.55 / 6.15, z −4.6 | walnut | hero.jpg: 4 book rows per case |
| books (shelved) | 44–60 per wing | each 0.28–0.42 wide × 1.05–1.35 high × 0.7 deep | on the 4 shelves, z −4.6 | cloth set (§2), pages `#E8D9B0` on top edge | instanced or merged per wing; lean: every 9th–13th book rotated z 4–7° against a brass bookend; 1–2 horizontal mini-stacks per wing on a shelf; count per shelf ∝ wing's share of total saves (±20 %) |
| brass brackets | 8 per wing | L 0.34 × 0.34, 0.05 thick | 4 outer corners + 4 shelf-end caps | brass | detail.jpg corner brackets with 1 rivet Ø 0.05 each |
| framed plaque (cover) | 1 | 3.4 × 2.5 incl. frame 0.22 | centre y 4.1, z −3.98 (front face) | walnut frame, brass corners, parchment mat, existing `/cluster-cards/<slug>.svg` art inset 2.9 × 2.0 | replaces today's 5.2×3.9 plane + gold frame; on SVG error keep today's fallback initial-letter texture on parchment |
| wing carving | 1 | 1.5 × 1.9, relief 0.09 | left post face, y 4.6, z −3.95 | walnut × 1.05 (slightly lighter) | detail.jpg carved feather wing; geometry: flattened extruded feather silhouette (ShapeGeometry/ExtrudeGeometry 0.09) — 1 per wing, same carving all wings |
| columns + collars | 2 + 4 | column r 0.34/0.44 h 6.5; collar torus r 0.4 tube 0.07 | x ±3.9, z −4.4 (as today) | walnut columns (was stone), brass collars (was gold) at y 6.6 / 1.1 | detail.jpg: turned column with 2 brass bands |
| lintel | 1 | 8.6 × 0.5 × 0.9 | y 7.35, z −4.6 | walnut with brass name plate 1.6 × 0.3 centre | was solid gold — brass only the plate |
| desk | 1 | 3.4 × 0.18 top at y 1.55, 4 legs | z +0.6, facing atrium | walnut, sage runner 2.6 × 0.9 on top | hero.jpg: 1 desk per bay |
| lantern | 1 | body 0.34 Ø × 0.62 h, glass core emissive | desk left, y ≈ 1.95 | brass cage, glass `#FFD9A0` emissive 2.2 | point light (§3) at same spot; flickers (§5.4) |
| book stacks (desk) | 2 | 3–5 books each, book 0.85 × 0.16 × 0.6 (as today) | desk right + floor beside desk | cloth set | keeps today's data-scaled stack logic (`stacks = clamp(round(count/45),1,5)`) for the floor stack; desk stacks fixed 2 |
| wish cubes | ≤ 6 | 0.8 cube on plinth 1 × 0.35 × 1 | row z +2.6, y cube centre 1.35 (as today) | dark glass `#1C232C`, emissive = gate colour, core sprite additive | float + pulse (§5.4); plinth stone → walnut with brass trim |
| parchment label | 1 | sprite 9 × 2.25 | y 9.2 (as today) | §4.6 | sways (§5.4); text = shortened category + "N saves" (as today) |

Pick proxy unchanged: invisible box 8.5 × 12 × 10 at y 5 (palace.js `addProxy` in `buildWing`), plus label sprite pickable.

### 4.4 Shelf of Proof (refs: detail.jpg, hero.jpg)

At (14, 0, 0) facing origin (as today). Re-dress: 2 posts → turned walnut columns r 0.35 with brass collars at y 1.0 / 4.6; 3 planks 7.2 × 0.25 × 1.4 at y 1.1 / 2.8 / 4.5 (as today) in walnut; owned items (≤ 12, 4 per row as today) shown as detail.jpg clothbound book stacks + small brass-framed parchment index card (0.9 × 0.55, tilted −4°, pinned) in front of each item instead of today's emissive cubes — item's category colour becomes the book cloth colour (existing `visualFor`); if owned > 12 the panel still lists the rest (unchanged). Label "Shelf of Proof · N owned" at y 8.2 as today; proxy 9 × 10 × 8 unchanged. One lantern on the top plank (same §4.3 lantern, with point light).

### 4.5 Treasury (refs: hero.jpg)

At (−14, 0, 0) facing origin (as today). Buckets (≤ 6) become hero.jpg's counter dressing: curved walnut counter (arc segment r 5.2, 100°, h 1.05, top y 1.05) with brass bowls Ø 1.1–1.5 (lathe or sphere squashed 0.45, brass, roughness 0.28) — 1 bowl per bucket at today's basin positions (arc r 4.2 × 2.4 ellipse, y base 0); each bowl holds "liquid": disc r = 0.35 + share × 1.0 (today's formula, share = resolved_yearly / yearly_income clamped 0–1) at y 0.58 → raised to bowl rim y 0.92, emissive gold `#D8A94E` or fun-money green `#6FAE7D` (as today), shimmering (§5.4). Fun-money bucket keeps its beam: cylinder r 0.3→0.5, h 5, opacity 0.22 green additive (as today) at y 3, plus a soft additive sprite cap. Add 2 lidded chests (1.1 × 0.6 × 0.65, walnut, brass bands) and 1 brass pitcher (lathe profile h 0.8) as static dressing on the counter (hero.jpg bottom-right). Empty-buckets plinth (r 3.4/3.9 h 0.7 octagonal stone, as today) remains when no buckets. Label at y 8.2 and proxy 12 × 10 × 8 unchanged.

### 4.6 Parchment labels (refs: hero.jpg, detail.jpg)

Replace today's rounded-rect sprite canvas (512×128, `roundRect`, accent border) with parchment: canvas 512×160, torn deckled edge path (irregular 6–10 px jitter, seeded per label so each label differs), parchment texture (§3), no border box; text ink `#2B2115`, Departure Mono (already loaded at boot), line 1 = name at 44 px semibold, line 2 = count in accent at 30 px; 2 brass pin dots Ø 10 px at top corners for hanging labels. Sprite scale stays 9 × 2.25 world (canvas aspect changes, scale does not, so picking geometry is unchanged). Hanging labels (wings, shelf, treasury, atrium) additionally get 2 thin cords (Line or 0.02-wide planes, `#3A2A18`) from label top corners rising 1.2 units to a brass ring Ø 0.16 — hero.jpg labels hang in air before windows; cords sell the sway pivot (§5.4). Sprite pivot stays centre; sway rotates around the cord top via a parent group offset (implementation note, §6).

### 4.7 Dust, stars, desk props (refs: hero.jpg)

Dust motes: keep today's system (260 points, additive soft dot, gold `#D8A94E`, size 0.35, opacity 0.5, volume 90 × 17 × 90) and add the §5.4 drift. Stars: 420 points as today, visible only through windows/above dome — keep. Desk props per wing desk: open parchment sheet (1.1 × 0.75 plane, parchment, 5 fake text lines) + brass ink pot (cylinder Ø 0.16 h 0.22) on desks where `index % 2 === 0`; window-seat cushions (box 1.8 × 0.22 × 0.7, cloth `#3D4A5C` / sage alternating) under 4 of the windows at wall base (hero.jpg shows cushioned window seats).

## 5. Games only

This is an explorable data palace, not a scored game; this section covers its loop, controls, states, HUD/panel, feedback, the mandated motion system and audio.

### 5.1 Core loop
Arrive at the Atrium → read the vault at a glance (ring health, labels, cube colours) → click/tap a wing, the Shelf of Proof or the Treasury to fly there → read the panel (wishes, owned items, buckets) → Esc or "Back to overview" to return → optionally run the Play-demo guided tour. Loop repeats as `/api/vault` data changes the scene (counts, stacks, cubes, ring colour).

### 5.2 Controls (unchanged, exact)
| Input | Action | Limits / notes |
|---|---|---|
| Drag (1 pointer) | Orbit: theta −= dx × 0.0052; phi −= dy × 0.004 | phi clamped 0.35–1.45; cancels any camera tween on pointerdown |
| Scroll wheel | Zoom: radius × (1 + deltaY × 0.001) | radius clamped 16–40 (was 22–95 in the open-void layout; the interior room caps useful range) plus the `applyCamera` interior sphere clamp; `preventDefault`, non-passive |
| Pinch (2 pointers) | Zoom: radius = radiusStart × pinchStart / dist | same 16–40 clamp; pinch counts as moved (no pick on release) |
| Click / tap (moved < 6 px) | Pick (see §5.3) and fly there | flight 1.1 s smootherstep; wing dist 19 phi 0.95, shelf/treasury dist 19 (approach swung 0.55 rad off-axis so the pillar clears the sightline), atrium dist 30 |
| Esc | Cancel tour, reset to home, show Atrium panel | home per viewport (radius 29, or 30 if aspect < 0.8) |
| "Back to overview" button (panel) | Same as Esc (reset + Atrium) | sticky button at panel bottom |
| "▶ Play demo" button (topbar) | Start tour; becomes "■ Stop demo"; any pointerdown on canvas also cancels | tour steps and timing as today (4.2 s atrium, 4.6 s × 3 stops, 5.2 s close) |

### 5.3 Picking, flights, label fade (unchanged semantics)
- Pick targets are only the invisible hit-proxies plus label sprites (`focusables`); ranking: visible label sprite (rank 0) beats shelf/treasury/atrium proxy (rank 1) beats wing proxy (rank 2), stable within rank (today's `pickHit`).
- If > 1 label sprite is hit, the winner is the sprite whose projected centre is nearest the pointer in NDC (today's nearest-label-centre rule) — swaying labels (§5.4) must not change this: picking uses the sprite's current world position projected the same way, so what you see is what you pick.
- Wing flight target = wing's world bounding-box centre (`wingCenterOf`), approach from the atrium side (theta = atan2(−x, −z) of the wing root), radius 19, phi 0.95, so the plaque/bookcase front faces the camera on arrival.
- Proximity label fade: every frame, each label's opacity = min(baseOpacity, clamp((dist − 9) / 7, 0, 1)) where dist is camera-to-label world distance (`updateLabelOpacity`) — the fade reaches zero at 9 units so a pass-by never balloons into a translucent sheet. The focused label's baseOpacity is 0 (hidden while focused — the panel already names the place, and a 0.12 ghost over its own shelves read as a rendering bug in fresh-player QA), all others 1 (`setFocusedLabel` on pick, cleared on Atrium/Esc/Back). Two eased hard hides (no popping): a label whose centre projects under the top bar (y < 64 px) or the side panel leaves completely, and while a place is focused its neighbours within 16 units leave too, so an arrived view is never crossed by a half-clipped parchment strip.
- Flights: 1.1 s, smootherstep `t³(t(6t−15)+10)`, theta unwrapped to the shortest arc; under reduced motion flights and resets are instant cuts (today's `REDUCED_MOTION` branch in `flyTo`/`resetView`).

### 5.4 Motion system (the rich-motion requirement)
All motions run on the existing `requestAnimationFrame` loop with `dt` clamped to 0.1 s and `clock.elapsedTime`; phases are seeded per object (hash of index/name) so neighbours never move in sync. Global rules after the table.

| # | Motion | Applies to | Amplitude | Period / rate | Easing / waveform | Reduced-motion state |
|---|---|---|---|---|---|---|
| M1 | Parchment sway | every hanging label (§4.6) + its cords | rotation.z ±1.4°, rotation.x ±0.7°, position bob ±0.05 u | 3.8–5.2 s per label (seeded) | sum of 2 sines (f, 2.7f at 0.35×) | static at 0°, cords vertical |
| M2 | Dust drift | 260 dust points | rise 0.28 u/s (as today) + lateral sin drift ±0.6 u, phase per point | lateral 7–13 s per point; wrap y 0.4 → 17 | sine | points frozen mid-air (still rendered, opacity 0.5) |
| M3 | Wish-cube float + pulse | ≤ 6 cubes/wing + shelf glow items | float y ±0.14 u around 1.35; emissiveIntensity 0.85 ± 0.35; scale 1 ± 0.03 | float 2.6–3.4 s; pulse 2.2 s, phase seeded | sine | cubes rest at y 1.35, emissive steady 0.85 |
| M4 | Budget-ring rotation | atrium ring + its 12 tick beads | continuous rotation.z (local) 360° / 90 s = 4°/s; emissive pulse 1.1 ± 0.45 at 0.5 Hz (today's sin 2t) | 90 s/rev; pulse 2 s | linear rotation; sine pulse | ring static, emissive steady 1.1 |
| M5 | Lantern/hearth flicker | hearth point + each lantern point + lantern glass emissive | intensity ±9 % (lanterns), ±13 % (hearth); glass emissive 2.2 ± 0.3 | noise: 2 sine octaves 7 Hz + 13 Hz at 0.3× + slow 0.4 Hz swell ±4 % | summed sines, seeded per lantern, never identical between neighbours | steady intensity, no flicker |
| M6 | Treasury shimmer | bucket liquid discs + fun-money beam | liquid: emissive 0.9 ± 0.25, surface plane y ±0.015 u, radial scale 1 ± 0.012; beam opacity 0.22 ± 0.07, beam rotation.y 360°/40 s | liquid 3.1 s; beam pulse 2.4 s | sine | liquid steady, beam static opacity 0.22 |
| M7 | Idle camera drift | camera orbit, only when idle | theta ±0.018 rad (≈1.0°), phi ±0.006 rad, around the current orbit state | 26 s full cycle | sine in/out (smooth, zero velocity at extremes) | no drift ever |
| M8 | Cube sparkle sprites | wish cubes (hero.jpg desks show sparkle motes over cubes) | 3 additive sprites per active cube, orbit r 0.5–0.8, opacity blink 0–0.7 | orbit 5–8 s; blink 1.7 s | sine blink | hidden |

Global motion rules:
- G1 Reduced motion: `REDUCED_MOTION` (existing `matchMedia('(prefers-reduced-motion: reduce)')` const) freezes M1–M8 to the states in the table's last column and keeps today's instant-cut flights; the CSS block in palace.html (veil/panel animation off) is unchanged. No motion may be re-enabled by data loads or resize.
- G2 Never fight the user: M7 starts only after 4.0 s with no pointerdown/wheel/keydown/pick/tour activity and no active tween; any of those events cancels drift within 1 frame and resets the idle timer; drift offsets are applied as a temporary additive offset on top of `orbit` when composing the camera (never written into `orbit.theta/phi`), so the first user drag starts exactly from the pre-drift orbit state with no snap-back jump larger than the 0.018 rad offset, which is removed over 0.3 s on cancel.
- G3 Panel/veil CSS motion unchanged (panelIn 0.35 s, veilPulse 1.6 s); no new CSS animation except respecting the existing reduced-motion media query.
- G4 Motion cost: M1–M8 are O(objects) sin evaluations per frame (≤ ≈ 400); no per-frame allocations in the loop (reuse temp vectors as today's `_labelPos` pattern), no texture regeneration per frame.

### 5.5 States
Veil ("Raising the palace…") → loading `/api/vault` → Overview (Atrium panel) ⇄ Focused (wing / shelf / treasury panel, focused label faded) → Demo tour (narration panels, cancellable) → back to Overview. Error states unchanged: locked vault (401 → "Locked vault" panel + errbox), fetch failure (errbox), empty palace (no categories → "Empty palace" panel), no buckets (stone plinth), no income ("no income set" label). Judge-Mode persona data: the panel and tour keep reading the same fields (`category_counts`, `wishlist` with gate statuses, `personal_context.owned_inventory`, `treasury.buckets`, `budget`, `gate.counts`, `decision_journal`, `cluster_meta`, `total_bookmarks`) — persona switching upstream changes only data, never layout, motion or picking.

### 5.6 HUD / panel (unchanged layout, re-skinned only)
Topbar (brand, ← Vault link, hint text, Play demo) and `#panel` keep today's DOM, positions and CSS (parchment panel `#F7EFDB`, ink `#2B2115`, gold `#9A7422`, Departure Mono); phone portrait (≤ 640 px): topbar hint swaps to the short hint, panel docks bottom at max-height 38 vh (today's media query) — the 3D home radius is already 76 in portrait so ≥ 4 labels + dais remain in frame. Panel is `aria-live="polite"` as today. No new HUD elements.

### 5.7 Feedback and juice
Pick hover: none today and none added on desktop (cursor stays default) — the juice is in arrival: the focused place's label hides (the panel names it), panel animates in (0.35 s), flight eases with smootherstep. Wish-cube status reads at a glance by emissive colour (M3 pulse draws the eye without moving the pick proxy). Budget health reads by ring colour + pulse (M4). No screen shake, no camera FOV kicks, no sound.

### 5.8 Audio
None. No audio files, no WebAudio; the tour "narration" is panel text only (including the optional live `/api/vault-audit` Wonder line, fetched as today).

## 6. Technical constraints

- Tool/engine: three.js r160 from the existing local `public/vendor/three.module.js`; plain ES module in `public/palace.js`; no build step, no new dependencies, no external textures/fonts (Departure Mono is already self-hosted; procedural canvas textures for wood/parchment/stone/cloth).
- Files changed: `public/palace.js` (scene build + loop) and, only if needed, the `<style>` block of `public/palace.html`; `palace.html` DOM ids (`scene`, `veil`, `topbar`, `demoBtn`, `panel`, `errbox`) and the module script tag are unchanged so all listeners keep binding. This PRD lives at `visual-plan/PRD.md`; references at `visual-plan/refs/hero.jpg` and `visual-plan/refs/detail.jpg`.
- Data: `GET /api/vault` same-origin as today; server already running on `http://localhost:3847` (page at `/palace.html`); no endpoint, payload or auth changes; `/api/vault-audit` POST for tour narration unchanged.
- Geometry budget: books are the big count — ≤ 14 wings × 60 shelved books; use one shared BoxGeometry + per-wing merged geometry or InstancedMesh (1 draw call per cloth colour per wing, ≤ 6) so total draw calls stay ≤ 260 and triangles ≤ 450 k; labels remain sprites (1 draw call each, ≤ 17).
- Lights: ≤ 1 shadow-casting directional + 1 hemi + ≤ 17 non-shadow points (hearth + ≤ 16 lanterns) — within WebGL uniform limits on mobile Safari; lantern count follows wing count, shelf and treasury lanterns included in that cap.
- Performance: 60 fps target at 1440×900, DPR ≤ 2, on a mid laptop (integrated GPU); frame cost of M1–M8 < 0.5 ms; dust update stays a single BufferAttribute upload per frame. Phone portrait: same scene, DPR cap 2, ≥ 30 fps on a 2021 Android.
- Sway implementation constraint: label sprites get a parent Group positioned at the cord top (label y + 1.2); sway rotates the group; the sprite stays in `labelsByKey`/`focusables` and `updateLabelOpacity`/`handlePick` keep using `getWorldPosition`, so fade and nearest-centre picking are untouched.
- Reduced motion: the single existing `REDUCED_MOTION` const gates every M-motion and the flight cuts; also react to a runtime change of the media query if trivially available via the existing const pattern (at minimum, load-time value as today).
- No console errors: no missing-texture loads (cluster SVG error fallback already handled), no NaNs from empty data (empty wings/buckets/owned paths above), textures colour-spaced `SRGBColorSpace` like today's label/cover textures.
- Text legibility: label canvas stays 512 wide (→ 512×160), `document.fonts.load('600 40px "Departure Mono"')` still awaited before first label is drawn (today's boot order).

## 7. Work breakdown

1. Global look: room enclosure (walls, 12 arched dusk windows, dome, plank floor), lighting rig per §3, procedural wood/parchment/stone/cloth canvas textures; gray-check framing at home against hero.jpg.
2. Atrium: walnut pillar with capital + brass bands, stepped stone dais, budget ring with tick beads (§4.2, §4.6 label + cords).
3. Wings: bookcase carcass, 4 shelves of instanced cloth books, brass brackets, parchment-framed cover plaque, carved wing relief, desk + lantern + stacks + cushions (§4.3).
4. Shelf of Proof and Treasury re-dress (§4.4–§4.5) with index cards, bowls, chests, pitcher.
5. Parchment label system (§4.6) swapped into `makeLabel` (same keys, scales, `labelsByKey`/`focusables` wiring).
6. Motion system M1–M8 + global rules G1–G4 in the existing loop; dust drift upgrade.
7. Regression pass on §5.2–§5.3 behaviours (orbit/pinch/zoom limits, picking ranks, nearest-centre, flights, fade, Esc/Back, demo tour, locked/empty states) at desktop and phone-portrait sizes; console clean; fps check.

## 8. Acceptance criteria

Each criterion is checked in a live render of `http://localhost:3847/palace.html` (screenshot or measured scene state) unless it names a behaviour, which is checked by performing it. One criterion checks one thing.

- AC-01 (refs/hero.jpg): At home view the dais is centre-frame at 0.30–0.36 of frame width, the pillar rises through the top edge of frame, and ≥ 5 bookcase bays with ≥ 5 parchment labels are visible.
- AC-02 (refs/hero.jpg): The room is enclosed: walnut panel walls, ≥ 8 arched windows showing a blue-violet dusk gradient (zenith ≈ #2E3A5C, horizon band ≈ #D9906A), and a ribbed timber dome are visible; no flat #1A120A void borders the room interior.
- AC-03 (refs/hero.jpg): Every bookcase has 4 shelves of upright cloth books (44–60 per wing), brass corner brackets, a top cornice and a plinth; no bookcase is an empty or flat-coloured box.
- AC-04 (refs/detail.jpg): At wing flight distance (radius 19) the walnut shows directional grain streaks (no solid-colour wood face larger than a book), and the framed plaque has a wood frame with 4 brass L-brackets and 1 rivet each.
- AC-05 (refs/detail.jpg): The carved feather wing relief (1 per wing, on the left post) is visible at radius 19 with individual feather separations, in walnut no more than 5 % lighter than the post.
- AC-06 (refs/detail.jpg): Desk/shelf book stacks use the cloth palette (green #5C6B3C, blue #33506E, rust #8A4A2E, tan #A97E3F plus existing accents) with cream page edges; 4 stacks side by side read as 4 different cloth colours.
- AC-07 (refs/detail.jpg): Parchment (labels, plaque mats, index cards) has a deckled darker edge (≈ #C9A86A), fibre noise and ink #2B2115 mono text; no label is a rounded rectangle with a coloured border.
- AC-08 (refs/hero.jpg): Hanging labels have 2 cords and a brass ring each, hang just above bookcase tops, and each is rotated ≤ 3° from level in a still frame.
- AC-09 (refs/hero.jpg): Each wing bay has a desk with sage runner, 1 brass lantern with warm emissive glass, 2 book stacks and (on even bays) an open parchment sheet + ink pot.
- AC-10 (refs/hero.jpg): The treasury reads as a counter with brass bowls (1 per bucket), 2 lidded chests and a pitcher; each bowl's liquid disc radius follows share = resolved_yearly/yearly_income (r = 0.35 + share × 1.0) and the fun-money bucket's liquid and beam are green #6FAE7D, others gold #D8A94E.
- AC-11 (refs/hero.jpg): Floor is radial walnut planks and the dais is 8-sided stone with a second step ring and per-face value variation; the pillar is walnut with a bulged base, carved capital and 3 brass bands (not dark stone).
- AC-12 (refs/hero.jpg): Lighting reads warm-against-dusk: interior surfaces key at amber ≈ #FFC37E, window glass is the only large blue area, and lantern glass/lantern pools are visible on every desk.
- AC-13 (refs/detail.jpg): At radius 19 a wish cube shows a bright emissive core in its gate colour (cooling #D99A2B / ready #6FAE7D / snoozed #7D9BBD) inside dark glass, on a walnut plinth with brass trim.
- AC-14 (refs/hero.jpg): Motion M1 — two stills 1.2 s apart show a hanging label's rotation changed by 0.5–2.8° (sway period 3.8–5.2 s); neighbouring labels are out of phase.
- AC-15 (refs/hero.jpg): Motion M2/M8 — dust motes (260) drift upward 0.28 u/s with lateral wander and wrap at y 17; sparkle sprites orbit active wish cubes; both are frozen with `prefers-reduced-motion: reduce` emulated.
- AC-16 (refs/detail.jpg): Motion M3 — a wish cube's centre y oscillates ±0.14 u (2.6–3.4 s) and its emissive intensity pulses 0.5–1.2; with reduced motion it rests at y 1.35 at steady 0.85.
- AC-17 (refs/hero.jpg): Motion M4 — the budget ring's tick beads advance 4°/s (full turn 90 s) and ring emissive pulses 0.65–1.55 at 0.5 Hz; ring is green when remaining ≥ 0 and #D96A4A when over cap.
- AC-18 (refs/hero.jpg): Motion M5 — hearth and ≥ 3 sampled lantern intensities vary ±9–13 % at 7–13 Hz noise and are never in sync; lantern glass emissive tracks its light; all steady under reduced motion.
- AC-19 (refs/hero.jpg): Motion M6 — treasury liquid emissive oscillates 0.65–1.15 (3.1 s) and the fun-money beam opacity oscillates 0.15–0.29 while rotating 9°/s; steady under reduced motion.
- AC-20 (refs/hero.jpg): Motion M7/G2 — after 4.0 s untouched, camera theta drifts ≤ ±0.018 rad on a 26 s cycle; a pointerdown, wheel or keypress during drift stops it within 1 frame, the orbit state has not been rewritten (subsequent drag starts with ≤ 0.018 rad offset that eases out over 0.3 s), and the idle timer restarts.
- AC-21 (refs/hero.jpg): Reduced motion total — with `prefers-reduced-motion: reduce`, M1–M8 are all in their table static states and a wing click cuts instantly to the flight end state (no 1.1 s tween).
- AC-22 (refs/hero.jpg): Orbit/zoom contract — drag orbits at 0.0052/0.004 rad per px with phi clamped 0.35–1.45; wheel and pinch clamp radius to 16–40 and the camera never leaves the interior sphere (r ≤ 29.5 around (0, 3, 0)), so no zoomed-out view shows wall or bookcase backs; drag during a flight cancels the flight.
- AC-23 (refs/detail.jpg): Picking — clicking a visible swaying label flies to its subject even when a wing proxy is behind it; with 2 labels under the pointer the nearer projected centre wins; clicking the Shelf of Proof and Treasury proxies flies to (14, 2.5, 0) and (−14, 2, 0) at radius 19; a drag of ≥ 6 px never picks.
- AC-24 (refs/hero.jpg): Proximity fade — flying to a wing hides its label (baseOpacity 0; the panel names the place) and every label's opacity follows clamp((dist − 9)/7, 0, 1); labels projecting under the top bar or side panel, and near neighbours of a focused place, hide completely (eased); Esc restores all labels and the home view (radius 29, or 30 in portrait aspect < 0.8).
- AC-25 (refs/hero.jpg): Demo tour — Play demo visits Atrium (4.2 s) → a cooling/ready wish wing (4.6 s) → Shelf of Proof (4.6 s) → Treasury (4.6 s) → closing panel (5.2 s) with narration text; Stop button or any canvas pointerdown cancels it; panel "Back to overview" returns home from any focus.
- AC-26 (refs/detail.jpg): Data fidelity — wing count = min(14, number of categories), shelved-book and stack counts scale with category counts, shelf shows ≤ 12 owned items with the panel listing the same items, and Judge-Mode/persona data changes alter only data-driven dressing, never layout or picking.
- AC-27 (refs/hero.jpg): Phone portrait (≤ 640 px wide) — compact single-row top bar (brand hidden, short hint, unwrapped buttons), panel docks at bottom ≤ 38 vh, home radius is 30, and the dais plus nearby labels are in frame; tap = pick works.
- AC-28 (refs/hero.jpg): Hygiene — page loads with zero console errors (including locked-vault, empty-palace and no-buckets data), sustains ≥ 55 fps at 1440×900 DPR ≤ 2 on a mid laptop, and the veil hides after the first frame.
- AC-final (refs/hero.jpg, refs/detail.jpg): Side by side with hero.jpg at home view and detail.jpg at a wing, a viewer calls it the same finished paper-and-wood palace — warm walnut, parchment, brass, cloth books, lantern dusk, gently alive — with no major visible difference in layout, palette or material read.
