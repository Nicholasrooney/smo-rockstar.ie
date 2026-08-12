<?php
/* =========================================================
   SMO — Stripe Checkout endpoint  (Hostinger runs PHP)
   ---------------------------------------------------------
   Creates a Stripe Checkout Session from the cart and returns
   { "url": "https://checkout.stripe.com/..." } for the browser to
   redirect to. The browser NEVER sees the secret key, and card
   details are entered on Stripe's own page — never on this site.

   TO GO LIVE:
   1. Put the secret key in a file ABOVE the web root, or in
      stripe-secret.php next to this file (git-ignored), e.g.:
         <?php return 'sk_live_xxxxxxxxxxxxxxxxxxxx';
   2. Nothing else — the shop turns itself on once the key exists.
   3. Prices are re-derived on the server from data/products.json
      so they cannot be tampered with in the browser.

   Until the secret key file exists, this endpoint stays safely
   disabled and returns an informative error.
   ========================================================= */

header('Content-Type: application/json');

/* Look for the secret key file in two places (first match wins):
   1) ONE LEVEL ABOVE the web root  — e.g. /home/user/stripe-secret.php  (safest, not web-accessible)
   2) Same folder as this file       — e.g. public_html/stripe-secret.php (convenient)
   The file must contain ONE line:   <?php return 'sk_live_xxxxxxxx'; */
$candidates = [dirname(__DIR__) . '/stripe-secret.php', __DIR__ . '/stripe-secret.php'];
$STRIPE_SECRET = null;
foreach ($candidates as $f) { if (file_exists($f)) { $STRIPE_SECRET = require $f; break; } }
if (!$STRIPE_SECRET) {
    http_response_code(503);
    echo json_encode(['error' => 'The shop is not open for card payments yet.']);
    exit;
}

/* ---- read the posted cart ---- */
$body  = json_decode(file_get_contents('php://input'), true);
$items = isset($body['items']) ? $body['items'] : [];
if (!$items) { http_response_code(400); echo json_encode(['error' => 'Your cart is empty.']); exit; }

/* ---- trusted prices: load the product list and key by id ---- */
$products = json_decode((string)@file_get_contents(__DIR__ . '/data/products.json'), true);
if (!is_array($products)) {
    http_response_code(500);
    echo json_encode(['error' => 'Product data unavailable.']);
    exit;
}
$byId = [];
foreach ($products as $p) { $byId[(string)$p['id']] = $p; }

/* ---- build Stripe line items (server-side prices only) ---- */
$lineItems = [];
/* Stays false while the cart holds only freeShipping items (the €1 test
   item uses this, so a payment test costs exactly €1 and nothing else). */
$needsShipping = false;
foreach ($items as $i) {
    $id = (string)($i['id'] ?? '');
    if (!isset($byId[$id])) continue;
    $p = $byId[$id];
    if (empty($p['priceCents']) || $p['priceCents'] <= 0) continue;

    /* Size comes from the browser, so only accept one we actually sell. */
    $size  = strtoupper(trim((string)($i['size'] ?? '')));
    $sizes = isset($p['sizes']) ? $p['sizes'] : [];
    if ($sizes && !in_array($size, $sizes, true)) continue;

    $qty  = max(1, min(20, (int)($i['qty'] ?? 1)));
    $name = $p['title'] . ($size ? ' — Size ' . $size : '');

    $lineItems[] = [
        'price_data' => [
            'currency'     => 'eur',
            'unit_amount'  => (int)$p['priceCents'],
            'product_data' => ['name' => $name],
        ],
        'quantity' => $qty,
    ];
    if (empty($p['freeShipping'])) $needsShipping = true;
}
if (!$lineItems) { http_response_code(400); echo json_encode(['error' => 'Nothing purchasable in your cart.']); exit; }

/* ---- shipping: region-based. The server sets BOTH the allowed destination
   countries AND the flat rate, so the rate can't be mismatched to the address. ---- */
$region = strtoupper($body['region'] ?? 'IE');
$EU = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
if ($region === 'IE') {
    $shipAllowed = ['IE'];
    $shipAmount  = 500;                 // €5.00
    $shipLabel   = 'Standard shipping (Ireland)';
} elseif ($region === 'UK') {
    $shipAllowed = ['GB'];
    $shipAmount  = 700;                 // €7.00
    $shipLabel   = 'Standard shipping (UK)';
} elseif ($region === 'EU') {
    $shipAllowed = $EU;                 // rest of the EU — Ireland has its own rate above
    $shipAmount  = 900;                 // €9.00
    $shipLabel   = 'Standard shipping (EU)';
} else {
    http_response_code(400);
    echo json_encode(['error' => 'For delivery outside Ireland, the UK and the EU, message SMO on Instagram for a postage quote.']);
    exit;
}

/* A cart holding ONLY freeShipping items ships free — the €1 test item
   uses this so a live payment test costs exactly €1. */
if (!$needsShipping) {
    $shipAmount = 0;
    $shipLabel  = 'Free shipping';
}

/* ---- create the Checkout Session via Stripe REST API ---- */
$origin  = (isset($_SERVER['HTTPS']) ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'];
$payload = [
    'mode'        => 'payment',
    'success_url' => $origin . '/success.html?session_id={CHECKOUT_SESSION_ID}',
    'cancel_url'  => $origin . '/checkout.html',
    'shipping_address_collection' => ['allowed_countries' => $shipAllowed],
    'shipping_options' => [[
        'shipping_rate_data' => [
            'type'         => 'fixed_amount',
            'fixed_amount' => ['amount' => $shipAmount, 'currency' => 'eur'],
            'display_name' => $shipLabel,
        ],
    ]],
    'line_items' => $lineItems,
];

/* Stripe expects form-encoded, with nested arrays — http_build_query handles it */
$ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_USERPWD        => $STRIPE_SECRET . ':',
    CURLOPT_POSTFIELDS     => http_build_query($payload),
]);
$res  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$session = json_decode($res, true);
if ($code === 200 && isset($session['url'])) {
    /* Private attempt log — every checkout STARTED, whether or not it completes.
       Confirmed (paid) orders are logged + emailed separately by order-confirm.php.
       Deliberately fail-safe: if the log helper is missing, checkout still works. */
    @include_once __DIR__ . '/smo-log.php';
    if (function_exists('smo_log')) smo_log('attempts.log', [
        'time'    => gmdate('c'),
        'type'    => 'attempt',
        'session' => $session['id'] ?? '',
        'region'  => $region,
        'items'   => array_map(function ($li) {
            return ['name' => $li['price_data']['product_data']['name'], 'qty' => $li['quantity']];
        }, $lineItems),
        'goods'   => array_sum(array_map(function ($li) {
            return $li['price_data']['unit_amount'] * $li['quantity'];
        }, $lineItems)) / 100,
        'shipping' => $shipAmount / 100,
    ]);
    echo json_encode(['url' => $session['url']]);
} else {
    http_response_code(502);
    echo json_encode(['error' => $session['error']['message'] ?? 'Stripe error']);
}
