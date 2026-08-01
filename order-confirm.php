<?php
/* =========================================================
   SMO — order confirmation endpoint
   ---------------------------------------------------------
   success.html posts { session_id } here after Stripe redirects
   the customer back. We then:
     1. Look the session up on Stripe using the SERVER's secret
        key — so a browser can never fake a sale.
     2. Only proceed if payment_status is "paid".
     3. Append the order to a private log file (orders.log).
     4. Email the order details to the band.
   Duplicate-safe: refreshing the thank-you page won't re-email —
   each session id is only ever recorded once.

   This gives full sales visibility WITHOUT Stripe dashboard
   access. (Known gap: if a customer pays but never returns to
   the thank-you page, no email fires — closing that needs a
   Stripe webhook, which needs dashboard access to configure.)
   ========================================================= */

header('Content-Type: application/json');
date_default_timezone_set('Europe/Dublin');
require __DIR__ . '/smo-log.php';

/* ---- who gets the "new order" email ----
   Deliberately the domain addresses rather than anyone's personal Gmail:
   this repo is public, and both of these forward on via Cloudflare Email
   Routing. It also means changing who gets order alerts is a Cloudflare
   change, not a code change and redeploy. */
$NOTIFY = 'info@smo-rockstar.ie, sam@smo-rockstar.ie';
$FROM   = 'SMO Orders <orders@smo-rockstar.ie>';   // must be the Hostinger domain (SPF-aligned)

/* ---- secret key: same lookup as checkout.php ---- */
$candidates = [dirname(__DIR__) . '/stripe-secret.php', __DIR__ . '/stripe-secret.php'];
$STRIPE_SECRET = null;
foreach ($candidates as $f) { if (file_exists($f)) { $STRIPE_SECRET = require $f; break; } }
if (!$STRIPE_SECRET) {
    http_response_code(503);
    echo json_encode(['error' => 'Checkout not configured yet.']);
    exit;
}

/* ---- read + sanity-check the posted session id ---- */
$body = json_decode(file_get_contents('php://input'), true);
$sid  = isset($body['session_id']) ? trim((string)$body['session_id']) : '';
if (!preg_match('/^cs_(live|test)_[A-Za-z0-9]+$/', $sid)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid session id']);
    exit;
}

/* ---- duplicate guard: one email per session, ever ---- */
$ordersLog = smo_log_dir() . '/orders.log';
if (file_exists($ordersLog) && strpos((string)file_get_contents($ordersLog), $sid) !== false) {
    echo json_encode(['ok' => true, 'duplicate' => true]);
    exit;
}

/* ---- verify with Stripe (server-side — tamper-proof) ---- */
$ch = curl_init('https://api.stripe.com/v1/checkout/sessions/' . urlencode($sid) . '?expand[]=line_items');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_USERPWD        => $STRIPE_SECRET . ':',
]);
$res  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$s = json_decode($res, true);
if ($code !== 200 || !isset($s['id'])) {
    http_response_code(502);
    echo json_encode(['error' => 'Stripe lookup failed']);
    exit;
}
if (($s['payment_status'] ?? '') !== 'paid') {
    echo json_encode(['ok' => false, 'payment_status' => $s['payment_status'] ?? 'unknown']);
    exit;
}

/* ---- pull the useful bits out of the session ---- */
$cust = $s['customer_details'] ?? [];
/* shipping details moved between Stripe API versions — check both spots */
$ship = $s['shipping_details'] ?? ($s['collected_information']['shipping_details'] ?? []);
$addr = $ship['address'] ?? ($cust['address'] ?? []);

$items = [];
foreach (($s['line_items']['data'] ?? []) as $li) {
    $items[] = [
        'name'  => $li['description'] ?? '?',
        'qty'   => (int)($li['quantity'] ?? 1),
        'total' => ((int)($li['amount_total'] ?? 0)) / 100,
    ];
}

$order = [
    'time'     => date('c'),
    'type'     => 'order',
    'session'  => $s['id'],
    'livemode' => (bool)($s['livemode'] ?? true),
    'currency' => strtoupper($s['currency'] ?? 'eur'),
    'total'    => ((int)($s['amount_total'] ?? 0)) / 100,
    'shipping' => ((int)($s['shipping_cost']['amount_total'] ?? 0)) / 100,
    'customer' => [
        'name'  => $ship['name'] ?? ($cust['name'] ?? ''),
        'email' => $cust['email'] ?? '',
    ],
    'address'  => [
        'line1'   => $addr['line1'] ?? '',
        'line2'   => $addr['line2'] ?? '',
        'city'    => $addr['city'] ?? '',
        'postal'  => $addr['postal_code'] ?? '',
        'country' => $addr['country'] ?? '',
    ],
    'items'    => $items,
];

/* ---- 1) log it ---- */
smo_log('orders.log', $order);

/* ---- 2) email it ---- */
$mode    = $order['livemode'] ? '' : ' [TEST MODE]';
$total   = number_format($order['total'], 2);
$subject = "New SMO merch order — €{$total}{$mode}";

$lines   = [];
$lines[] = "New order on smo-rockstar.ie{$mode}";
$lines[] = '';
$lines[] = 'When:     ' . date('D j M Y, H:i') . ' (Dublin)';
$lines[] = 'Customer: ' . trim($order['customer']['name'] . ' <' . $order['customer']['email'] . '>');
$lines[] = 'Ship to:  ' . implode(', ', array_filter([
    $order['address']['line1'], $order['address']['line2'],
    $order['address']['city'], $order['address']['postal'], $order['address']['country'],
]));
$lines[] = '';
$lines[] = 'Items:';
foreach ($order['items'] as $i) {
    $lines[] = '  ' . $i['qty'] . ' × ' . $i['name'] . ' — €' . number_format($i['total'], 2);
}
$lines[] = 'Shipping: €' . number_format($order['shipping'], 2);
$lines[] = 'Total:    €' . $total . ' ' . $order['currency'];
$lines[] = '';
$lines[] = 'Stripe session: ' . $order['session'];
$lines[] = '(Payment was verified as PAID with Stripe before this email was sent.)';

$headers = 'From: ' . $FROM . "\r\n"
         . (!empty($order['customer']['email']) ? 'Reply-To: ' . $order['customer']['email'] . "\r\n" : '')
         . "Content-Type: text/plain; charset=UTF-8\r\n";
/* UTF-8-safe subject (it contains €) */
$encSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$sent = @mail($NOTIFY, $encSubject, implode("\n", $lines), $headers);

echo json_encode(['ok' => true, 'emailed' => (bool)$sent]);
