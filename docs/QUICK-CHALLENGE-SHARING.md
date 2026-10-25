# Quick Challenge sharing: brief

Given 2026-10-16 by the owner. Sharing for **Quick Challenge Results only**: a small first version.

AriMap's public website address: **https://arimap.world** (the canonical domain since 2026-10-18, in `src/core/site.ts`). It's in the share message, Copy link, the card's printed address and its QR code. The address the owner first gave (2026-10-16) was https://ari-map.vercel.app; cards and links shared before the change still point there.

**Shared with the app (2026-10-25).** The card's size and places (`SPOTS`, the palette, the QR code's size) moved from
`src/components/challenge/shareCard.ts` to `src/core/challenge/shareCardLayout.ts`, and `qrCode.ts` to
`src/core/challenge`, unchanged, so the Android app draws the same card (docs/MOBILE.md, "Quick Challenge").

## Shared result card

Generate a PNG using AriMap's existing logo, navy/coral/gold palette and illustrated-map styling. Keep it uncluttered and readable on a phone.

Include:
- Correct answers out of 15.
- For a timed-out round: "12/15 countries found · 60 seconds."
- For a completed round: "15/15 countries found · 42 seconds," using the actual correct count and elapsed time. Completing all questions doesn't necessarily mean answering all correctly.
- "Can you beat my score?"
- AriMap's public website address.

Use the player's selected language, English or Armenian, and the completed round's real data. Define a consistent rounding rule for elapsed seconds. Don't include progress, personal information or answers.

## Results actions

Add "Share result" without displacing the existing Play again, Review and Explore lessons actions.

On activation, prepare the card and show a small preview with:
- Share image, using native file sharing when supported.
- Download image.
- Copy link, using the public homepage, not localhost or diagnostic parameters.

Keep the native share call directly attached to a user action after image preparation so browser activation isn't lost. Treat cancellation normally. If native file sharing is unavailable, keep download and copy available. Report success accurately: copying a link isn't sharing an image.

## Scope

- No accounts, backend, public result pages, leaderboard or new artwork.
- Prefer existing dependencies and lightweight browser rendering; don't add a large screenshot library.
- Wait for the required fonts before rendering Armenian.
- Keep the result summary and localized text reusable outside the DOM for future React Native sharing.
- Don't change scoring, timer, saves, map interaction or lesson Results.
- Keep the generated image consistent if the player switches language or starts a new round.

## Checks and stopping point

Run typecheck and lint. Automated tests are deferred: don't run suites, specs or scratch tests.

Do a focused Chromium check on one phone viewport and desktop, covering a timed-out round, a completed round with mistakes, both languages, PNG download and link copying. Don't claim native phone sharing was verified through desktop emulation.

Stop with a working localhost preview for the owner's review. Report its URL, exact build folder and any limitations. No screenshot ZIP or broad browser audit unless requested.

Preserve unrelated work and existing servers. Don't commit, push, merge or deploy.

## First version (2026-10-16, not committed)

