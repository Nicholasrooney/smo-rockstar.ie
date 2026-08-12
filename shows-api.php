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

require_once __DIR__ . '/content.php';   // smo_cut() + shared helpers
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
   can't make your browser post here on your behalf. Accepted from the query
   string too, because the CSV export has to work as a plain download link. */
$token = $_POST['csrf'] ?? $_GET['csrf'] ?? '';
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
            'name'       => smo_cut($name, 120),
            'venue'      => smo_cut(trim((string)($s['venue'] ?? '')), 160),
            'date'       => smo_cut($date, 32),
            'price'      => smo_cut(trim((string)($s['price'] ?? '')), 16),
            'ticketLink' => smo_cut($link, 400),
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

/* ---- site content: products, releases, gallery, page copy ----
   One endpoint for the collections the admin edits. Everything is rebuilt
   field by field rather than written as posted: these files are rendered
   straight into the public pages, so anything unexpected in them would end
   up in the HTML. Image paths must point inside assets/ — no remote URLs,
   no traversal. */
if ($action === 'get-data' || $action === 'save-data') {
    $type = (string)($_POST['type'] ?? $_GET['type'] ?? '');
    if (!in_array($type, ['products', 'releases', 'gallery', 'content'], true)) {
        fail('Unknown content type.');
    }
    $file = __DIR__ . '/data/' . $type . '.json';

    if ($action === 'get-data') {
        $d = is_file($file) ? json_decode((string)file_get_contents($file), true) : null;
        echo json_encode(['data' => $d ?: ($type === 'content' ? new stdClass : [])]);
        exit;
    }

    $in = json_decode((string)($_POST['json'] ?? ''), true);
    if (!is_array($in)) fail('Bad data.');

    /* Only our own images, and nothing that climbs out of assets/. */
    $img = function ($v) {
        $v = trim((string)$v);
        return (preg_match('#^assets/[A-Za-z0-9._/-]+\.(jpg|jpeg|png|webp)$#i', $v) && strpos($v, '..') === false)
            ? $v : '';
    };
    $url = function ($v) {
        $v = trim((string)$v);
        if ($v === '') return '';
        if (!preg_match('#^https?://#i', $v)) $v = 'https://' . $v;
        return smo_cut($v, 400);
    };
    $txt = function ($v, $max = 400) { return smo_cut(trim((string)$v), $max); };

    $clean = [];
    $problems = [];

    if ($type === 'products') {
        foreach ($in as $n => $p) {
            $title = $txt($p['title'] ?? '', 120);
            if ($title === '') { $problems[] = 'Product ' . ($n + 1) . ' has no name.'; continue; }
            $cents = (int)round((float)($p['price'] ?? 0) * 100);
            if ($cents <= 0) { $problems[] = '"' . $title . '" needs a price above zero.'; continue; }
            $id = preg_replace('/[^a-z0-9-]/', '', strtolower((string)($p['id'] ?? '')));
            if ($id === '') $id = 'item-' . bin2hex(random_bytes(4));
            $sizes = [];
            foreach ((array)($p['sizes'] ?? []) as $s) {
                $s = strtoupper($txt($s, 8));
                if ($s !== '' && count($sizes) < 12) $sizes[] = $s;
            }
            $clean[] = [
                'id' => $id, 'title' => $title, 'priceCents' => $cents, 'sizes' => $sizes,
                'image' => $img($p['image'] ?? ''), 'alt' => $txt($p['alt'] ?? $title, 160),
                'description' => $txt($p['description'] ?? '', 600),
            ];
        }
        /* A duplicate id would make two products share a price at checkout. */
        $ids = array_column($clean, 'id');
        if (count($ids) !== count(array_unique($ids))) $problems[] = 'Two products have the same ID.';
    }

    if ($type === 'releases') {
        foreach ($in as $n => $r) {
            $title = $txt($r['title'] ?? '', 120);
            if ($title === '') { $problems[] = 'Release ' . ($n + 1) . ' has no title.'; continue; }
            $id = preg_replace('/[^a-z0-9-]/', '', strtolower((string)($r['id'] ?? '')));
            if ($id === '') $id = preg_replace('/[^a-z0-9]+/', '-', strtolower($title));
            $clean[] = [
                'id' => trim($id, '-') ?: 'release-' . bin2hex(random_bytes(3)),
                'title' => $title,
                'meta' => $txt($r['meta'] ?? '', 60),
                'image' => $img($r['image'] ?? ''),
                'link' => $url($r['link'] ?? ''),
                'linkLabel' => $txt($r['linkLabel'] ?? 'Listen', 20) ?: 'Listen',
                'youtube' => $url($r['youtube'] ?? ''),
            ];
        }
    }

    if ($type === 'gallery') {
        foreach ($in as $g) {
            $src = $img($g['src'] ?? '');
            if ($src === '') continue;              // a photo with no file is nothing
            $clean[] = ['src' => $src, 'alt' => $txt($g['alt'] ?? '', 160), 'wide' => !empty($g['wide'])];
        }
    }

    if ($type === 'content') {
        $strs = function ($a, $max = 600) use ($txt) {
            $o = [];
            foreach ((array)$a as $v) { $v = $txt($v, $max); if ($v !== '') $o[] = $v; }
            return $o;
        };
        $clean = [
            'hero' => [
                'eyebrow' => $txt($in['hero']['eyebrow'] ?? '', 80),
                'sub'     => $txt($in['hero']['sub'] ?? '', 300),
            ],
            'ticker' => array_slice($strs($in['ticker'] ?? [], 60), 0, 20),
            'about' => [
                'kicker'      => $txt($in['about']['kicker'] ?? '', 60),
                'heading'     => $txt($in['about']['heading'] ?? '', 120),
                'paragraphs'  => array_slice($strs($in['about']['paragraphs'] ?? [], 1200), 0, 6),
                'stats'       => [],
                'imageMain'   => $img($in['about']['imageMain'] ?? ''),
                'imageAccent' => $img($in['about']['imageAccent'] ?? ''),
            ],
            'shopPreview' => [
                'kicker'  => $txt($in['shopPreview']['kicker'] ?? '', 60),
                'heading' => $txt($in['shopPreview']['heading'] ?? '', 120),
                'text'    => $txt($in['shopPreview']['text'] ?? '', 600),
                'price'   => $txt($in['shopPreview']['price'] ?? '', 20),
                'image'   => $img($in['shopPreview']['image'] ?? ''),
            ],
            'mailingList' => [
                'kicker'  => $txt($in['mailingList']['kicker'] ?? '', 60),
                'heading' => $txt($in['mailingList']['heading'] ?? '', 120),
                'text'    => $txt($in['mailingList']['text'] ?? '', 600),
            ],
            'shopPage' => [
                'kicker'       => $txt($in['shopPage']['kicker'] ?? '', 60),
                'heading'      => $txt($in['shopPage']['heading'] ?? '', 120),
                'shippingNote' => $txt($in['shopPage']['shippingNote'] ?? '', 600),
            ],
        ];
        foreach ((array)($in['about']['stats'] ?? []) as $s) {
            $num = $txt($s['num'] ?? '', 12);
            if ($num === '') continue;
            $clean['about']['stats'][] = ['num' => $num, 'label' => $txt($s['label'] ?? '', 60)];
        }
    }

    if ($problems) fail(implode(' ', $problems), 422);

    if (!is_dir(dirname($file))) @mkdir(dirname($file), 0755, true);
    $ok = @file_put_contents($file, json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
    if ($ok === false) fail('Could not write data/' . $type . '.json — check folder permissions.', 500);

    echo json_encode(['ok' => true, 'count' => is_array($clean) ? count($clean) : 1]);
    exit;
}

/* ---- mailing list ----
   Lives here rather than in its own file so it reuses the session and CSRF
   checks above. The addresses themselves are written by subscribe.php into
   the private log folder, outside the web root. */
if ($action === 'subs' || $action === 'subs-csv') {
    require_once __DIR__ . '/smo-log.php';
    $f = smo_log_dir() . '/subscribers.json';
    $subs = [];
    if (file_exists($f)) {
        $d = json_decode((string)file_get_contents($f), true);
        if (is_array($d)) $subs = $d;
    }
    /* Newest first — the useful order when you're checking who just joined. */
    $subs = array_reverse($subs);

    if ($action === 'subs') {
        echo json_encode(['subscribers' => $subs, 'count' => count($subs)]);
        exit;
    }

    /* CSV for pasting into Mailchimp or a spreadsheet later. */
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="smo-mailing-list-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['email', 'signed_up', 'source', 'consent']);
    foreach ($subs as $s) {
        fputcsv($out, [$s['email'] ?? '', $s['signedUp'] ?? '', $s['source'] ?? '', $s['consent'] ?? '']);
    }
    fclose($out);
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
