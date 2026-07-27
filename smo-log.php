<?php
/* =========================================================
   SMO — shared private-log helper
   ---------------------------------------------------------
   Order/attempt logs are written OUTSIDE the web root when the
   host allows it (…/smo-logs next to stripe-secret.php).
   If that isn't writable we fall back to public_html/logs and
   drop a "Require all denied" .htaccess in it so the files are
   never web-readable either way.
   ========================================================= */

function smo_log_dir() {
    $above = dirname(__DIR__) . '/smo-logs';               // not web-accessible (preferred)
    if (is_dir($above) || @mkdir($above, 0755)) return $above;
    $local = __DIR__ . '/logs';                            // fallback inside web root, access denied
    if (!is_dir($local)) @mkdir($local, 0755);
    if (!file_exists($local . '/.htaccess')) {
        @file_put_contents($local . '/.htaccess', "Require all denied\n");
    }
    return $local;
}

/* Append one JSON line to a named log file (e.g. orders.log / attempts.log). */
function smo_log($file, $record) {
    @file_put_contents(smo_log_dir() . '/' . $file, json_encode($record) . "\n", FILE_APPEND | LOCK_EX);
}
