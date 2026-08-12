// ── NAV SCROLL ──
const nav = document.querySelector('nav');
window.addEventListener('scroll', () => {
  nav?.classList.toggle('scrolled', window.scrollY > 40);
});

// ── HAMBURGER ──
const hamburger = document.querySelector('.hamburger');
const navLinks = document.querySelector('.nav-links');
hamburger?.addEventListener('click', () => {
  navLinks?.classList.toggle('open');
});

// ── HERO VIDEO ──
// This used to pause the video for prefers-reduced-motion users, which meant
// anyone with Windows "animation effects" switched off saw a still frame and
// assumed the video was broken — that setting is common and it's the default
// on plenty of machines. The video IS the hero here, not decoration, so it
// plays for everyone; the CSS drops the slow zoom-out for reduced-motion
// users instead, which is the gratuitous part.
//
// Autoplay can still be refused (some mobile data-saver modes). Retry once on
// first interaction rather than leaving a frozen frame with no explanation.
const heroVideo = document.querySelector('.hero-video');
if (heroVideo) {
  const tryPlay = () => {
    const p = heroVideo.play();
    if (p && p.catch) p.catch(() => {});
  };
  tryPlay();
  heroVideo.addEventListener('canplay', tryPlay, { once: true });
  ['pointerdown', 'touchstart', 'keydown'].forEach(evt =>
    window.addEventListener(evt, tryPlay, { once: true, passive: true })
  );
}

// ── CART ──
let cart = JSON.parse(localStorage.getItem('smo_cart') || '[]');

function saveCart() {
  localStorage.setItem('smo_cart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.querySelector('.cart-count');
  if (badge) badge.textContent = cart.reduce((s, i) => s + i.qty, 0);
}

function addToCart(product, size) {
  const existing = cart.find(i => i.id === product.id && i.size === size);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ ...product, size, qty: 1 });
  }
  saveCart();
  showToast(`Added ${product.name}${size ? ` (${size})` : ''} to cart ★`);
}

// ── SIZE SELECTOR ──
document.querySelectorAll('.size-selector').forEach(sel => {
  sel.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sel.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});

// ── ADD TO CART BUTTONS ──
document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
  btn.addEventListener('click', () => {
    const card = btn.closest('.product-card');
    // Only insist on a size for products that actually offer sizes — the €1
    // test item has no size selector at all.
    const hasSizes = !!card?.querySelector('.size-selector');
    const activeSize = card?.querySelector('.size-btn.active');
    if (hasSizes && !activeSize) {
      showToast('Please select a size first');
      return;
    }
    const product = {
      id: btn.dataset.productId || 'smo-tee-star-black',
      name: btn.dataset.productName || 'SMO T-Shirt',
      price: parseFloat(btn.dataset.productPrice || '25'),
      image: btn.dataset.productImage || 'assets/images/tee-star-black.jpg'
    };
    addToCart(product, activeSize ? activeSize.textContent.trim() : '');
  });
});

