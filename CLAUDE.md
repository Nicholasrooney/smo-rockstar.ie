# SMO (smo-rockstar.ie) — project notes

Static band site for SMO (Dublin alt-rock, fronted by Sam) with a one-product
merch shop, a Stripe checkout and a Firebase-backed shows admin.

## Deploy

Repo: https://github.com/Nicholasrooney/smo-rockstar.ie
Hostinger deploys from Git. Workflow: edit files → commit → push → click
**Redeploy** in Hostinger. The repo root IS `public_html` — don't nest the site
in a subfolder.

## Layout

```
index.html  shop.html  checkout.html  success.html  admin.html
assets/css/style.css
assets/js/main.js            site + cart + Stripe redirect
assets/js/admin.js           shows CRUD
assets/js/firebase-config.js Firebase keys + admin email
assets/images/               all photos
assets/video/hero.mp4        homepage hero background video
data/products.json           server-side source of truth for prices
checkout.php                 creates the Stripe Checkout Session
order-confirm.php            verifies payment, logs + emails the order
stripe-check.php             private health check
smo-log.php                  shared private-log helper
```

## Payments

Hosted **Stripe Checkout** — card details are entered on Stripe's page and
never touch this site. Do NOT add card fields to `checkout.html`.

Prices come from `data/products.json` on the server, never from the browser, so
a tampered cart can't change what's charged. Postage is set server-side too
(IE €5 / UK €7 / EU €9) — the figures in `main.js` are display-only mirrors, so
change both together.

**The secret key is not in this repo and must never be.** It lives on the
server in `stripe-secret.php`, one line:

```php
<?php return 'sk_live_xxxxxxxxxxxxxxxxxxxx';
```

Preferred location is one level ABOVE `public_html` (not web-reachable);
`public_html/stripe-secret.php` also works and is git-ignored. Until that file
exists the checkout stays safely switched off and says so.

Health check: `/stripe-check.php?token=smo-check-7k2rp9wq`

Known gap (same as Vivi Vie): if a customer pays but never lands back on
`success.html`, no order email fires. Stripe still has the payment. Closing
that properly needs a Stripe webhook.

## Shows / admin

**Firebase is gone.** Shows now live in `data/shows.json`, written by
`shows-api.php` and edited at `admin.html` (+ `assets/js/admin.js`). Auth is a
plain PHP session behind one shared password — that was the requirement, so
Google sign-in was the wrong tool.

The password lives in `admin-secret.php`, **git-ignored because this repo is
public**, one line: `<?php return 'the-password';`. Without it the admin locks
itself and shows setup instructions. Same pattern as `stripe-secret.php`.

The API re-sanitises every field on save — nothing posted is trusted. Photo
paths must match `assets/images/…` (no remote URLs, no `..`), uploads are
validated with `getimagesize` rather than by filename, and saved under a random
name in `assets/images/shows/` (git-ignored; they live only on the server).

Editors pick from ~10 stock band photos or upload their own, max 3 per show.

**`data/shows.json` is NOT tracked in git.** It's written on the server by the
admin; committing it means the next deploy overwrites real gigs with whatever
is in the repo. It bit once already. `shows-api.php` creates it on first save.

**A show needs a name AND a date.** Without a date the homepage can't place it
and hides it, which used to happen silently after a cheerful "Saved". The API
now refuses the whole save and names the offending row, and the editor flags it
before you press the button.

**Never reintroduce hardcoded fallback gigs.** The old Firebase version fell
back to two invented shows dated Apr/May 2025, and the live homepage advertised
them for months after they'd passed. Empty now renders "No dates announced"
with an Instagram link. `main.js` falls back to reading `data/shows.json`
directly if the API errors, so gigs survive a PHP failure.

## Mailing list

Signup form on the homepage → `subscribe.php`. **Addresses are written to
`smo-logs/subscribers.json`, OUTSIDE the web root** — deliberately not
`data/subscribers.json`, because `data/` is inside `public_html` and anyone
could have downloaded the list by guessing the URL.

Read them at **admin.html**, under the shows editor: a table plus a CSV
download. The CSV link carries the CSRF token in the query string, which is
why `shows-api.php` accepts the token from GET as well as POST.

Consent is stored with each address (timestamp + the exact wording agreed to),
because GDPR means being able to show *what* someone opted in to. If the
wording on the form changes, change `CONSENT_TEXT` in `subscribe.php` — older
records keep the wording they actually agreed to.

A duplicate signup returns the same message as a new one on purpose: telling a
stranger "you're already subscribed" confirms who is on the list.

## Featured release

`FEATURED_RELEASE` at the bottom of `main.js` drives the big block near the top
of the homepage. Set `releaseDate` (YYYY-MM-DD) and it manages itself:
pre-save before that date, "Listen Now" after it, and `FEATURE_DAYS` (7) later
it hides itself while the same track appears in the normal Releases grid. Blank
date = stays featured indefinitely.

Release cards are `<div>`, not `<a>`. They used to be anchors containing the
Spotify and YouTube links — anchors can't nest, so the parser split each card
into fragments and the White Flag `id` appeared three times in the DOM. The
title now carries a stretched `.release-link`.

## Cache busting — IMPORTANT

Every page loads `assets/css/style.css?v=N` and `assets/js/*.js?v=N`.
**Bump `N` in every HTML file whenever you change the CSS or JS**, otherwise
returning visitors pair the new HTML with their cached old stylesheet.

That already bit once: the hero `<video>` shipped while browsers still held the
pre-video stylesheet, so with no `.hero-video` rule the video fell back to its
intrinsic 666×464 as a plain flex item and — because `.hero` is
`align-items: flex-end` — landed in the bottom-left corner instead of filling
the screen.

