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
  showToast(`Added ${product.name} (${size}) to cart ★`);
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
    const activeSize = card?.querySelector('.size-btn.active');
    if (!activeSize) {
      showToast('Please select a size first');
      return;
    }
    const product = {
      id: btn.dataset.productId || 'smo-tee-star-black',
      name: btn.dataset.productName || 'SMO T-Shirt',
      price: parseFloat(btn.dataset.productPrice || '25'),
      image: btn.dataset.productImage || 'assets/images/tee-star-black.jpg'
    };
    addToCart(product, activeSize.textContent.trim());
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

// ── SHOWS (loaded from Firebase) ──
async function loadShows() {
  const container = document.getElementById('shows-list');
  if (!container) return;

  // Load Firebase dynamically
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore, collection, getDocs, orderBy, query } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const { firebaseConfig } = await import('./firebase-config.js');

    const app = initializeApp(firebaseConfig, 'main');
    const db = getFirestore(app);
    const q = query(collection(db, 'shows'), orderBy('date', 'asc'));
    const snap = await getDocs(q);

    const now = new Date();
    const upcoming = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(s => new Date(s.date) >= now);

    if (upcoming.length === 0) {
      container.innerHTML = '<div class="no-shows">No upcoming shows right now — check back soon!</div>';
      return;
    }

    container.innerHTML = upcoming.map(show => {
      const d = new Date(show.date);
      const day = d.getDate().toString().padStart(2, '0');
      const month = d.toLocaleString('en-IE', { month: 'short' }).toUpperCase();
      const time = d.toLocaleString('en-IE', { hour: '2-digit', minute: '2-digit' });
      const priceStr = show.price === '0' || show.price === 0 ? 'Free' : `€${show.price}`;
      const priceClass = (show.price === '0' || show.price === 0) ? 'show-price free' : 'show-price';

      return `
        <div class="show-item">
          <div class="show-date">
            <span class="month">${month} ${d.getFullYear()}</span>
            ${day}
          </div>
          <div class="show-info">
            <h3>${show.name}</h3>
            <div class="venue">📍 ${show.venue} &nbsp;·&nbsp; ⏰ ${time}</div>
          </div>
          <div class="${priceClass}">${priceStr}</div>
          <div class="show-tickets">
            ${show.ticketLink ? `<a href="${show.ticketLink}" target="_blank" class="btn btn-primary btn-sm">Get Tickets</a>` : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    console.warn('Firebase not configured yet:', e.message);
    container.innerHTML = `
      <div class="show-item">
        <div class="show-date"><span class="month">APR 2025</span>12</div>
        <div class="show-info"><h3>Grand Social</h3><div class="venue">📍 Grand Social, Dublin &nbsp;·&nbsp; ⏰ 21:00</div></div>
        <div class="show-price">€15</div>
        <div class="show-tickets"><a href="#" class="btn btn-primary btn-sm">Get Tickets</a></div>
      </div>
      <div class="show-item">
        <div class="show-date"><span class="month">MAY 2025</span>03</div>
        <div class="show-info"><h3>Whelans</h3><div class="venue">📍 Whelans, Dublin &nbsp;·&nbsp; ⏰ 20:00</div></div>
        <div class="show-price">€18</div>
        <div class="show-tickets"><a href="#" class="btn btn-primary btn-sm">Get Tickets</a></div>
      </div>
    `;
  }
}

loadShows();
updateCartBadge();

// ── CHECKOUT PAGE ──
// Postage rates shown here are display-only — checkout.php sets the real
// rate server-side from the same region code, so the two can't drift apart.
const SHIPPING = { IE: 5, UK: 7, EU: 9 };

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
        <p>Size: ${item.size} &nbsp;·&nbsp; Qty: ${item.qty}</p>
        <p style="color:var(--gold);font-family:'Bebas Neue',sans-serif;font-size:20px;margin-top:4px">€${(item.price * item.qty).toFixed(2)}</p>
      </div>
    </div>
  `).join('');

  const region = document.getElementById('region')?.value || 'IE';
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = SHIPPING[region] ?? 5;
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
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Redirecting…';

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
  }
});
