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

`admin.html` + `assets/js/admin.js`, Google sign-in gated to `ADMIN_EMAIL` in
`assets/js/firebase-config.js`. **Firebase is still on placeholder values** —
shows won't save until a real project is created and the config filled in.
Until then the homepage falls back to two hardcoded example shows.

## Gotchas

- The images in the original Hostinger zip were named `foo (1).jpg` (browser
  duplicate downloads) while the HTML asked for `foo.jpg` — every image on the
  site was broken. Renamed on import. Watch for this on future drops.
- Four t-shirt photos (`tshirt_hero`, `tshirt_pointing`, `tshirt_smile`,
  `tshirt_product`) are byte-identical — same photo four times. Worth replacing
  with real product shots.
- `.hidden` was only defined as `.modal-overlay.hidden`, so bare `.hidden`
  elements stayed visible. A global rule is now in `style.css`.
- Footer/meta say `smo.ie` in places but the domain is `smo-rockstar.ie`.
