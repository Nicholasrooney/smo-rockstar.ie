<?php require __DIR__ . '/content.php'; ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMO — Dublin</title>
  <meta name="description" content="SMO — Dublin alt-rock band. Live shows, music, merch.">
  <meta property="og:title" content="SMO">
  <meta property="og:description" content="Dublin alt-rock. Catch us live.">
  <meta property="og:image" content="assets/images/og-image.jpg">
  <link rel="canonical" href="https://smo-rockstar.ie/">
  <link rel="stylesheet" href="assets/css/style.css?v=11">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>★</text></svg>">
</head>
<body>

<!-- ── NAV ── -->
<nav>
  <a href="index.html" class="nav-logo"><span class="star">★</span>SMO</a>
  <button class="hamburger" aria-label="Menu">
    <span></span><span></span><span></span>
  </button>
  <ul class="nav-links">
    <li><a href="#shows">Shows</a></li>
    <li><a href="#music">Music</a></li>
    <li><a href="#about">About</a></li>
    <li><a href="shop.html" class="btn-nav">Shop</a></li>
    <li>
      <a href="shop.html" style="position:relative;display:flex;align-items:flex-start">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        <span class="cart-count">0</span>
      </a>
    </li>
  </ul>
</nav>


<!-- ── HERO ── -->
<section class="hero">
  <!-- Background video. Muted + playsinline are what let it autoplay on
       mobile; the poster paints instantly while the mp4 streams in, and
       stands in entirely if the browser refuses to autoplay. -->
  <video class="hero-video" autoplay muted loop playsinline preload="auto"
         poster="assets/images/hero-poster.jpg" aria-hidden="true" tabindex="-1">
    <source src="assets/video/hero.mp4" type="video/mp4">
  </video>
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <div class="hero-eyebrow"><?= h(smo_text('hero.eyebrow', 'Dublin, Ireland')) ?></div>
    <h1>SMO<span class="outline">.</span></h1>
    <p class="hero-sub"><?= h(smo_text('hero.sub', '')) ?></p>
    <div class="hero-actions">
      <a href="#shows" class="btn btn-primary">Upcoming Shows</a>
      <a href="#music" class="btn btn-outline">Listen Now</a>
    </div>
  </div>
</section>

<!-- ── TICKER ── -->
<div class="ticker">
  <div class="ticker-inner">
<?php $tick = smo_arr('ticker'); if ($tick):
        /* printed twice so the marquee loops without a visible seam */
        for ($pass = 0; $pass < 2; $pass++):
          foreach ($tick as $t): ?>
    <span><?= h($t) ?></span><span class="sep">&#9733;</span>
<?php   endforeach;
        endfor;
      endif; ?>
  </div>
</div>

<!-- ── FEATURED RELEASE ──
     Sits near the top while a release is new. FEATURED_RELEASE in main.js
     decides when it retires; the same track then appears in the grid below. -->
<section class="featured hidden" id="featured-release">
  <div class="featured-grid">
    <div class="featured-art">
      <img src="assets/images/release-white-flag.jpg" alt="White Flag — SMO" width="1000" height="1000">
    </div>
    <div class="featured-text">
      <span class="featured-tag" id="featured-tag">New Single</span>
      <h2>White<br>Flag</h2>
      <p id="featured-blurb">Out soon. Pre-save it now and it lands in your library the day it drops.</p>
      <div class="featured-actions">
        <a href="https://ditto.fm/white-flag-smo" target="_blank" rel="noopener"
           class="btn btn-primary btn-buy" id="featured-cta" style="width:auto">Pre-Save Now</a>
        <a href="#mailing-list" class="btn btn-outline">Get Release Alerts</a>
      </div>
      <p class="featured-date" id="featured-date"></p>
    </div>
  </div>
</section>

