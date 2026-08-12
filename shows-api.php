<?php
/* =========================================================
   SMO — shows API
   ---------------------------------------------------------
   GET   ?action=list     public. Returns data/shows.json.
   POST  action=save      admin only. Replaces the whole list.
   POST  action=upload    admin only. Accepts one show photo.
   POST  action=login     sets the admin session.
   POST  action=logout    clears it.

   Deliberately a flat JSON file rather than a database: there are
   a handful of gigs, they change rarely, and it means the site has
   no external dependency to keep alive.

   The password lives in admin-secret.php, which is git-ignored —
   this repo is PUBLIC, so it must never be committed. Until that
   file exists the admin stays locked and says so.
   ========================================================= */

session_start();
header('Content-Type: application/json');

define('SHOWS_FILE', __DIR__ . '/data/shows.json');
define('UPLOAD_DIR', __DIR__ . '/assets/images/shows');

/* ---- the admin password: same lookup pattern as stripe-secret.php ---- */
function admin_password() {
    foreach ([dirname(__DIR__) . '/admin-secret.php', __DIR__ . '/admin-secret.php'] as $f) {
        if (file_exists($f)) return require $f;
    }
    return null;
}

function is_admin() { return !empty($_SESSION['smo_admin']); }

function fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

function read_shows() {
    if (!file_exists(SHOWS_FILE)) return [];
    $data = json_decode((string)file_get_contents(SHOWS_FILE), true);
    return is_array($data) ? $data : [];
}

$action = $_POST['action'] ?? $_GET['action'] ?? 'list';

/* ============ PUBLIC ============ */

if ($action === 'list') {
    /* Past gigs are filtered client-side so the admin can still see them. */
    echo json_encode(['shows' => read_shows()]);
    exit;
}

/* ============ AUTH ============ */

if ($action === 'login') {
    $pw = admin_password();
    if ($pw === null) fail('Admin is not set up yet — admin-secret.php is missing on the server.', 503);

    /* Slow down guessing. Crude, but this is a one-password admin. */
    usleep(400000);

    if (!hash_equals((string)$pw, (string)($_POST['password'] ?? ''))) {
        fail('Wrong password.', 401);
    }
    session_regenerate_id(true);              // don't let a pre-set session id be reused
    $_SESSION['smo_admin'] = true;
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
    echo json_encode(['ok' => true, 'csrf' => $_SESSION['csrf']]);
    exit;
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    echo json_encode(['ok' => true]);
    exit;
}

if ($action === 'session') {
    echo json_encode([
        'admin'    => is_admin(),
        'csrf'     => $_SESSION['csrf'] ?? null,
        'setUp'    => admin_password() !== null,
    ]);
    exit;
}

/* ============ EVERYTHING BELOW NEEDS THE SESSION ============ */

if (!is_admin()) fail('Not signed in.', 401);

/* Every write also carries the token issued at login, so another site
   can't make your browser post here on your behalf. */
$token = $_POST['csrf'] ?? '';
if (!hash_equals((string)($_SESSION['csrf'] ?? ''), (string)$token)) {
    fail('Session expired — please sign in again.', 403);
}

if ($action === 'save') {
    $incoming = json_decode((string)($_POST['shows'] ?? ''), true);
    if (!is_array($incoming)) fail('Bad show data.');

    /* Rebuild each row rather than trusting what was posted, so nothing
       unexpected ends up in the file that the homepage then renders. */
    $clean = [];
    /* A show with no name or no date used to be dropped here in silence, so
       the editor saw "Saved" and then nothing on the site. Collect the
       reasons and refuse the save instead. */
    $problems = [];
    foreach ($incoming as $n => $s) {
        $photos = [];
        foreach ((array)($s['photos'] ?? []) as $p) {
            $p = trim((string)$p);
            /* Only ever our own images — no remote URLs, no path traversal. */
            if (preg_match('#^assets/images/[A-Za-z0-9._/-]+\.(jpg|jpeg|png|webp)$#i', $p)
                && strpos($p, '..') === false) {
                $photos[] = $p;
            }
            if (count($photos) >= 3) break;
        }
        $name = trim((string)($s['name'] ?? ''));
        $date = trim((string)($s['date'] ?? ''));
        $where = $name !== '' ? '"' . $name . '"' : 'show ' . ($n + 1);

        if ($name === '') { $problems[] = 'Show ' . ($n + 1) . ' has no name.'; continue; }
        /* No date means the homepage can't place it and silently hides it. */
        if ($date === '') { $problems[] = $where . ' has no date — add one or delete the show.'; continue; }
        if (strtotime($date) === false) { $problems[] = $where . ' has a date that isn\'t valid.'; continue; }

        $link = trim((string)($s['ticketLink'] ?? ''));
        if ($link !== '' && !preg_match('#^https?://#i', $link)) $link = 'https://' . $link;

        $clean[] = [
            'id'         => preg_replace('/[^a-z0-9-]/i', '', (string)($s['id'] ?? '')) ?: bin2hex(random_bytes(8)),
            'name'       => mb_substr($name, 0, 120),
            'venue'      => mb_substr(trim((string)($s['venue'] ?? '')), 0, 160),
            'date'       => mb_substr($date, 0, 32),
            'price'      => mb_substr(trim((string)($s['price'] ?? '')), 0, 16),
            'ticketLink' => mb_substr($link, 0, 400),
            'photos'     => $photos,
        ];
    }

    /* Nothing is written if any row is unusable — a partial save that
       quietly discards a gig is worse than no save at all. */
    if ($problems) fail(implode(' ', $problems), 422);

    /* Sort by date so the homepage doesn't have to. */
    usort($clean, function ($a, $b) { return strcmp($a['date'], $b['date']); });

    if (!is_dir(dirname(SHOWS_FILE))) @mkdir(dirname(SHOWS_FILE), 0755, true);
    $ok = @file_put_contents(SHOWS_FILE, json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
    if ($ok === false) fail('Could not write data/shows.json — check folder permissions on the server.', 500);

    echo json_encode(['ok' => true, 'count' => count($clean)]);
    exit;
}

if ($action === 'upload') {
    if (empty($_FILES['photo'])) fail('No file received.');
    $f = $_FILES['photo'];
    if ($f['error'] !== UPLOAD_ERR_OK) fail('Upload failed (code ' . $f['error'] . ').');
    if ($f['size'] > 6 * 1024 * 1024) fail('That image is over 6MB — please use a smaller one.');

    /* Trust the actual image content, not the filename or the browser's
       content-type. getimagesize fails on anything that isn't a real image. */
    $info = @getimagesize($f['tmp_name']);
    if ($info === false) fail('That file is not an image.');
    $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2]] ?? null;
    if ($ext === null) fail('Please use a JPG, PNG or WebP.');

    if (!is_dir(UPLOAD_DIR) && !@mkdir(UPLOAD_DIR, 0755, true)) {
        fail('Could not create the uploads folder on the server.', 500);
    }
    /* Our own random name — an uploaded filename is never used on disk. */
    $name = 'show-' . bin2hex(random_bytes(6)) . '.' . $ext;
    if (!@move_uploaded_file($f['tmp_name'], UPLOAD_DIR . '/' . $name)) {
        fail('Could not save the file on the server.', 500);
    }
    @chmod(UPLOAD_DIR . '/' . $name, 0644);

    echo json_encode(['ok' => true, 'path' => 'assets/images/shows/' . $name]);
    exit;
}

fail('Unknown action.');
