<?php require __DIR__ . "/content.php"; ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMO — Shop</title>
  <link rel="canonical" href="https://smo-rockstar.ie/shop.html">
  <link rel="stylesheet" href="assets/css/style.css?v=12">
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
    <li><a href="index.html#shows">Shows</a></li>
    <li><a href="index.html#music">Music</a></li>
    <li><a href="index.html#about">About</a></li>
    <li><a href="shop.html" class="btn-nav">Shop</a></li>
    <li>
      <a href="shop.html" style="position:relative;display:flex;align-items:flex-start">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        <span class="cart-count">0</span>
      </a>
    </li>
  </ul>
</nav>

<!-- ── PAGE HERO ── -->
<div class="page-hero">
  <span class="section-label"><?= h(smo_text('shopPage.kicker', 'Official Merch')) ?></span>
  <h1><?= h_lines(smo_text('shopPage.heading', 'The Shop')) ?></h1>
</div>

<!-- ── SHOP GRID ── -->
<!-- Rendered from data/products.json — the same file checkout.php re-prices
     against, so the page and the charge can never disagree. -->
<div class="shop-grid">
<?php foreach (smo_json('products') as $p):
        $sizes = is_array($p['sizes'] ?? null) ? $p['sizes'] : []; ?>
  <div class="product-card">
    <div class="product-card-img">
      <img src="<?= h($p['image'] ?? '') ?>" alt="<?= h($p['alt'] ?? ($p['title'] ?? '')) ?>" loading="lazy">
    </div>
    <div class="product-card-body">
      <h3><?= h($p['title'] ?? '') ?></h3>
<?php if (!empty($p['description'])): ?>
      <p style="color:var(--grey);font-size:12px;margin-bottom:12px"><?= h($p['description']) ?></p>
<?php endif; ?>
      <div class="product-price"><?= h(smo_price($p['priceCents'] ?? 0)) ?></div>
<?php if ($sizes): ?>
      <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:var(--grey);margin-bottom:8px">Select Size</div>
      <div class="size-selector">
<?php   foreach ($sizes as $sz): ?>
        <button class="size-btn"><?= h($sz) ?></button>
<?php   endforeach; ?>
      </div>
<?php endif; ?>
      <button
        class="btn btn-primary"
        style="width:100%;justify-content:center;margin-bottom:12px"
        data-add-to-cart
        data-product-id="<?= h($p['id'] ?? '') ?>"
        data-product-name="<?= h($p['title'] ?? '') ?>"
        data-product-price="<?= h(number_format(((int)($p['priceCents'] ?? 0)) / 100, 2, '.', '')) ?>"
        data-product-image="<?= h($p['image'] ?? '') ?>"
      >Add to Cart</button>
    </div>
  </div>
<?php endforeach; ?>

  <!-- More coming -->
  <div class="product-card" style="background:transparent;border:1px solid var(--border)">
    <div style="padding:32px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;height:100%">
      <div style="font-size:64px;margin-bottom:16px;line-height:1">★</div>
      <h3 style="font-size:28px;margin-bottom:12px">More Coming<br>Soon</h3>
      <p style="color:var(--grey);font-size:12px;line-height:1.8">Hoodies, caps and more drops planned. Follow SMO on Instagram to be first to know.</p>
      <a href="https://www.instagram.com/smo_rockstar" target="_blank" class="btn btn-outline" style="margin-top:24px;font-size:11px">Follow @smo_rockstar</a>
    </div>
  </div>

</div>

<!-- ── SHIPPING NOTE ── -->
<div style="padding:0 60px 60px;text-align:center;color:var(--grey);font-size:12px;letter-spacing:0.08em;line-height:2">
  <?= h_lines(smo_text('shopPage.shippingNote', '')) ?>
</div>
<!-- ── CART PANEL ── -->
<div id="cart-bar" class="cart-bar">
  <span id="cart-summary" class="cart-bar-summary"></span>
  <a href="checkout.html" class="btn btn-primary btn-buy" style="width:auto">Checkout →</a>
</div>

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
        <li><a href="index.html#shows">Shows</a></li>
        <li><a href="index.html#music">Music</a></li>
        <li><a href="shop.html">Shop</a></li>
      </ul>
    </div>
    <div>
      <div class="footer-tagline" style="text-align:right;margin-bottom:16px">Follow SMO</div>
      <div class="footer-social">
        <a href="https://www.instagram.com/smo_rockstar" target="_blank" class="social-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        </a>
        <a href="https://open.spotify.com/artist/5J9snBOPKK6GivDSJa1rO3" target="_blank" class="social-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5-1 4-1 4 1 4 1"/><path d="M7 10s2-1.5 5-1.5 5 1.5 5 1.5"/><path d="M9 16s1.5-.5 3-.5 3 .5 3 .5"/></svg>
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

<script type="module" src="assets/js/main.js?v=12"></script>
<script>
  // Show cart bar when items in cart
  function updateCartBar() {
    const cart = JSON.parse(localStorage.getItem('smo_cart') || '[]');
    const bar = document.getElementById('cart-bar');
    const summary = document.getElementById('cart-summary');
    if (!bar) return;
    const total = cart.reduce((s, i) => s + i.qty, 0);
    const price = cart.reduce((s, i) => s + i.price * i.qty, 0);
    // Toggle a class rather than an inline style, so the stylesheet keeps
    // control of where the bar sits relative to the cookie banner.
    bar.classList.toggle('open', total > 0);
    if (total > 0 && summary) {
      summary.innerHTML = `<span>${total} item${total > 1 ? 's' : ''} in your basket</span> &nbsp;·&nbsp; €${price.toFixed(2)}`;
    }
  }
  updateCartBar();
  // Re-check after add-to-cart
  document.addEventListener('click', () => setTimeout(updateCartBar, 200));
</script>

<script src="assets/js/cookie-consent.js?v=12" defer></script>

</body>
</html>
