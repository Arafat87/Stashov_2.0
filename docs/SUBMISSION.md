# Stashov — Memory Ledger (Meta AI Hackathon submission)

## Tagline

From paycheck to purchase, with a memory: Stashov files everything you save,
checks what you already own, allocates your income, and makes every impulse
wait fourteen days while Muse Wonder argues against it — citing your own
past decisions.

## What it does

- **Vault** — 1,346 real browser bookmarks (Chrome/Brave/Edge) deduplicated
  and filed into 14 clusters, searchable by meaning.
- **Impulse Gate** — every wish is checked against your owned closet, your
  routines, the discounter price floor, and a 14-day cooling lock. Muse
  Wonder 1.0 delivers the verdict and quotes your **decision journal** —
  your own recorded buy/skip/snooze reasons — back at you.
- **Shelf of Proof** — photograph your closet; Muse Spark scans it into the
  owned inventory the Gate checks against, so duplicates die before checkout.
- **Treasury** — yearly income flows into buckets you define (rent, investing,
  fun money). One bucket feeds the monthly fun-money cap, and that cap is the
  law every Gate verdict obeys. Salary becomes permission.
- **Memory Palace** — the whole vault as a walkable 3D place (three.js):
  an atrium, one wing per cluster, the Shelf, and the Treasury. Hit
  **▶ Play demo** and it flies the story for you while Wonder narrates live.
- **Judge Mode** — one click loads the Jordan demo persona ($96,000 income,
  4 buckets, a stocked closet, wishes in every gate lane, a decision
  journal). Your real vault is snapshotted first; one click restores it.

## How it is built

- **Muse Wonder 1.0** — deep verdicts and vault-wide audits (Router tab),
  always with the decision journal in context.
- **Muse Spark 1.3 / 1.1** — fast classification, structured extraction,
  and the multimodal Shelf closet scan.
- **Baseten** (`meta-models/muse-spark-open-1026`) — inference rescue only:
  the cascade falls back to it if the Meta route fails, and telemetry labels
  rescued calls honestly.
- **Modal** — the overnight price loop: scheduled re-checks of cooling
  wishes against discounter floors, writing results back into the journal.
- Local-first Node server; vault is a JSON file you own. Paper-and-wood UI
  set in Departure Mono (self-hosted, OFL), no trackers, no cloud copy.

## Demo (90 seconds)

1. Deck: "1,346 saved links. Zero lost." — the ledger at a glance.
2. Topbar → **Demo as Jordan**: a judge-ready life appears in two seconds.
3. Gate: open a cooling wish → Wonder's verdict, with a highlighted quote
   from Jordan's own decision journal.
4. Treasury: change the fun-money bucket and watch the Gate cap move.
5. Palace → **▶ Play demo**: Atrium → cooling wish → Shelf of Proof →
   Treasury basins, closing on Wonder's live narration.

Record the narrated 90-second cut (Jordan loaded, paycheck-to-purchase story)
and a silent palace-only cut from the live walkthrough above for the
<=3-minute submission video.

## Try it

```
npm install
npm start
# open http://localhost:3847  ·  Palace: http://localhost:3847/palace.html
```

Tests: `npm test` (153 passing). Regenerate the demo persona any time with
`npm run seed-persona`.
