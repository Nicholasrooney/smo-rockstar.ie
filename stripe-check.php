<?php
/* =========================================================
   SMO — Stripe health check (private)
   ---------------------------------------------------------
   Visit:  https://smo-rockstar.ie/stripe-check.php?token=smo-check-7k2rp9wq
   Tells you, without needing Stripe dashboard access, whether the
   deployed secret key belongs to a properly-set-up account:
     • key file found (and where)
     • LIVE or TEST key
     • account name / country / currency
     • charges_enabled  — can it take payments?
     • payouts_enabled  — can it pay out to a bank?
   Read-only: makes one GET /v1/account call, changes nothing.
   ========================================================= */

$TOKEN = 'smo-check-7k2rp9wq';
if (!isset($_GET['token']) || !hash_equals($TOKEN, (string)$_GET['token'])) {
    http_response_code(403);
    exit('Forbidden');
}
header('Content-Type: text/html; charset=UTF-8');

function row($ok, $label, $detail = '') {
    $icon = $ok === null ? '•' : ($ok ? '✅' : '❌');
    echo "<tr><td style='padding:6px 12px'>$icon</td><td style='padding:6px 12px'><b>" .
         htmlspecialchars($label) . "</b></td><td style='padding:6px 12px'>" .
         htmlspecialchars($detail) . "</td></tr>";
}

echo "<!DOCTYPE html><html><head><title>SMO — Stripe check</title></head>
<body style='font-family:sans-serif;max-width:720px;margin:40px auto'>
<h2>SMO — Stripe health check</h2><table>";

/* ---- 1. find the secret key (same lookup as checkout.php) ---- */
$candidates = [dirname(__DIR__) . '/stripe-secret.php', __DIR__ . '/stripe-secret.php'];
$STRIPE_SECRET = null; $keyPath = '';
foreach ($candidates as $f) { if (file_exists($f)) { $STRIPE_SECRET = require $f; $keyPath = $f; break; } }

if (!$STRIPE_SECRET) {
    row(false, 'Secret key file', 'stripe-secret.php not found — checkout is OFF');
    echo '</table></body></html>'; exit;
}
row(true, 'Secret key file', 'found at ' . basename(dirname($keyPath)) . '/stripe-secret.php');

$isLive = strpos($STRIPE_SECRET, 'sk_live_') === 0;
$isTest = strpos($STRIPE_SECRET, 'sk_test_') === 0;
if ($isLive)      row(true,  'Key mode', 'LIVE — real payments');
elseif ($isTest)  row(null,  'Key mode', 'TEST — no real money (use card 4242 4242 4242 4242)');
else              row(false, 'Key mode', 'not an sk_live_/sk_test_ key — wrong value in the file?');

/* ---- 2. ask Stripe about the account this key belongs to ---- */
$ch = curl_init('https://api.stripe.com/v1/account');
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_USERPWD => $STRIPE_SECRET . ':']);
$res  = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$a = json_decode($res, true);

if ($code !== 200 || !isset($a['id'])) {
    row(false, 'Key accepted by Stripe', $a['error']['message'] ?? "HTTP $code — key may be revoked or mistyped");
    echo '</table></body></html>'; exit;
}
row(true, 'Key accepted by Stripe', 'account ' . $a['id']);

$name = $a['business_profile']['name']
     ?? ($a['settings']['dashboard']['display_name'] ?? '(no name set)');
row(null, 'Account name', $name . '  —  ' . strtoupper($a['country'] ?? '?') .
    ', payouts in ' . strtoupper($a['default_currency'] ?? '?'));
row((bool)($a['charges_enabled'] ?? false),  'Can take payments (charges_enabled)',
    ($a['charges_enabled'] ?? false) ? 'yes' : 'NO — account not activated / verification incomplete');
row((bool)($a['payouts_enabled'] ?? false),  'Can pay out to bank (payouts_enabled)',
    ($a['payouts_enabled'] ?? false) ? 'yes' : 'NO — add/verify a bank account in Stripe');
row((bool)($a['details_submitted'] ?? false), 'Business details submitted',
    ($a['details_submitted'] ?? false) ? 'yes' : 'NO — activation form not finished');

/* ---- 3. local checks the checkout also depends on ---- */
$prods = json_decode((string)@file_get_contents(__DIR__ . '/data/products.json'), true);
if (is_array($prods)) {
    $sellable = count(array_filter($prods, function ($p) { return !empty($p['priceCents']) && $p['priceCents'] > 0; }));
    row(true, 'Products', count($prods) . ' products, ' . $sellable . ' purchasable');
} else {
    row(false, 'Products', 'data/products.json missing or unreadable — checkout will fail');
}
row(function_exists('curl_init'), 'PHP curl', function_exists('curl_init') ? 'available' : 'missing');
row(function_exists('mail'), 'PHP mail()', function_exists('mail') ? 'available (order emails)' : 'missing — order emails will not send');

echo "</table>
<p style='color:#666;margin-top:24px'>All good = every row ✅ (Key mode may be • in test).
If <b>charges_enabled</b> is ❌ the Stripe account still needs to be activated by its owner
(business details + bank account) before the site can take money.</p>
</body></html>";
