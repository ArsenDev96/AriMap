# Quick Challenge: real-phone review checklist

For a review of the Quick Challenge on real phones before the uncommitted "All of Europe" work (`docs/QUICK_CHALLENGE_CHECKPOINT.md`, item 2) is committed. Everything below was checked in Chromium's phone emulation (390×844 at 3×, touch input) on 13 October 2026; this list is for what emulation can't show: real fingers, real networks, Safari, the Android back gesture, a phone going to sleep.

## Before you start

- **Build**: the working tree on `next` (b500b77 plus the uncommitted changes): 40 countries asked (of 45 drawn), 15 questions, **60 seconds** per round (45 until 13 October 2026).
- **Opening it on a phone**: the review preview listens on this PC only (`http://127.0.0.1:3100`). Either:
  - **Android over USB**: in Chrome on the PC, `chrome://inspect` → *Port forwarding* → `3100` → `localhost:3100`; then open `http://localhost:3100` in Chrome on the phone.
  - **Any phone on the same Wi-Fi**: in `D:\AriMap`, `npm run build`, then `npx next start -p 3100 -H 0.0.0.0`, and open `http://<the PC's local IP>:3100` (Windows may ask to let Node through the firewall).
- **Phones**: at least one iPhone (Safari) and one Android phone (Chrome). Run the list in English, and sections 1, 3 and 4 again in Armenian (ՀՅ, top right).
- **To report**: phone, OS and browser version, language, the item, what happened, and a screenshot or screen recording.

Colours in a round: **Found** (green), **Missed** (yellow), **Your wrong choice** (red), as in the review's legend.

## 1. Andorra and Luxembourg

At the start view (whole Europe):
- [ ] Two dashed rings show on every question (Luxembourg, Andorra), alike: neither marks the asked country.
- [ ] A tap in the middle of Andorra's ring answers Andorra; in Luxembourg's, Luxembourg. (If it isn't the asked country: that ring turns red and the asked country yellow.)
- [ ] Malta, Liechtenstein, San Marino, Monaco and Vatican City are never asked, have no ring, and a tap on them answers nothing.

After zooming in:
- [ ] Andorra's ring stays up to the deepest zoom. Luxembourg's goes from about ×5.6; then Luxembourg's own shape is tapped.

## 2. Pinch, then answer while the relief sharpens

- [ ] Pinch in to the deepest zoom over Scandinavia or the Urals in one gesture. The pinch itself never answers.
- [ ] Tap a country straight away, while the relief is still soft: the answer registers at once.
- [ ] Within a few seconds the relief sharpens with a short fade, without flashing, jumping or blank patches. (On a 1.5 Mbit/s emulated connection: about 3 s.) Try it on mobile data too.
- [ ] The pinch itself is smooth: note any stutter.

## 3. Correct, incorrect and skipped

- [ ] **Correct**: "Correct", the country green for a moment, then the next question; the score goes up by one.
- [ ] **Incorrect**: "Incorrect", the tapped country red and the asked one yellow, then the next question.
- [ ] **Skip**: "Skipped", the asked country yellow. Skip is greyed out while the feedback shows.
- [ ] A second quick tap during the feedback doesn't answer the next question.
- [ ] Sea, and countries outside the quiz (Turkey, North Africa, Kazakhstan…), answer nothing. Nor does a long press (over 0.7 s), or a press that slides more than a few pixels.

## 4. The 60-second deadline

- [ ] The timer starts at 60 and turns red for the last 10 seconds. When it runs out mid-question, "Time's up!" shows, with the questions not reached counted as Unanswered.
- [ ] Open **About the map** (the **i** on the map) during a round: it opens at its top, its title first, and the time keeps running behind it. **Leave it open past the deadline**: it closes by itself, the results show, and Play again, Review on the map, Explore Europe lessons and Home all respond.
- [ ] During a round, close About the map with Close, a tap outside it, and (Android) the back gesture: back to the same question, the time still running.
- [ ] Lock the phone or switch apps for about 20 s mid-round: on return the timer has counted that time (no time is gained).
- [ ] **Home** during a round asks "Leave the challenge?", its seconds still counting; staying returns to the round.

## 5. Review, language and Play again

- [ ] **Review on the map** zooms to the first missed country and names it (and your wrong choice, if there was one); tapping another chip moves there.
- [ ] Switch language during a round: the question changes language; the timer and the map's position don't change. In the review: the map's names change and the view stays.
- [ ] **Back to results**, then **Play again**: the whole-Europe start view, no colours, a new set of countries, Start ready. The same after a round you zoomed in on.

## Known limitations (13 October 2026)

- **Sharper relief arrives after a deep zoom.** After a fast pinch the soft whole-map relief shows until the sharper tiles load, as tiles are fetched only where a gesture ends. Answering is never blocked. The final view at the deepest zoom fetches 216–869 KB on a phone (most over the Urals); nothing is fetched during the gesture.
- **Tile edges**: a faint hairline where two relief tiles meet (Chrome joins translucent images that way); the same everywhere, lessons included.
- **Desktop**: on a 1366×800 screen the map is narrower than the window, with space beside it. At 1× pixel density its deepest zoom stays on the softer whole-map tiles (a 2× laptop screen gets the sharp ones).
- **No Europe–Asia line** is drawn in the Urals or the Caucasus.
- **About the map at the deadline** (fixed 13 October 2026): it now closes when the round ends. Before, on phones, the results showed behind an invisible dialog and nothing responded until a reload.
- **Not yet checked**: real devices, Safari/WebKit, Android's back gesture on the dialog, a phone sleeping mid-round, and the test suites (not run for this work; the challenge has no unit tests).
