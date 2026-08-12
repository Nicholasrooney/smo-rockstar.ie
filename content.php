<?php
/* =========================================================
   SMO — content loader
   ---------------------------------------------------------
   Shared by index.php, shop.php and show.php. Everything the
   admin can edit is read from data/*.json here and rendered on
   the server, so search engines get the real text — rendering
   this copy in the browser would leave Google looking at an
   empty page.

   Every read falls back to a default. A missing or malformed
   file should never blank a section of the live site.
   ========================================================= */

function smo_json($name, $fallback = []) {
    $f = __DIR__ . '/data/' . basename($name) . '.json';
    if (!is_file($f)) return $fallback;
    $d = json_decode((string)@file_get_contents($f), true);
    return (is_array($d) && $d !== []) ? $d : $fallback;
}

function smo_content() {
    static $c = null;
    if ($c === null) $c = smo_json('content');
    return $c;
}

/* Pull a nested value: smo_text('about.kicker', 'The Band') */
function smo_text($path, $default = '') {
    $node = smo_content();
    foreach (explode('.', $path) as $k) {
        if (!is_array($node) || !array_key_exists($k, $node)) return $default;
        $node = $node[$k];
    }
    return is_scalar($node) ? $node : $default;
}

function smo_arr($path, $default = []) {
    $node = smo_content();
    foreach (explode('.', $path) as $k) {
        if (!is_array($node) || !array_key_exists($k, $node)) return $default;
        $node = $node[$k];
    }
    return is_array($node) ? $node : $default;
}

/* mbstring is present on Hostinger and everywhere this runs, but a host that
   lacks it would otherwise fatal the whole admin on the first save. Fall back
   to plain substr — slightly blunt on multi-byte text, still safe. */
function smo_cut($v, $max) {
    return function_exists('mb_substr') ? mb_substr((string)$v, 0, $max) : substr((string)$v, 0, $max);
}

function h($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

/* Editors type plain text. Newlines become <br> so a two-line heading
   works, and nothing else in what they typed is treated as markup. */
function h_lines($v) { return nl2br(h($v), false); }

function smo_price($cents) {
    $cents = (int)$cents;
    return $cents % 100 === 0 ? '€' . intdiv($cents, 100) : '€' . number_format($cents / 100, 2);
}
