# Analytics (Google Analytics 4)

AriMap measures a few things with Google Analytics 4 (property `G-ZNRVQKQXKJ`), only after the player accepts.

- **Events** (and their exact parameters): `src/core/analytics/events.ts`, free of React and the browser.
- **Sending** (consent, loading Google's tag, sending once): `src/web/analytics.ts`.
- **The choice** (Reject / Accept): `src/components/ConsentPanel.tsx`, at the foot of the home screen.

## Privacy (what the app tells players)

The home screen's "Privacy & analytics" panel says the following, and the code does no more:

- **What is measured:** screens opened, lessons and Quick Challenges started and finished (with scores and times), the leaderboard opened, and results shared. Each event carries the app's language.
- **What Google receives as well:** the IP address and device and browser details, and the cookies Google Analytics sets to recognise the browser (`_ga`, `_ga_ZNRVQKQXKJ`). This is not anonymous.
- **What is never sent:** names, emails, player, round or Supabase ids, answers, or anything typed.
- **No consent, nothing sent.** The game works the same either way, and the choice can be changed at any time from "Privacy & analytics" at the foot of the home screen.

## Consent (basic consent mode)

- **Until the player chooses, or after Reject:**
  - Google's script is not loaded, and no request is made.
  - Nothing done then is kept to send later.
- **The choice is stored on the device** as `arimap:analytics-consent` in localStorage (`granted` or `denied`). It reaches other open tabs too.
- **Accept:**
  - The tag loads with the first thing sent: the screen showing at that moment. No earlier screen or action is sent.
  - Ad storage, ad user data and ad personalisation are denied in consent mode.
  - Google Signals and ad-personalisation signals are off. No User-ID is ever set.
- **Reject after Accept:**
  - Sending stops at once (consent mode `analytics_storage: denied`, and the `ga-disable-G-ZNRVQKQXKJ` flag).
  - The `_ga` cookies are removed.
- **Production only:** events are sent only on the canonical host, exactly `arimap.world` (`src/core/site.ts`; until 2026-10-18 it was `ari-map.vercel.app`). Localhost, Vercel Previews, a `www.` form and the earlier `ari-map.vercel.app` never send, whatever is chosen there.
- **Consent is per site:** the choice is stored per origin, so a player who chose on `ari-map.vercel.app` is asked again on `arimap.world`.
- **Failures:** if the script is blocked or fails to load, nothing is sent and the game goes on.
- **AdSense:** the AdSense ownership-verification meta tag is separate from analytics, and this work doesn't touch it. It's in `src/app/layout.tsx` on `main` (PR #29) and live on production. A branch made before PR #29 (such as `login`) doesn't need `main` merged into it first. When such a branch is merged into `main`, check that the merged `layout.tsx` still has the tag. A trial merge of `login`'s layout (2026-10-19) kept both the tag and the canonical link. No advertising script is loaded.

## Events

| Event | When | Parameters |
| --- | --- | --- |
| `page_view` | Each screen as it opens: Home, Levels, Lesson (one per lesson), Quick Challenge, Leaderboard. A language change or a re-render is not one. | `page_title` (English screen name), `page_location` (the site's origin plus `/`, `/levels`, `/lesson/<lesson id>`, `/challenge` or `/leaderboard`), `app_language` |
| `challenge_start` | The server has started a round for a press of Start. Not for a round resumed after a refresh. | `app_language` |
| `challenge_complete` | A round's result, once the server has confirmed it. | `correct`, `elapsed_ms`, `app_language` |
| `lesson_start` | A lesson attempt begins: a level opened with none under way, Start over, Play again, or Replay journey. Resuming an attempt doesn't count. | `lesson_id`, `lesson_mode` (`full` or `journey_replay`), `app_language` |
| `lesson_complete` | That attempt reaches its Results. | `lesson_id`, `lesson_mode`, `app_language` |
| `europe_mastered` | All 36 Europe stars reached by playing, the first time. | `app_language` |
| `leaderboard_open` | Each press of a Leaderboard button: on the home screen, or on the Quick Challenge's start screen or its Results. Reopening it with the browser's Forward, or keeping it open across a refresh, sends only that screen's page view. | `source` (`home`, `challenge_ready` or `challenge_results`), `app_language` |
| `share_result` | A share that worked: the share sheet completed, the image downloaded, or the link copied. A closed share sheet or a failed copy sends nothing. | `method` (`native_share`, `download` or `copy_link`), `app_language` |

### Counting once

- **Lesson and Europe events** come from the actions the player takes (`progressEvents`: the state before and after each action). Loading a save never sends them. A save brought in with every star never counts as `europe_mastered`, and Results shown again send nothing.
- **Challenge events** are sent once per round on the device. The round's id is the key, kept on the device only (`arimap:analytics-once`, the last 40), and never sent. The key is recorded even when nothing could be sent (no consent yet, or not production). So a retried Start, another tab, a refresh or Results restored later, after consent, are never counted again.
- **Page views** come only from the app: the tag's own first page view is off (`send_page_view: false`). Each screen is sent once as it opens.

## Configuration needed in Google Analytics

- **Enhanced measurement: off (required, done 2026-10-18).** Admin → Data streams → the web stream → Enhanced measurement. While it was on, it added events beyond the list above: the browser checks captured `scroll` and `form_start`. After it was turned off, a check with the updated tag sent neither, through a long scroll and a form filled in and sent. Keep it off. The app sends its own page views, so it doesn't need history-based ones either.
- **Allow user-provided data capabilities: off (done 2026-10-18).** Admin → Data collection. The updated tag no longer carries automatic detection of emails, phone numbers or addresses. No email or phone number, plain or hashed, appeared in any captured payload, before or after.
- **Keep Google Signals off.** Admin → Data collection → Google signals data collection: leave it off. Leave ads personalisation off too.
- **Custom dimensions** (Admin → Custom definitions), event scope, to see the parameters in reports: `app_language`, `lesson_id`, `lesson_mode`, `source` and `method`. `correct` and `elapsed_ms` are custom metrics, both standard units, `elapsed_ms` in milliseconds.
- **Key events (optional):** mark `challenge_complete`, `lesson_complete` and `europe_mastered`.
- **Data retention:** pick the shortest period that suits (Admin → Data collection → Data retention).