- **Summary and words, DOM-free** (`src/core/challenge/share.ts`): `shareSummary(result)` keeps only the end reason, correct answers, total and seconds; `shareText(summary, locale)` gives the card's lines, the share message, alt text and file name from the message catalogs (`challengeShare.*`). `SITE_URL` is the one place the address lives.
- **Rounding rule**: `roundSeconds(elapsedMs)`, the nearest whole second (half up), at least 1, the same function the Results' "Time used" now calls (unchanged values). A timed-out round's elapsed time is the whole duration, so it reads 60 seconds. A completed round finishing after 59.5 s also reads 60 seconds.
- **Card** (`src/components/challenge/shareCard.ts`): a 1080×1350 PNG drawn on a canvas with no new dependency: the logo's own paths (exported from `Header.tsx`), the palette, the home screen card's painted Europe (the same images, outlines and borders), the score, the round's line, the challenge and the address. It waits for the page's fonts (up to 5 s, then draws with fallbacks) and the images.
- **Dialog** (`src/components/challenge/ShareResult.tsx`): "Share result" after Play again, Review and Explore lessons. Each opening, language or retry makes the card afresh; a card finished for an earlier result or language is dropped. "Share image" appears only where `navigator.canShare({ files })` is true, and calls `navigator.share` straight from its click; closing the share sheet shows nothing. "Download image" and "Copy link" are always there; the copy notice says a link to the home page was copied, not the image.
- **Unit test written, not run**: `src/core/challenge/share.test.ts`.
- **Armenian wording needs native review**: `challengeShare.*` in `messages.hy.ts`.
- **Elapsed, unambiguous (2026-10-25)**: the line says "12/15 countries in 60 seconds" / «12/15 երկիր 60 վայրկյանում», the time the round took, which "· 60 seconds" left open to being read as the time allowed. The card's stopwatch line is unchanged (the duration beside a stopwatch). The Armenian locative awaits a native speaker's review.
- **Polish (2026-10-16, the owner's request)**: the line shortened to "12/15 countries · 60 seconds" / «12/15 երկիր · 60 վայրկյան» (score and time still from the round: a completed round its own time, a timed-out one 60 seconds); in the card, the label kept at least 72 px from the name and "Can you beat my score?" 48 px inside the margins on each side, drawn slightly smaller where it needs to (Armenian).
- **Postcard card (2026-10-17, the owner's template)**: the card is `public/images/share/quick-challenge-postcard-template.png` (1122×1402: the illustrated map, the logo's icon, the scenery, the ticket with its gold underline and stopwatch, the gold pill), scaled evenly to cover 1080×1350, with only words and a QR code drawn over it (`src/components/challenge/shareCard.ts`; the places measured from the template, in its pixels). Top cream: the name beside the icon, the title under it ("EUROPE QUICK CHALLENGE" in spaced capitals; Armenian «Եվրոպայի արագ մարտահրավեր» in its own case, on two lines, under a slightly smaller name with a clear gap). Ticket, turned with its underline: the score (correct answers large, "/15" smaller), "Countries found" and the round's time by the stopwatch. Bottom right: the card's own invitation, "Your turn!" / «Քո հերթն է» (`challengeShare.turn`; the share message keeps "Can you beat my score?"), large and centred in the cream beside the QR code; the address in the pill. The QR code (`qrCode.ts`: byte mode, level M, no library) encodes `SITE_URL`, the same value as the address and Copy link: navy modules on a white 180 px square with the four-module quiet zone; it decodes from the exported PNG, at full size and at 360 px wide.
- **Display name (2026-10-17)**: the player's saved display name (the one the leaderboard shows, `PlayerState.displayName`) is on the card. The card uses the owner's second template, `public/images/share/quick-challenge-postcard-template-v2.png` (same 1122×1402 and same header, scenery, cream, pill, underline and stopwatch as the first, which stays alongside; its ticket is about 90 px taller at the top, the postmark moved up with it), so the name has its own space: the ticket's upper part, left-aligned with the score and as wide as it may be (left of the postmark), centred between the ticket's top (with a margin) and the score. One line up to 60 template px while it fits at 44 or more; otherwise two lines up to 46, broken at a space, or between letters (never inside one, combining marks kept; no hyphen added) where there is no space or a space would leave it much smaller. Twenty characters fit on two lines at about 36 px even in the widest letters, Armenian too: never cut, never tiny. The score is back at its full size (215), with the caption and time beneath it as before; without a name, the upper part stays blank and sharing works the same. The name is part of the share summary (`shareSummary(result, displayName)`, `ShareText.player`, and the alt text), not of the drawing code. The card is made for the result, language and name it opens with, and made again when any changes: a name saved or changed on Results (its existing form) is on the next preview and download. Score and time are the confirmed result's, as before.
