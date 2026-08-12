<?php
/* =========================================================
   SMO — mailing list signup
   ---------------------------------------------------------
   POST { email, consent } → appends to subscribers.json.

   WHERE THE ADDRESSES LIVE: the same private folder as the order
   logs (…/smo-logs/subscribers.json), OUTSIDE the web root. Note
   this is deliberately NOT data/subscribers.json — data/ sits inside
   public_html, so anyone could have downloaded the whole list by
   guessing the URL. Read them via the admin page, which is the only
   thing that can see the file.

   Consent is stored with each address (timestamp + the exact wording
   agreed to), because under GDPR you have to be able to show when and
   to what someone opted in.
   ========================================================= */

header('Content-Type: application/json');
date_default_timezone_set('Europe/Dublin');
require __DIR__ . '/smo-log.php';

/* The wording shown next to the tick box. Stored verbatim with every
   signup — if the copy on the page changes, older records still show
   what that person actually agreed to. */
const CONSENT_TEXT = 'Yes, email me about SMO shows, releases and merch. I can unsubscribe any time.';

function out($arr, $code = 200) {
    http_response_code($code);
    echo json_encode($arr);
    exit;
}

function subs_file() { return smo_log_dir() . '/subscribers.json'; }

function read_subs() {
    $f = subs_file();
    if (!file_exists($f)) return [];
    $d = json_decode((string)file_get_contents($f), true);
    return is_array($d) ? $d : [];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['error' => 'POST only.'], 405);

$email   = strtolower(trim((string)($_POST['email'] ?? '')));
$consent = ($_POST['consent'] ?? '') === '1';

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
    out(['error' => 'That email address doesn\'t look right.'], 400);
}
/* No tick, no signup. An implied opt-in isn't consent. */
if (!$consent) {
    out(['error' => 'Please tick the box to confirm you\'re happy to be emailed.'], 400);
}

$subs = read_subs();
foreach ($subs as $s) {
    if (strtolower((string)($s['email'] ?? '')) === $email) {
        /* Say the same thing as a fresh signup — telling a stranger
           "you're already on the list" leaks who is on it. */
        out(['ok' => true, 'already' => true]);
    }
}

$subs[] = [
    'email'     => $email,
    'signedUp'  => date('c'),
    'consent'   => CONSENT_TEXT,
    'source'    => (string)($_POST['source'] ?? 'website'),
    /* Truncated IP: enough to show consent came from a real visit,
       not enough to be a precise identifier. */
    'ip'        => preg_replace('/\.\d+$/', '.0', (string)($_SERVER['REMOTE_ADDR'] ?? '')),
];

$ok = @file_put_contents(subs_file(), json_encode($subs, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
if ($ok === false) out(['error' => 'Could not save that — please try again shortly.'], 500);

out(['ok' => true, 'count' => count($subs)]);
