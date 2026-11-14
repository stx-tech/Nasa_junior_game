# Gameplay logic — Moon → Mars → Earth

Base commit: **1730a65** (a snapshot of Codex's working tree from 14.11, around 15:00: guide on the tablet, simpler EN/UA texts, compact budget, Run Shift pinned to the bottom, collapsed reports).
The patch `gameplay-logic.patch` = `git diff 1730a65 HEAD`. Apply it to Codex's tree with `git apply --ignore-whitespace`.

All logic lives in `src/simulation.js`. The tablet and a 3D click on a module use the same functions: `choices`, `estimate`, `preview`, `runShift`, `progress`. Texts live in `src/missions.js` (EN) and `src/i18n.js` (UK; patterns for every simulation message).

## Changed rules

| What | Was (1730a65) | Now | Why |
|---|---|---|---|
| Moon: backup air | `air: 1` — one shift without Life Support = instant failure. Only 1 winning plan out of 80 | `air: 2`: there is **1 backup tank**, single-use (Life Support does not refill it). 17 winning plans out of 80 | A mistake can be fixed once. A second mistake loses the mission |
| Mars: Life Support | Air refilled when Life Support ran, so it could be skipped every other shift (91 winning plans) | The backup tank is single-use on Mars too. Of 59 winning plans, 6 never use it | Skipping Life Support is a one-time sacrifice, not a trick |
| Supplies | `air/water/food` could go negative | Clamped at 0; the mission stops with a reason | No minus numbers on the screen |
| Battery limit | `stored = min(10, …)` with no explanation | Same rule, but `estimate()` returns `wasted`; before the shift you see "The battery can hold only 10. N energy will be lost…" | Saving power in full sun has a visible cost |
| Warnings before the shift | None | `preview()`: danger (air / water / food will run out, Shelter during radiation) and info (backup tank, plants have no water, "next shift you will have only N") | Critical risks are explained **before** Run Shift. Every resource loss is warned (checked over every plan) |
| Reason for the result | Generic "You stored N energy…" | `cause`: "The panels were in shadow…", "Dust blocked the sun, so the panels made only N", "The battery was full, so N was lost", "The power was out…" | The "why" step of the result |
| Reason for a loss | "The mission needs another try" | `failReason`: "The air ran out…", "The crew was not in the Shelter during the radiation warning", "The food ran out before the crop was ready", "Time is up: you studied 1 of 2 rocks", Earth: "After sunset the pump needs 5 energy, but only 4 is left" | One specific reason + one clear Retry |
| Earth | Failure only at the end | If after shift 1 there is less than 5 energy, the mission stops at once with the numbers. No hint is shown until the player asks; the hint is counted | The rule is transferred, not shown |
| Progress | Only in "Supplies" | `progress()`: "Rocks studied: 1 of 2", "Food harvested: 0 of 1 (watered 1 of 2)", "Backup air tanks: 1 of 1", "Food packs: 2"; on Earth: "Plants watered: 0 of 1" | Goals are visible at a glance |

Costs and generation are unchanged: Life Support 3, Lab 3, Greenhouse 2, Shelter 1, Pump 5.
- Moon: generation [7, 0, 7, 7], battery 1.
- Mars: generation [10, 2, 2, 3], battery 6.
- Earth: generation [0, 0], battery 7.

A Shelter cost of 2 was tried and rejected: it left Mars with no winnable plan that keeps Life Support on every shift.

## Shift by shift

**Moon (tutorial, 4 shifts).** Goal: keep the crew breathing and study 2 rocks.

| Shift | Energy | Choices | Immediate result | Delayed result |
|---|---|---|---|---|
| 1 | 1 + 7 | Life Support 3, Lab 3 | Life Support + Lab = 1 rock, 2 left in the battery | The hill shades the panels: shift 2 gets 0. If only 2 are left, Life Support (3) won't run and the backup tank is used |
| 2 (shadow) | battery only | Life Support, Lab | Power comes only from the battery | Skipping Life Support uses the single backup tank |
| 3–4 | battery + 7 | Life Support, Lab | +1 rock per Lab | The rocks are easiest to finish after the shadow |

The guide's question on shift 1 is: "Think first: what will power the base when the panels are in the shadow?"

**Mars (main challenge, 4 shifts; Opportunity data).** Goal: Life Support, 1 harvest (water the plants 2 times), 2 rocks. The crew eats 1 food per shift; there are 3 food packs.

| Shift | Energy | Choices | Delayed result |
|---|---|---|---|
| 1 (sun) | 6 + 10, cap 10 | Life Support, Greenhouse, Lab | Anything above 10 is lost. Starting the plants early = food sooner; science first = harvest only on shift 4 |
| 2 (dust) | battery + 2 | Life Support, Greenhouse, Lab | You must keep ≥ 2 for the Shelter shift |
| 3 (radiation) | battery + 2 | Life Support, Shelter only | Outside the Shelter = loss (radiation is explained separately from the dust) |
| 4 (dust) | battery + 3 | Life Support, Greenhouse, Lab | If the plants were not watered on time, food runs out |

**Earth (transfer, 2 shifts).** The power is out: 7 energy and no sun. The lab is open only on shift 1; the pump (5) only on shift 2. The answer is not shown; the hint is a button and is counted. After the mission comes the question "why" and a comparison with the warm-up, plus the exercise for adults.

## Verified move sequences

`node scripts/logic_check.mjs` runs every reachable state (Moon 28, Mars 121, Earth 2). It checks:
- the shown "Charge left" equals the real battery;
- no supply goes negative;
- every loss has a reason, and every resource loss had a danger warning before the shift;
- a danger warning always comes true;
- Retry resets the mission;
- all 46 reachable messages have a Ukrainian translation.

Named sequences:

| Mission | Sequence | Result |
|---|---|---|
| Moon | LS · LS · LS+Lab · LS+Lab | win (safe plan) |
| Moon | LS+Lab · — · LS+Lab · LS | win **after a mistake** (backup tank used, "Backup air tanks: 0 of 1") |
| Moon | LS+Lab · — · Lab | loss: "The air ran out…" |
| Mars A | LS+Lab · LS+Greenhouse+Lab · LS+Shelter · LS+Greenhouse | win (science first, harvest on the last shift, food reaches 0) |
| Mars B | LS+Greenhouse+Lab · LS+Greenhouse · LS+Shelter · LS+Lab | win (plants early, science later, food stays at 2–4) |
| Mars | LS · LS+Greenhouse+Lab · LS+Shelter · Greenhouse+Lab | win **after a mistake** (3 energy lost in the sun → backup tank on shift 4) |
| Mars | LS+Lab · LS+Greenhouse+Lab · LS | loss: "The crew was not in the Shelter…" → Retry |
| Mars | LS+Lab · LS+Lab · LS+Shelter · LS | loss: "The food ran out before the crop was ready" |
| Earth | — · Pump | win **without a hint** |
| Earth | Lab | loss at once: "the pump needs 5, only 4 is left" |

(LS = Life Support.)

The browser check `python3 scripts/check_gameplay.py` plays Moon → Mars → Earth on the tablet at 720×860 px in EN and UK (64/64). It covers:
- the guide question;
- goal chips;
- warnings in the footer above Run Shift;
- the "did → changed → why" card;
- a recoverable mistake;
- a Mars loss with one primary Retry;
- plan B;
- Earth without a hint;
- that Run Shift is visible without scrolling.

The earlier `check_intro.py` and `check_slider_jump_lang.py` are updated for Codex's layout: the prediction now sits in a folded panel and the report is now the result card.

## 3D

The Moon base has two status plates: "Backup air 1/1" above Life Support and "Rocks 1/2" above the lab. They are orange when the backup is used and green with ✓ when the goal is done. A 3D click on a module that is unavailable this shift shows "… cannot run this shift" in the HUD.

## Limits

The testing was **technical only**: automated tests plus a headless browser. **No child has played it yet.** Whether the wording is clear to 7–12-year-olds, and whether the shadow question works, still needs checking with a real child.
