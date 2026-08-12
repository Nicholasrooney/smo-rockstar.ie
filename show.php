<?php
/* =========================================================
   SMO — single gig page
   ---------------------------------------------------------
   show.php?id=<id> — one page per gig, rendered on the server
   rather than in the browser so Google can actually read it.
   A gig page that ranks for "SMO Whelans tickets" is worth more
   than a tidier client-side render.
   ========================================================= */

$shows = json_decode((string)@file_get_contents(__DIR__ . '/data/shows.json'), true);
if (!is_array($shows)) $shows = [];

$id   = isset($_GET['id']) ? (string)$_GET['id'] : '';
$show = null;
foreach ($shows as $s) {
    if (($s['id'] ?? '') === $id) { $show = $s; break; }
}

if ($show === null) {
    http_response_code(404);
}

function e($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }

$name  = $show['name']  ?? '';
$venue = $show['venue'] ?? '';
$ts    = $show ? strtotime((string)($show['date'] ?? '')) : false;
$price = trim((string)($show['price'] ?? ''));
$free  = ($price === '' || $price === '0');
$link  = trim((string)($show['ticketLink'] ?? ''));
$photos = array_values(array_filter((array)($show['photos'] ?? [])));

/* A gig is "past" from the day after it happens — same rule the homepage uses. */
$isPast = $ts !== false && $ts < strtotime('today');

$title = $show ? "$name — SMO live" . ($venue !== '' ? " at $venue" : '') : 'Show not found — SMO';
$desc  = $show
    ? trim('SMO live' . ($venue !== '' ? " at $venue" : '') .
           ($ts !== false ? ' on ' . date('l j F Y', $ts) : '') . '.')
    : 'This gig is no longer listed.';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= e($title) ?></title>
  <meta name="description" content="<?= e($desc) ?>">
<?php if (!$show || $isPast): ?>
  <meta name="robots" content="noindex">
<?php endif; ?>
  <link rel="canonical" href="https://smo-rockstar.ie/show.php?id=<?= e($id) ?>">
  <meta property="og:title" content="<?= e($title) ?>">
  <meta property="og:description" content="<?= e($desc) ?>">
<?php if ($photos): ?>
  <meta property="og:image" content="https://smo-rockstar.ie/<?= e($photos[0]) ?>">
<?php endif; ?>
  <link rel="stylesheet" href="assets/css/style.css?v=11">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>★</text></svg>">
<?php if ($show && $ts !== false): ?>
  <script type="application/ld+json">
  <?= json_encode([
    '@context' => 'https://schema.org',
    '@type'    => 'MusicEvent',
    'name'     => $name . ' — SMO',
    'startDate'=> date('c', $ts),
    'eventStatus' => 'https://schema.org/EventScheduled',
    'location' => ['@type' => 'Place', 'name' => $venue,
                   'address' => ['@type' => 'PostalAddress', 'addressLocality' => 'Dublin', 'addressCountry' => 'IE']],
    'performer'=> ['@type' => 'MusicGroup', 'name' => 'SMO'],
    'url'      => 'https://smo-rockstar.ie/show.php?id=' . $id,
  ] + ($photos ? ['image' => 'https://smo-rockstar.ie/' . $photos[0]] : [])
    + ($link ? ['offers' => ['@type' => 'Offer', 'url' => $link,
                             'price' => $free ? '0' : $price, 'priceCurrency' => 'EUR',
                             'availability' => 'https://schema.org/InStock']] : []),
    JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>
  </script>
<?php endif; ?>
</head>
<body>

<nav>
  <a href="index.html" class="nav-logo"><span class="star">★</span>SMO</a>
  <ul class="nav-links">
    <li><a href="index.html#shows">Shows</a></li>
    <li><a href="index.html#music">Music</a></li>
    <li><a href="shop.html" class="btn-nav">Shop</a></li>
  </ul>
</nav>

<?php if (!$show): ?>

  <div class="page-hero">
    <span class="section-label">Not Found</span>
    <h1>No Such<br>Show</h1>
  </div>
  <div style="text-align:center;padding:0 24px 120px">
    <p style="color:var(--light-grey);max-width:420px;margin:0 auto 32px;line-height:1.9">
      This gig has either been taken down or the link is wrong.
    </p>
    <a href="index.html#shows" class="btn btn-primary">See upcoming shows</a>
  </div>

<?php else: ?>

  <div class="page-hero" style="padding-bottom:32px">
    <span class="section-label"><?= $isPast ? 'Past Show' : 'Live' ?></span>
    <h1><?= e($name) ?></h1>
  </div>

  <div class="gig">
    <div class="gig-facts">
      <?php if ($ts !== false): ?>
      <div class="gig-fact">
        <span class="k">Date</span>
        <span class="v"><?= e(date('l j F Y', $ts)) ?></span>
      </div>
      <div class="gig-fact">
        <span class="k">Doors</span>
        <span class="v"><?= e(date('H:i', $ts)) ?></span>
      </div>
      <?php endif; ?>
      <?php if ($venue !== ''): ?>
      <div class="gig-fact">
        <span class="k">Venue</span>
        <span class="v"><?= e($venue) ?></span>
      </div>
      <?php endif; ?>
      <div class="gig-fact">
        <span class="k">Tickets</span>
        <span class="v"><?= $free ? 'Free entry' : '€' . e($price) ?></span>
      </div>
    </div>

    <?php if ($isPast): ?>
      <p class="gig-past">This one's already happened.</p>
    <?php elseif ($link !== ''): ?>
      <a href="<?= e($link) ?>" target="_blank" rel="noopener"
         class="btn btn-primary btn-buy" style="max-width:420px">Get Tickets →</a>
    <?php else: ?>
      <p class="gig-past">No ticket link yet — check back, or follow
        <a href="https://www.instagram.com/smo_rockstar" target="_blank" rel="noopener">@smo_rockstar</a>.</p>
    <?php endif; ?>

    <?php if ($photos): ?>
    <div class="gig-gallery">
      <?php foreach ($photos as $i => $p): ?>
        <img src="<?= e($p) ?>" alt="SMO<?= $venue !== '' ? ' at ' . e($venue) : '' ?>"
             loading="<?= $i === 0 ? 'eager' : 'lazy' ?>">
      <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <a href="index.html#shows" class="gig-back">← All shows</a>
  </div>

<?php endif; ?>

<footer>
  <div class="footer-bottom">
    <span>© 2025 SMO. All rights reserved.</span>
    <span><a href="legal.html#cookies">Cookies</a> &nbsp;·&nbsp; <a href="legal.html#privacy">Privacy</a> &nbsp;·&nbsp; <a href="#" data-cookie-settings>Cookie settings</a></span>
    <span>smo-rockstar.ie</span>
  </div>
</footer>

<script src="assets/js/cookie-consent.js?v=11" defer></script>

</body>
</html>