```bash
grep -rn "?v=" *.html
```

## Cookies / analytics

`assets/js/cookie-consent.js` (plain script, not a module) renders the banner
and gates analytics. Nothing tracking loads until the visitor clicks
**Accept All**; the choice is stored in the `smo_cookie_consent` cookie for 12
months. Any element with `data-cookie-settings` reopens the banner — there's
one in every footer.

**Analytics are currently OFF**: `GA_ID` in that file is empty, so even an
"Accept All" loads nothing. Paste the GA4 measurement ID in to switch them on;
no other change needed.

`legal.html` holds the Cookie Policy (`#cookies`) and Privacy Policy
(`#privacy`) the banner links to. It describes the real data flow — Stripe
takes card details on its own page, order details are emailed + logged, orders
kept six years for Revenue. Contact address is `info@smo-rockstar.ie`. The
analytics wording says they aren't switched on yet, so revisit it when they are.

## Email

`smo-rockstar.ie` and `smo-rockstar.com` both sit on **Cloudflare DNS**, with
**Cloudflare Email Routing** forwarding `info@` and `sam@` to Nicholas and Sam.
There are no real mailboxes — it's forward-only, so replying *as* those
addresses needs a separate SMTP relay.

`sam@` (and possibly `info@`) route through a Cloudflare **Email Worker**
called `smo-rockstarredirect`, which fans one address out to several people —
routing rules only allow one destination each. To change who gets what, edit
the Worker or the rule in Cloudflare, **not** this repo.

`order-confirm.php` notifies `info@` + `sam@` rather than anyone's personal
Gmail. That's deliberate: **this GitHub repo is public**, so don't paste
personal addresses into it. It also means recipients are changed in Cloudflare
without a redeploy.

DNS worth knowing (all on Cloudflare):
- `A` → `213.130.145.115` (Hostinger, shared with eastcoastmechanics.ie),
  **grey-clouded** — proxying it breaks Hostinger's SSL renewal.
- SPF must keep BOTH includes or order emails get treated as spoofed:
  `v=spf1 include:_spf.mx.cloudflare.net include:_spf.mail.hostinger.com ~all`
- Only ever one SPF record. Two is a hard failure.
- `smo-rockstar.com` is a 301 redirect to the `.ie` and stays **orange-clouded** —
  Cloudflare Redirect Rules only fire on proxied traffic.

Gmail gotcha that cost an hour: sending a test from the same Gmail the address
forwards to shows nothing in the inbox — Gmail suppresses its own message
coming back. Check Cloudflare's Activity Log, or test from another account.

## Checkout / cookie banner clearance

The cookie banner is `position: fixed` at the bottom, so it sat on top of the
basket bar and the Pay button — people could not click buy until they dismissed
it. `cookie-consent.js` now publishes the banner height as `--smo-ck-h`;
`body.smo-ck-open` reserves that much padding and `.cart-bar` sits at
`bottom: var(--smo-ck-h)`. **Anything else fixed to the bottom must do the
same, or it will cover the buy button again.**

Don't put the cart bar's position back into an inline style — the stylesheet
needs to control it.

`.btn-buy` is the primary buy action. Note it carries non-motion feedback
(darker background, label change, disabled state) as well as the pulse, because
reduced-motion users — anyone with Windows animation effects off — get no
transform and no animation at all.

## Light theme preview

`light.html` + `assets/css/light.css` — a standalone preview at
`/light.html`, noindex, loading none of the dark site's CSS so it can't affect
anything live. It pulls real gigs from the same API.

Deliberately not a recolour: the dark site inverted would read as a generic
white SaaS page. The reference is a screen-printed gig poster — warm paper,
heavy ink, red behaving like a second pass through the press. Same two
typefaces. The stat row and the four identical release cards were both
rebuilt (a printed spec line, and a numbered listing) rather than carried
across, since they're the two most template-looking parts of the dark page.

Contrast verified: body 16:1, secondary 6.7:1, red on paper 5:1.

## Media

**Hero video** (`assets/video/hero.mp4`) is the beach music-video clip, muted and
looping behind the homepage headline. Source was a WhatsApp export — only
832×464 with 84px black pillarbox bars each side, cropped out to 666×464 and
re-encoded to 2.6MB. It's scaled up a long way on desktop; the dark overlay
hides most of it, but if a higher-resolution master ever turns up, re-encode
from that. Autoplay needs `muted` + `playsinline` — don't remove either.
Reduced-motion users get the poster frame instead (paused in `main.js`).

**Photos** came from `SMO/Pictures.zip` (44 shots, ~332MB of originals). The
web copies are resized/optimised to ~1.4MB total. Originals are NOT in the repo
— go back to the zip to re-cut. `release-love-me-too.jpg` is the real single
artwork; there's also official "Listen" artwork in the zip
(`Photo 07-03-2025, 22 10 19.png`) unused, since the releases grid has no
Listen card yet.

## Gotchas

- The images in the original Hostinger zip were named `foo (1).jpg` (browser
  duplicate downloads) while the HTML asked for `foo.jpg` — every image on the
  site was broken. Renamed on import. Watch for this on future drops.
- Five files in `Pictures.zip` named `.webp` are actually HEIC — Pillow can't
  read them without `pillow-heif`. They're variants of a shot already used, so
  they were skipped.
- `.hidden` was only defined as `.modal-overlay.hidden`, so bare `.hidden`
  elements stayed visible. A global rule is now in `style.css`.
- Footer/meta say `smo.ie` in places but the domain is `smo-rockstar.ie`.
