/* =====================================================================
   SMO — COOKIE CONSENT + CONSENT-GATED ANALYTICS
   ---------------------------------------------------------------------
   GDPR / ePrivacy compliant. Google Analytics is loaded ONLY after the
   visitor explicitly clicks "Accept All". No analytics/tracking cookies
   are set before consent. Choice is remembered for 12 months.

   Loaded on every page via:  <script src="assets/js/cookie-consent.js" defer></script>
   Deliberately a plain script, not a module, so it runs even if the
   module bundle fails.

   TO TURN ANALYTICS ON: put the GA4 measurement ID in GA_ID below. Until
   then the banner still works and simply has no analytics to load, which
   is the safe default.
   ===================================================================== */
(function () {
  var GA_ID = 'G-22X3PYDM1J';              // GA4 measurement ID. Empty = analytics off.
  var CONSENT_COOKIE = 'smo_cookie_consent';
  var CONSENT_DAYS = 365;

  function setCookie(name, value, days) {
    var expires = '';
    if (days) {
      var d = new Date();
      d.setTime(d.getTime() + days * 864e5);
      expires = '; expires=' + d.toUTCString();
    }
    document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax';
  }

  function getCookie(name) {
    var key = name + '=', parts = document.cookie.split(';');
    for (var i = 0; i < parts.length; i++) {
      var c = parts[i].trim();
      if (c.indexOf(key) === 0) return c.substring(key.length);
    }
    return null;
  }

  /* Load Google Analytics — only ever called after "Accept All". */
  function loadGA() {
    if (window._smoGALoaded || !GA_ID) return;
    window._smoGALoaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }

  function injectStyle() {
    if (document.getElementById('smo-cookie-style')) return;
    var css =
      '#smo-cookie-banner{position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#0d0d0d;border-top:2px solid #e5233d;padding:20px 28px;display:flex;align-items:center;justify-content:space-between;gap:22px;flex-wrap:wrap;box-shadow:0 -4px 40px rgba(0,0,0,.6);font-family:"Space Mono",monospace;transform:translateY(120%);transition:transform .45s cubic-bezier(.16,1,.3,1)}' +
      '#smo-cookie-banner.visible{transform:translateY(0)}' +
      '#smo-cookie-banner .smo-ck-text{flex:1;min-width:260px;font-size:12px;color:rgba(237,232,223,.62);line-height:1.85;letter-spacing:.03em}' +
      '#smo-cookie-banner .smo-ck-text strong{display:block;color:#fff;font-size:13px;margin-bottom:6px;letter-spacing:.18em;text-transform:uppercase}' +
      '#smo-cookie-banner .smo-ck-text strong span{color:#e5233d}' +
      '#smo-cookie-banner .smo-ck-text a{color:#e5233d;text-decoration:none;border-bottom:1px solid rgba(229,35,61,.4)}' +
      '#smo-cookie-banner .smo-ck-text a:hover{color:#fff;border-bottom-color:#fff}' +
      '#smo-cookie-banner .smo-ck-btns{display:flex;gap:10px;flex-shrink:0;flex-wrap:wrap}' +
      '#smo-cookie-banner button{font-family:"Space Mono",monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;padding:13px 26px;cursor:pointer;white-space:nowrap;transition:all .2s;border-radius:0}' +
      '#smo-cookie-banner .smo-ck-accept{background:#e5233d;color:#fff;border:1px solid #e5233d}' +
      '#smo-cookie-banner .smo-ck-accept:hover{background:#c31a30;border-color:#c31a30}' +
      '#smo-cookie-banner .smo-ck-essential{background:transparent;color:rgba(237,232,223,.6);border:1px solid rgba(237,232,223,.25)}' +
      '#smo-cookie-banner .smo-ck-essential:hover{border-color:rgba(237,232,223,.6);color:#fff}' +
      '#smo-cookie-banner button:focus-visible{outline:2px solid #fff;outline-offset:2px}' +
      '@media(max-width:600px){#smo-cookie-banner{padding:18px 20px}#smo-cookie-banner .smo-ck-btns{width:100%}#smo-cookie-banner .smo-ck-accept,#smo-cookie-banner .smo-ck-essential{flex:1;text-align:center;padding:13px 10px}}';
    var style = document.createElement('style');
    style.id = 'smo-cookie-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* The banner is fixed to the bottom, so on its own it sits ON TOP of
     whatever is down there — which on the shop and checkout pages is the
     button people click to buy something. Publish its height so the page can
     reserve that space and the basket bar can stack above it. */
  function reserveSpace(el) {
    var apply = function () {
      document.documentElement.style.setProperty('--smo-ck-h', el.offsetHeight + 'px');
    };
    apply();
    document.body.classList.add('smo-ck-open');
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(apply);
      ro.observe(el);
      el._ro = ro;
    }
    window.addEventListener('resize', apply);
    el._apply = apply;
  }

  function releaseSpace(el) {
    document.body.classList.remove('smo-ck-open');
    document.documentElement.style.removeProperty('--smo-ck-h');
    if (el && el._ro) el._ro.disconnect();
    if (el && el._apply) window.removeEventListener('resize', el._apply);
  }

  function hideBanner() {
    var b = document.getElementById('smo-cookie-banner');
    if (!b) return;
    releaseSpace(b);
    b.classList.remove('visible');
    setTimeout(function () { if (b && b.parentNode) b.parentNode.removeChild(b); }, 500);
  }

  function showBanner() {
    if (document.getElementById('smo-cookie-banner')) return;
    injectStyle();
    var div = document.createElement('div');
    div.id = 'smo-cookie-banner';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-label', 'Cookie consent');
    div.innerHTML =
      '<div class="smo-ck-text">' +
        '<strong><span>&#9733;</span> Cookie Notice</strong>' +
        'We use essential storage to keep your basket and remember this choice — that\'s it. ' +
        'If you accept, we\'ll also use analytics cookies to see which pages people actually read. ' +
        'Nothing is sold or shared with advertisers. See our ' +
        '<a href="legal.html#cookies">Cookie Policy</a> and <a href="legal.html#privacy">Privacy Policy</a>.' +
      '</div>' +
      '<div class="smo-ck-btns">' +
        '<button type="button" class="smo-ck-essential" id="smo-ck-essential">Essential Only</button>' +
        '<button type="button" class="smo-ck-accept" id="smo-ck-accept">Accept All</button>' +
      '</div>';
    document.body.appendChild(div);
    document.getElementById('smo-ck-accept').addEventListener('click', function () {
      setCookie(CONSENT_COOKIE, 'all', CONSENT_DAYS); hideBanner(); loadGA();
    });
    document.getElementById('smo-ck-essential').addEventListener('click', function () {
      setCookie(CONSENT_COOKIE, 'essential', CONSENT_DAYS); hideBanner();
    });
    setTimeout(function () {
      div.classList.add('visible');
      reserveSpace(div);
    }, 700);
  }

  /* Let the footer link re-open the choice: <a href="#" data-cookie-settings>. */
  function wireReopen() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-cookie-settings]');
      if (!t) return;
      e.preventDefault();
      setCookie(CONSENT_COOKIE, '', -1);
      showBanner();
    });
  }

  function init() {
    wireReopen();
    var consent = getCookie(CONSENT_COOKIE);
    if (consent === 'all') { loadGA(); return; }   // already opted in
    if (consent === 'essential') { return; }        // already declined analytics
    showBanner();                                   // no choice yet
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