<!-- ── ABOUT ── -->
<section id="about">
  <div class="about-grid">
    <div class="about-images">
      <img src="<?= h(smo_text('about.imageMain', 'assets/images/about-main.jpg')) ?>" alt="Sam of SMO playing live" class="about-img-main">
      <img src="<?= h(smo_text('about.imageAccent', 'assets/images/about-accent.jpg')) ?>" alt="SMO live" class="about-img-accent">
    </div>
    <div class="about-text">
      <span class="section-label"><?= h(smo_text('about.kicker', 'The Band')) ?></span>
      <h2><?= h_lines(smo_text('about.heading', "Raw Sound.\nReal Energy.")) ?></h2>
<?php foreach (smo_arr('about.paragraphs') as $para): ?>
      <p><?= h($para) ?></p>
<?php endforeach; ?>
<?php $stats = smo_arr('about.stats'); if ($stats): ?>
      <div class="stat-row">
<?php foreach ($stats as $s): ?>
        <div class="stat-item">
          <div class="num"><?= h($s['num'] ?? '') ?></div>
          <div class="lbl"><?= h($s['label'] ?? '') ?></div>
        </div>
<?php endforeach; ?>
      </div>
<?php endif; ?>
    </div>
  </div>
</section>

<!-- ── SHOWS ── -->
<section id="shows">
  <div class="section-header">
    <span class="section-label">Live</span>
    <h2>Upcoming<br>Shows</h2>
  </div>
  <div class="shows-list" id="shows-list">
    <div class="no-shows" style="color:var(--grey);padding:40px 0;text-align:center;font-size:13px;letter-spacing:0.1em">Loading shows...</div>
  </div>
</section>

<!-- ── MUSIC ── -->
<section id="music">
  <div class="section-header">
    <span class="section-label">Music</span>
    <h2>Latest<br>Releases</h2>
  </div>
  <div class="releases-grid">
<?php foreach (smo_json('releases') as $r):
        $isFeatured = ($r['id'] ?? '') === 'white-flag';
        $link = $r['link'] ?? '#'; ?>
    <div class="release-card<?= $isFeatured ? ' hidden' : '' ?>"<?= $isFeatured ? ' id="white-flag-card"' : '' ?>>
      <div class="release-artwork">
        <img src="<?= h($r['image'] ?? '') ?>" alt="<?= h($r['title'] ?? '') ?>" loading="lazy">
        <div class="play-icon">▶</div>
      </div>
      <div class="release-info">
        <h3><a class="release-link" href="<?= h($link) ?>" target="_blank" rel="noopener"><?= h($r['title'] ?? '') ?></a></h3>
        <div class="meta"><?= h($r['meta'] ?? '') ?></div>
        <div class="release-links">
          <a href="<?= h($link) ?>" target="_blank" rel="noopener"><?= h($r['linkLabel'] ?? 'Listen') ?></a>
<?php if (!empty($r['youtube'])): ?>
          <a href="<?= h($r['youtube']) ?>" target="_blank" rel="noopener">YouTube</a>
<?php endif; ?>
        </div>
      </div>
    </div>
<?php endforeach; ?>
  </div>

  <div style="text-align:center;margin-top:48px">
    <a href="https://open.spotify.com/artist/5J9snBOPKK6GivDSJa1rO3" target="_blank" class="btn btn-outline">All Music on Spotify ↗</a>
  </div>
</section>

<!-- ── MAILING LIST ── -->
<section class="signup" id="mailing-list">
  <div class="signup-inner">
    <span class="section-label"><?= h(smo_text('mailingList.kicker', 'Mailing List')) ?></span>
    <h2><?= h_lines(smo_text('mailingList.heading', 'Know First.')) ?></h2>
    <p class="signup-blurb"><?= h(smo_text('mailingList.text', '')) ?></p>

    <form id="signup-form" class="signup-form" novalidate>
      <div class="signup-row">
        <input type="email" id="signup-email" name="email" required
               autocomplete="email" placeholder="you@example.com" aria-label="Email address">
        <button type="submit" class="btn btn-primary" id="signup-btn">Sign Up</button>
      </div>
      <label class="signup-consent">
        <input type="checkbox" id="signup-consent" required>
        <span>Yes, email me about SMO shows, releases and merch. I can unsubscribe any time.</span>
      </label>
      <p id="signup-msg" class="signup-msg hidden"></p>
      <p class="signup-small">
        We keep your address and nothing else. See the
        <a href="legal.html#privacy">privacy policy</a>.
      </p>
    </form>
  </div>
