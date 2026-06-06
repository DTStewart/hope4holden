## Problem

On desktop, the banner elements collide:
- "Raffle" script overlaps the bottom of the "50|50" digits (negative margin too aggressive)
- The green jackpot pill sits to the right of the "CURRENT JACKPOT OVER" bar instead of below it (both are `inline-block` siblings competing for the same row)
- The background H4H texture is so large it bleeds across the whole banner and washes out the foreground

## Fix (src/pages/Index.tsx — banner section only)

1. **Stack the jackpot block properly.** Wrap "CURRENT JACKPOT OVER" and the green dollar pill in a `flex flex-col items-center md:items-start gap-3` container so they stack vertically instead of fighting for inline space.

2. **Stop "Raffle" overlapping "50|50".** Remove the negative top margin (`-mt-4 md:-mt-6`) on the Raffle wrapper and replace with a small positive `mt-1` plus a normal `mb-5`. Add proper `leading-none` discipline on the 50|50 row.

3. **Tame the H4H texture.** Drop the fontSize from `9rem` to `4rem`, lower opacity from `10%` to `7%`, and make sure it sits behind everything with `z-0` while the content gets `relative z-10`.

4. **Add vertical rhythm.** Give the left column `space-y-4` so the HOPE4HOLDEN rule line, 50|50, Raffle, black bar, and green pill each get consistent breathing room.

5. **Keep horizontal desktop / stacked mobile layout** and the Anton font choices — only spacing/stacking changes, no new colors or copy.

## Out of scope

No changes to the CTA button, hero, or any other section. Mobile review can follow once desktop is clean.