// ── TOAST ──
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── SHOWS ──
// Loaded from shows-api.php, which reads data/shows.json — the file the
// admin page writes. This used to try Firebase and, when that wasn't
// configured, fall back to two hardcoded gigs. Those fallback dates went
// stale and the live homepage spent months advertising gigs from 2025, so
// there is deliberately no invented data here now: no shows means we say so.
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadShows() {
  const container = document.getElementById('shows-list');
  if (!container) return;

  const nothingOn =
    '<div class="no-shows">No dates announced right now — ' +
    '<a href="https://www.instagram.com/smo_rockstar" target="_blank" rel="noopener" style="color:var(--red)">' +
    'follow @smo_rockstar</a> to hear about the next one first.</div>';

  // Try the API first. If PHP is down or misconfigured, read the same data
  // straight from the JSON file the admin writes — it sits in the web root
  // and is public either way, so this costs nothing and keeps the gig list
  // on the page when the server-side half is broken.
  async function fetchShows(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.shows || []);
  }

  let shows;
  try {
    shows = await fetchShows('shows-api.php?action=list');
  } catch (apiErr) {
    try {
      shows = await fetchShows('data/shows.json');
    } catch (fileErr) {
      console.warn('Could not load shows:', apiErr.message, '/', fileErr.message);
      container.innerHTML = nothingOn;
      return;
    }
  }

  // Keep a gig listed until the end of the day it happens on, so an evening
  // show doesn't vanish from the site that same afternoon.
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  const upcoming = shows.filter(s => {
    const d = new Date(s.date);
    return !isNaN(d) && d >= cutoff;
  });

  if (!upcoming.length) { container.innerHTML = nothingOn; return; }

  container.innerHTML = upcoming.map(show => {
    const d = new Date(show.date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-IE', { month: 'short' }).toUpperCase();
    const time = d.toLocaleString('en-IE', { hour: '2-digit', minute: '2-digit' });
    const free = show.price === '' || show.price === '0' || show.price === 0;
    const priceStr = free ? 'Free' : `€${escapeHtml(show.price)}`;
    const photo = (show.photos && show.photos[0]) ? escapeHtml(show.photos[0]) : '';

    return `
      <div class="show-item">
        ${photo ? `<img class="show-thumb" src="${photo}" alt="" loading="lazy">` : ''}
        <div class="show-date">
          <span class="month">${month} ${d.getFullYear()}</span>
          ${day}
        </div>
        <div class="show-info">
          <h3><a class="show-link" href="show.php?id=${encodeURIComponent(show.id)}">${escapeHtml(show.name)}</a></h3>
          <div class="venue">📍 ${escapeHtml(show.venue)} &nbsp;·&nbsp; ⏰ ${time}</div>
        </div>
        <div class="${free ? 'show-price free' : 'show-price'}">${priceStr}</div>
        <div class="show-tickets">
          ${show.ticketLink ? `<a href="${escapeHtml(show.ticketLink)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Get Tickets</a>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

loadShows();
updateCartBadge();

// ── CHECKOUT PAGE ──
// Postage rates shown here are display-only — checkout.php sets the real
// rate server-side from the same region code, so the two can't drift apart.
const SHIPPING = { IE: 5, UK: 7, EU: 9 };

// Mirrors the freeShipping flag in data/products.json: a cart holding only
// these ships free. Empty now the €1 test item is gone, but the mechanism is
// kept for the next time something needs to ship free. Add an id here AND set
// freeShipping in products.json — miss one and the page quotes a total Stripe
// doesn't then charge.
const FREE_SHIPPING_IDS = new Set([]);

function renderCheckout() {
  const list = document.getElementById('checkout-items');
  const subtotalEl = document.getElementById('subtotal');
  const shippingEl = document.getElementById('shipping-cost');
  const totalEl = document.getElementById('grand-total');
  if (!list) return;

  const payBtn = document.getElementById('pay-btn');

  if (cart.length === 0) {
    list.innerHTML = '<p style="color:var(--grey);font-size:13px;">Your cart is empty. <a href="shop.html" style="color:var(--red)">Shop now</a></p>';
    if (payBtn) payBtn.disabled = true;
    if (subtotalEl) subtotalEl.textContent = '€0.00';
    if (shippingEl) shippingEl.textContent = '€0.00';
    if (totalEl) totalEl.textContent = '€0.00';
    return;
  }

  list.innerHTML = cart.map(item => `
    <div class="order-item">
      <img src="${item.image}" alt="${item.name}">
      <div class="order-item-details">
        <h4>${item.name}</h4>
        <p>${item.size ? `Size: ${item.size} &nbsp;·&nbsp; ` : ''}Qty: ${item.qty}</p>
        <p style="color:var(--gold);font-family:'Bebas Neue',sans-serif;font-size:20px;margin-top:4px">€${(item.price * item.qty).toFixed(2)}</p>
      </div>
    </div>
  `).join('');

  const region = document.getElementById('region')?.value || 'IE';
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const allFreeShipping = cart.every(i => FREE_SHIPPING_IDS.has(i.id));
  const shipping = allFreeShipping ? 0 : (SHIPPING[region] ?? 5);
  if (subtotalEl) subtotalEl.textContent = `€${subtotal.toFixed(2)}`;
  if (shippingEl) shippingEl.textContent = `€${shipping.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `€${(subtotal + shipping).toFixed(2)}`;
}

renderCheckout();
document.getElementById('region')?.addEventListener('change', renderCheckout);

// ── PAY → STRIPE ──
// Hands the cart to checkout.php, which re-prices it server-side and returns
// a Stripe Checkout URL. The cart is left alone here — success.html only
// clears it once Stripe confirms the payment actually went through.
document.getElementById('pay-btn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const errEl = document.getElementById('pay-error');

  if (cart.length === 0) return;

  errEl?.classList.add('hidden');

  // Acknowledge the press immediately. Stripe can take a second or two to
  // hand back a URL, and without this the button just sits there looking
  // like the click missed.
  btn.classList.remove('fired');
  void btn.offsetWidth;                 // restart the animation on repeat clicks
  btn.classList.add('fired');

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Taking you to Stripe…';

  try {
    const res = await fetch('checkout.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        region: document.getElementById('region')?.value || 'IE',
        items: cart.map(i => ({ id: i.id, size: i.size, qty: i.qty }))
      })
    });
    // A misconfigured server can return an HTML error page instead of JSON —
    // don't let a parse error surface as gibberish to the customer.
    let data = null;
    try { data = JSON.parse(await res.text()); } catch { data = null; }

    if (res.ok && data?.url) {
      location.href = data.url;
      return;
    }
    throw new Error(data?.error || 'Could not reach the payment page. Please try again in a moment, or message SMO on Instagram and we\'ll sort it.');
  } catch (err) {
    if (errEl) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
    btn.disabled = false;
    btn.textContent = original;
    btn.classList.remove('fired');
  }
});

// ── FEATURED RELEASE ──────────────────────────────────────────────
// One place to control the big block near the top of the homepage.
//
// releaseDate: the day it comes out, as YYYY-MM-DD.
//   • before that date  → "Pre-Save Now"
//   • after it          → "Listen Now"
//   • FEATURE_DAYS after it → the block hides itself and the track appears
//     in the normal Releases grid instead
// Leave releaseDate empty and it simply stays featured until you set one.
const FEATURED_RELEASE = {
  title:       'White Flag',
  presave:     'https://ditto.fm/white-flag-smo',
  releaseDate: ''            // ← set this, e.g. '2026-09-05'
};
const FEATURE_DAYS = 7;      // how long it stays featured after release

(function featureRelease() {
  const block = document.getElementById('featured-release');
  const card  = document.getElementById('white-flag-card');
  if (!block) return;

  const showBlock = () => { block.classList.remove('hidden'); card?.classList.add('hidden'); };
  const showCard  = () => { block.classList.add('hidden');    card?.classList.remove('hidden'); };

  const released = FEATURED_RELEASE.releaseDate
    ? new Date(FEATURED_RELEASE.releaseDate + 'T00:00:00')
    : null;

  if (!released || isNaN(released)) { showBlock(); return; }   // no date set: stay featured

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const retireOn = new Date(released);
  retireOn.setDate(retireOn.getDate() + FEATURE_DAYS);

  if (today >= retireOn) { showCard(); return; }

  showBlock();

  // Out already? Then it's not a pre-save any more.
  if (today >= released) {
    const cta = document.getElementById('featured-cta');
    const tag = document.getElementById('featured-tag');
    const blurb = document.getElementById('featured-blurb');
    if (cta) cta.textContent = 'Listen Now';
    if (tag) tag.textContent = 'Out Now';
    if (blurb) blurb.textContent = 'Out now on every streaming service.';
  } else {
    const when = released.toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
    const el = document.getElementById('featured-date');
    if (el) el.textContent = 'Released ' + when;
  }
})();

// ── MAILING LIST ──────────────────────────────────────────────────
(function mailingList() {
  const form = document.getElementById('signup-form');
  if (!form) return;
  const email = document.getElementById('signup-email');
  const consent = document.getElementById('signup-consent');
  const btn = document.getElementById('signup-btn');
  const msg = document.getElementById('signup-msg');

  const say = (text, ok) => {
    msg.textContent = text;
    msg.classList.remove('hidden');
    msg.classList.toggle('is-ok', !!ok);
    msg.classList.toggle('is-err', !ok);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!email.value.trim()) { say('Pop your email address in first.', false); email.focus(); return; }
    if (!consent.checked)    { say('Tick the box and you\'re in.', false); consent.focus(); return; }

    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Signing up…';

    try {
      const body = new FormData();
      body.append('email', email.value.trim());
      body.append('consent', consent.checked ? '1' : '0');
      body.append('source', 'homepage');

      const res = await fetch('subscribe.php', { method: 'POST', body });
      let data = null;
      try { data = JSON.parse(await res.text()); } catch { data = null; }
      if (!data) throw new Error('Something went wrong at our end. Try again in a minute.');
      if (!res.ok) throw new Error(data.error || 'Could not sign you up.');

      // Deliberately the same message whether they were already on the list
      // or not — confirming membership to a stranger leaks who is on it.
      form.querySelector('.signup-row').classList.add('hidden');
      form.querySelector('.signup-consent').classList.add('hidden');
      say('You\'re on the list. Talk soon ★', true);
    } catch (err) {
      say(err.message, false);
      btn.disabled = false;
      btn.textContent = original;
    }
  });
})();