</section>

<!-- ── GALLERY ── -->
<section style="padding-top:0">
  <div class="gallery-grid">
<?php foreach (smo_json('gallery') as $g): ?>
    <img src="<?= h($g['src'] ?? '') ?>" alt="<?= h($g['alt'] ?? '') ?>"<?= !empty($g['wide']) ? ' class="wide"' : '' ?> loading="lazy">
<?php endforeach; ?>
  </div>
</section>

<!-- ── SHOP PREVIEW ── -->
<section class="shop-preview">
  <div class="shop-preview-grid">
    <div class="shop-preview-img">
      <img src="<?= h(smo_text('shopPreview.image', 'assets/images/tee-star-black.jpg')) ?>" alt="SMO t-shirt" loading="lazy">
    </div>
    <div class="shop-preview-text">
      <span class="section-label"><?= h(smo_text('shopPreview.kicker', 'Merch')) ?></span>
      <h2><?= h_lines(smo_text('shopPreview.heading', "Wear\nThe Star")) ?></h2>
      <p><?= h(smo_text('shopPreview.text', '')) ?></p>
      <div class="price-tag"><?= h(smo_text('shopPreview.price', '€25')) ?></div>
      <a href="shop.html" class="btn btn-primary">Shop Now</a>
    </div>
  </div>
</section>
<!-- ── FOOTER ── -->
<footer>
  <div class="footer-top">
    <div>
      <a href="index.html" class="footer-logo"><span>★</span>SMO</a>
      <div class="footer-tagline">Dublin, Ireland</div>
    </div>
    <div class="footer-nav">
      <h4>Links</h4>
      <ul>
        <li><a href="#shows">Shows</a></li>
        <li><a href="#music">Music</a></li>
        <li><a href="shop.html">Shop</a></li>
        <li><a href="admin.html">Admin</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-tagline" style="text-align:right;margin-bottom:16px">Follow SMO</div>
      <div class="footer-social">
        <a href="https://www.instagram.com/smo_rockstar" target="_blank" class="social-link" title="Instagram">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        </a>
        <a href="https://open.spotify.com/artist/5J9snBOPKK6GivDSJa1rO3" target="_blank" class="social-link" title="Spotify">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5-1 4-1 4 1 4 1"/><path d="M7 10s2-1.5 5-1.5 5 1.5 5 1.5"/><path d="M9 16s1.5-.5 3-.5 3 .5 3 .5"/></svg>
        </a>
        <a href="https://www.tiktok.com/@smo_rockstar" target="_blank" class="social-link" title="TikTok">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.29 6.29 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.2 8.2 0 004.79 1.53V6.79a4.83 4.83 0 01-1.02-.1z"/></svg>
        </a>
        <a href="https://www.youtube.com/@smo_rockstar" target="_blank" class="social-link" title="YouTube">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 001.46 6.42 29 29 0 001 12a29 29 0 00.46 5.58 2.78 2.78 0 001.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 001.95-1.95A29 29 0 0023 12a29 29 0 00-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" stroke="none" fill="currentColor"/></svg>
        </a>
      </div>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2025 SMO. All rights reserved.</span>
    <span><a href="legal.html#cookies">Cookies</a> &nbsp;&#183;&nbsp; <a href="legal.html#privacy">Privacy</a> &nbsp;&#183;&nbsp; <a href="#" data-cookie-settings>Cookie settings</a></span>
    <span>smo-rockstar.ie</span>
  </div>
</footer>

<script type="module" src="assets/js/main.js?v=11"></script>
<script src="assets/js/cookie-consent.js?v=11" defer></script>

</body>
</html>
