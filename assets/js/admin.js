/* =====================================================================
   SMO — shows admin
   ---------------------------------------------------------------------
   Talks to shows-api.php. Auth is a PHP session, so nothing here is a
   security control — this file only decides what to draw. The server
   re-checks the session and re-sanitises every field on save.
   ===================================================================== */
(function () {
  var API = 'shows-api.php';

  /* Band photos already on the site, offered so a show can have pictures
     without anyone having to find and upload one. */
  var STOCK = [
    'assets/images/gallery-band.jpg',
    'assets/images/gallery-guitar.jpg',
    'assets/images/gallery-vocal.jpg',
    'assets/images/gallery-star.jpg',
    'assets/images/gallery-night.jpg',
    'assets/images/gallery-duo.jpg',
    'assets/images/gallery-acoustic.jpg',
    'assets/images/gallery-piano.jpg',
    'assets/images/about-accent.jpg',
    'assets/images/about-main.jpg'
  ];

  var shows = [];
  var csrf = null;

  var $ = function (id) { return document.getElementById(id); };
  var show = function (id) { $(id).classList.remove('hidden'); };
  var hide = function (id) { $(id).classList.add('hidden'); };

  function post(action, data) {
    var body = new FormData();
    body.append('action', action);
    if (csrf) body.append('csrf', csrf);
    Object.keys(data || {}).forEach(function (k) { body.append(k, data[k]); });

    return fetch(API, { method: 'POST', body: body })
      .catch(function () {
        /* fetch only rejects on a network-level failure. The usual cause is
           opening this page from a local preview, where there is no PHP and
           POSTs are dropped — "Failed to fetch" on its own explains none of
           that, so say it plainly. */
        throw new Error('Could not reach the server. This page only works on the live site — open https://smo-rockstar.ie/admin.html rather than a local preview.');
      })
      .then(function (r) {
        return r.text().then(function (txt) {
          var j = null;
          try { j = JSON.parse(txt); } catch (e) { j = null; }
          if (j === null) {
            /* A 200 carrying non-JSON used to be treated as success, which
               silently "logged in" with no session. Fail loudly instead. */
            throw new Error(r.ok
              ? 'The server replied with something that is not JSON — PHP may not be running on this host.'
              : 'Server error ' + r.status + '.');
          }
          if (!r.ok) throw new Error(j.error || 'Request failed.');
          return j;
        });
      });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ── boot ─────────────────────────────────────────────── */
  fetch(API + '?action=session').then(function (r) { return r.json(); }).then(function (s) {
    if (!s.setUp) { show('setup'); return; }
    csrf = s.csrf;
    if (s.admin) { openEditor(); } else { show('login'); }
  }).catch(function () { show('login'); });

  /* ── login ────────────────────────────────────────────── */
  function doLogin() {
    var pw = $('pw').value;
    $('login-msg').textContent = '';
    post('login', { password: pw }).then(function (r) {
      csrf = r.csrf;
      hide('login');
      openEditor();
    }).catch(function (e) {
      $('login-msg').textContent = e.message;
    });
  }
  $('login-btn').addEventListener('click', doLogin);
  $('pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

  $('logout-btn').addEventListener('click', function () {
    post('logout', {}).then(function () { location.reload(); });
  });

  /* ── mailing list ─────────────────────────────────────── */
  function loadSubs() {
    var body = document.querySelector('#subs-table tbody');
    var count = $('subs-count');
    var csv = $('subs-csv');
    if (!body) return;

    /* The CSV is a plain link, so the token rides in the query string —
       the server accepts it there for reads. */
    if (csv && csrf) csv.href = API + '?action=subs-csv&csrf=' + encodeURIComponent(csrf);

    fetch(API + '?action=subs&csrf=' + encodeURIComponent(csrf || ''))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var list = d.subscribers || [];
        count.textContent = list.length + (list.length === 1 ? ' subscriber' : ' subscribers');
        if (!list.length) {
          body.innerHTML = '<tr><td colspan="3" class="subs-empty">Nobody yet. ' +
            'The signup form is on the homepage.</td></tr>';
          if (csv) csv.style.display = 'none';
          return;
        }
        if (csv) csv.style.display = '';
        body.innerHTML = list.map(function (x) {
          var when = x.signedUp ? new Date(x.signedUp) : null;
          return '<tr><td>' + esc(x.email) + '</td><td>' +
            (when && !isNaN(when) ? when.toLocaleString('en-IE', {
              day: '2-digit', month: 'short', year: 'numeric',
              hour: '2-digit', minute: '2-digit'
            }) : '—') +
            '</td><td>' + esc(x.source || 'website') + '</td></tr>';
        }).join('');
      })
      .catch(function () {
        count.textContent = 'Could not load the list.';
      });
  }


  /* =================================================================
     TABS
     ================================================================= */
  document.getElementById('adm-tabs') && document.getElementById('adm-tabs')
    .addEventListener('click', function (e) {
      var t = e.target.closest('.adm-tab');
      if (!t) return;
      document.querySelectorAll('.adm-tab').forEach(function (b) { b.classList.toggle('is-on', b === t); });
      document.querySelectorAll('.adm-panel').forEach(function (p) {
        p.classList.toggle('is-on', p.dataset.panel === t.dataset.tab);
      });
    });

  /* =================================================================
     SHOP / RELEASES / GALLERY / PAGE TEXT
     All the same shape: load JSON, draw fields, post it back. The server
     re-cleans every field on save, so nothing drawn here is trusted.
     ================================================================= */
  var DATA = { products: [], releases: [], gallery: [], content: {} };

  /* Artwork and product shots — STOCK is band photos, meant for gigs. */
  var EXTRA_IMAGES = [
    'assets/images/release-white-flag.jpg',
    'assets/images/release-lost-my-way.jpg',
    'assets/images/release-war.jpg',
    'assets/images/release-love-me-too.jpg',
    'assets/images/release-celebrate-you.jpg',
    'assets/images/tee-star-black.jpg',
    'assets/images/tee-star-white.jpg',
    'assets/images/tee-crowd-black.jpg',
    'assets/images/og-image.jpg'
  ];

  function getData(type) {
    return fetch(API + '?action=get-data&type=' + type + '&csrf=' + encodeURIComponent(csrf || ''))
      .then(function (r) { return r.json(); })
      .then(function (d) { DATA[type] = d.data || (type === 'content' ? {} : []); });
  }

  function saveData(type) {
    var msg = $(type === 'products' ? 'shop-msg' : type + '-msg');
    msg.innerHTML = '<span class="adm-hint">Saving...</span>';
    var body = new FormData();
    body.append('action', 'save-data');
    body.append('type', type);
    body.append('csrf', csrf);
    body.append('json', JSON.stringify(DATA[type]));
    fetch(API, { method: 'POST', body: body })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = JSON.parse(t); } catch (e) { j = null; }
          if (!j) throw new Error('Server did not reply with JSON.');
          if (!r.ok) throw new Error(j.error || 'Save failed.');
          return j;
        });
      })
      .then(function () {
        msg.innerHTML = '<span class="toast-ok">Saved - live on the site.</span>';
        return getData(type).then(function () { drawers[type](); });
      })
      .catch(function (e) { msg.innerHTML = '<span class="toast-err">' + esc(e.message) + '</span>'; });
  }

  function inp(val, ph, oninput, type) {
    var i = document.createElement('input');
    i.type = type || 'text';
    i.value = val == null ? '' : val;
    if (ph) i.placeholder = ph;
    i.addEventListener('input', function () { oninput(i.value); });
    return i;
  }
  function group(label, el) {
    var d = document.createElement('div');
    d.className = 'form-group';
    var l = document.createElement('label');
    l.textContent = label;
    d.appendChild(l); d.appendChild(el);
    return d;
  }
  function card() { var d = document.createElement('div'); d.className = 'adm-card'; return d; }
  function row() { var d = document.createElement('div'); d.className = 'adm-row'; return d; }

  /* Pick from photos already on the site so editors never need to know
     where anything is stored. */
  function imagePicker(label, current, onpick) {
    var wrap = document.createElement('div');
    wrap.className = 'form-group';
    var l = document.createElement('label'); l.textContent = label;
    wrap.appendChild(l);
    if (current) {
      var prev = document.createElement('img');
      prev.src = current;
      prev.style.cssText = 'width:96px;height:96px;object-fit:cover;display:block;margin-bottom:8px;border:1px solid var(--border)';
      wrap.appendChild(prev);
    }
    var pick = document.createElement('div'); pick.className = 'pick';
    STOCK.concat(EXTRA_IMAGES).forEach(function (src) {
      var im = document.createElement('img');
      im.src = src; im.alt = '';
      if (src === current) im.className = 'on';
      im.onclick = function () { onpick(src); };
      pick.appendChild(im);
    });
    wrap.appendChild(pick);
    return wrap;
  }

  /* ---- shop ---- */
  function drawShop() {
    var host = $('shop-list'); if (!host) return;
    host.innerHTML = '';
    $('shop-count').textContent = DATA.products.length +
      (DATA.products.length === 1 ? ' product' : ' products');

    DATA.products.forEach(function (p, i) {
      var c = card();
      var r1 = row();
      r1.appendChild(group('Product name *', inp(p.title, 'Star Logo Tee', function (v) { p.title = v; })));
      r1.appendChild(group('Price (EUR) *', inp(
        (p.priceCents != null ? (p.priceCents / 100) : ''), '25',
        function (v) { p.price = v; p.priceCents = Math.round(parseFloat(v || 0) * 100); }, 'number')));
      c.appendChild(r1);

      var r2 = row();
      r2.appendChild(group('Sizes (comma separated)', inp(
        (p.sizes || []).join(', '), 'S, M, L, XL, XXL',
        function (v) { p.sizes = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean); })));
      r2.appendChild(group('ID (leave alone unless new)', inp(p.id, 'smo-tee-...', function (v) { p.id = v; })));
      c.appendChild(r2);

      c.appendChild(group('Description', inp(p.description, 'Heavyweight cotton. Screen printed.', function (v) { p.description = v; })));
      c.appendChild(imagePicker('Product photo', p.image, function (v) { p.image = v; drawShop(); }));

      var acts = document.createElement('div'); acts.className = 'adm-actions';
      var del = document.createElement('button');
      del.className = 'btn btn-danger'; del.style.fontSize = '11px'; del.textContent = 'Delete product';
      del.onclick = function () {
        if (!confirm('Delete "' + (p.title || 'this product') + '"? It leaves the shop when you save.')) return;
        DATA.products.splice(i, 1); drawShop();
      };
      acts.appendChild(del);
      c.appendChild(acts);
      host.appendChild(c);
    });

    if (!DATA.products.length) {
      host.innerHTML = '<div class="adm-empty">No products. Hit <strong>+ Add Product</strong>.</div>';
    }
  }

  /* ---- releases ---- */
  function drawReleases() {
    var host = $('releases-list'); if (!host) return;
    host.innerHTML = '';
    $('releases-count').textContent = DATA.releases.length +
      (DATA.releases.length === 1 ? ' release' : ' releases');

    DATA.releases.forEach(function (rel, i) {
      var c = card();
      var r1 = row();
      r1.appendChild(group('Title *', inp(rel.title, 'White Flag', function (v) { rel.title = v; })));
      r1.appendChild(group('Detail line', inp(rel.meta, 'Single 2026', function (v) { rel.meta = v; })));
      c.appendChild(r1);

      var r2 = row();
      r2.appendChild(group('Listen link', inp(rel.link, 'https://...', function (v) { rel.link = v; })));
      r2.appendChild(group('Link button text', inp(rel.linkLabel, 'Spotify', function (v) { rel.linkLabel = v; })));
      c.appendChild(r2);

      c.appendChild(group('YouTube link', inp(rel.youtube, 'https://youtube.com/...', function (v) { rel.youtube = v; })));
      c.appendChild(imagePicker('Artwork', rel.image, function (v) { rel.image = v; drawReleases(); }));

      var acts = document.createElement('div'); acts.className = 'adm-actions';
      var up = document.createElement('button'); up.className = 'gal-btn'; up.textContent = 'Move up';
      up.onclick = function () {
        if (i > 0) { var t = DATA.releases[i - 1]; DATA.releases[i - 1] = rel; DATA.releases[i] = t; drawReleases(); }
      };
      var dn = document.createElement('button'); dn.className = 'gal-btn'; dn.textContent = 'Move down';
      dn.onclick = function () {
        if (i < DATA.releases.length - 1) { var t = DATA.releases[i + 1]; DATA.releases[i + 1] = rel; DATA.releases[i] = t; drawReleases(); }
      };
      var del = document.createElement('button');
      del.className = 'btn btn-danger'; del.style.fontSize = '11px'; del.textContent = 'Delete release';
      del.onclick = function () {
        if (!confirm('Delete "' + (rel.title || 'this release') + '"?')) return;
        DATA.releases.splice(i, 1); drawReleases();
      };
      acts.appendChild(up); acts.appendChild(dn); acts.appendChild(del);
      c.appendChild(acts);
      host.appendChild(c);
    });
  }

  /* ---- gallery ---- */
  function drawGallery() {
    var host = $('gallery-list'); if (!host) return;
    host.innerHTML = '';
    $('gallery-count').textContent = DATA.gallery.length +
      (DATA.gallery.length === 1 ? ' photo' : ' photos');

    DATA.gallery.forEach(function (g, i) {
      var d = document.createElement('div'); d.className = 'gal-item';
      var im = document.createElement('img'); im.src = g.src; im.alt = '';
      d.appendChild(im);
      d.appendChild(inp(g.alt, 'Describe the photo', function (v) { g.alt = v; }));

      var r = document.createElement('div'); r.className = 'gal-row';
      var lab = document.createElement('label');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!g.wide;
      cb.onchange = function () { g.wide = cb.checked; };
      lab.appendChild(cb); lab.appendChild(document.createTextNode('Wide'));

      var btns = document.createElement('span');
      var up = document.createElement('button'); up.className = 'gal-btn'; up.textContent = '<';
      up.onclick = function () {
        if (i > 0) { var t = DATA.gallery[i - 1]; DATA.gallery[i - 1] = g; DATA.gallery[i] = t; drawGallery(); }
      };
      var dn = document.createElement('button'); dn.className = 'gal-btn'; dn.textContent = '>';
      dn.onclick = function () {
        if (i < DATA.gallery.length - 1) { var t = DATA.gallery[i + 1]; DATA.gallery[i + 1] = g; DATA.gallery[i] = t; drawGallery(); }
      };
      var del = document.createElement('button'); del.className = 'gal-btn del'; del.textContent = 'x';
      del.onclick = function () { DATA.gallery.splice(i, 1); drawGallery(); };
      btns.appendChild(up); btns.appendChild(dn); btns.appendChild(del);

      r.appendChild(lab); r.appendChild(btns);
      d.appendChild(r);
      host.appendChild(d);
    });

    if (!DATA.gallery.length) {
      host.innerHTML = '<div class="adm-empty">No photos yet. Use <strong>Upload Photo</strong>.</div>';
    }
  }

  /* ---- page text ---- */
  function drawContent() {
    var host = $('content-form'); if (!host) return;
    var c = DATA.content || {};
    c.hero = c.hero || {}; c.about = c.about || {}; c.shopPreview = c.shopPreview || {};
    c.mailingList = c.mailingList || {}; c.shopPage = c.shopPage || {};
    c.about.paragraphs = c.about.paragraphs || [];
    c.about.stats = c.about.stats || [];
    c.ticker = c.ticker || [];
    DATA.content = c;
    host.innerHTML = '';

    function section(title, build) {
      var k = card();
      var h = document.createElement('h3');
      h.textContent = title; h.style.marginBottom = '14px';
      k.appendChild(h); build(k); host.appendChild(k);
    }

    section('Hero (top of homepage)', function (k) {
      k.appendChild(group('Small line above SMO', inp(c.hero.eyebrow, 'Dublin, Ireland', function (v) { c.hero.eyebrow = v; })));
      k.appendChild(group('Strapline', inp(c.hero.sub, '', function (v) { c.hero.sub = v; })));
    });

    section('Scrolling ticker', function (k) {
      k.appendChild(group('Items (comma separated)', inp(c.ticker.join(', '), 'Song, Song, Venue',
        function (v) { c.ticker = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean); })));
    });

    section('About section', function (k) {
      var r1 = row();
      r1.appendChild(group('Kicker', inp(c.about.kicker, 'The Band', function (v) { c.about.kicker = v; })));
      r1.appendChild(group('Heading', inp(c.about.heading, 'Raw Sound.', function (v) { c.about.heading = v; })));
      k.appendChild(r1);

      c.about.paragraphs.forEach(function (_, i) {
        var g = group('Paragraph ' + (i + 1), inp(c.about.paragraphs[i], '', function (v) { c.about.paragraphs[i] = v; }));
        var x = document.createElement('button');
        x.className = 'gal-btn del'; x.textContent = 'Remove'; x.style.marginTop = '6px';
        x.onclick = function () { c.about.paragraphs.splice(i, 1); drawContent(); };
        g.appendChild(x);
        k.appendChild(g);
      });
      var add = document.createElement('button');
      add.className = 'btn btn-outline'; add.style.fontSize = '11px'; add.textContent = '+ Add paragraph';
      add.onclick = function () { c.about.paragraphs.push(''); drawContent(); };
      k.appendChild(add);

      var sh = document.createElement('p');
      sh.className = 'adm-hint'; sh.textContent = 'The three figures under the About text';
      sh.style.margin = '20px 0 8px';
      k.appendChild(sh);
      c.about.stats.forEach(function (st) {
        var r2 = row();
        r2.appendChild(group('Figure', inp(st.num, '3K+', function (v) { st.num = v; })));
        r2.appendChild(group('Label', inp(st.label, 'Monthly Listeners', function (v) { st.label = v; })));
        k.appendChild(r2);
      });
    });

    section('Merch block (homepage)', function (k) {
      var r1 = row();
      r1.appendChild(group('Kicker', inp(c.shopPreview.kicker, 'Merch', function (v) { c.shopPreview.kicker = v; })));
      r1.appendChild(group('Heading', inp(c.shopPreview.heading, 'Wear', function (v) { c.shopPreview.heading = v; })));
      k.appendChild(r1);
      k.appendChild(group('Text', inp(c.shopPreview.text, '', function (v) { c.shopPreview.text = v; })));
      k.appendChild(group('Price shown', inp(c.shopPreview.price, '25', function (v) { c.shopPreview.price = v; })));
    });

    section('Mailing list block', function (k) {
      var r1 = row();
      r1.appendChild(group('Kicker', inp(c.mailingList.kicker, 'Mailing List', function (v) { c.mailingList.kicker = v; })));
      r1.appendChild(group('Heading', inp(c.mailingList.heading, 'Know First.', function (v) { c.mailingList.heading = v; })));
      k.appendChild(r1);
      k.appendChild(group('Text', inp(c.mailingList.text, '', function (v) { c.mailingList.text = v; })));
    });

    section('Shop page', function (k) {
      var r1 = row();
      r1.appendChild(group('Kicker', inp(c.shopPage.kicker, 'Official Merch', function (v) { c.shopPage.kicker = v; })));
      r1.appendChild(group('Heading', inp(c.shopPage.heading, 'The Shop', function (v) { c.shopPage.heading = v; })));
      k.appendChild(r1);
      k.appendChild(group('Postage note', inp(c.shopPage.shippingNote, '', function (v) { c.shopPage.shippingNote = v; })));
    });
  }

  var drawers = { products: drawShop, releases: drawReleases, gallery: drawGallery, content: drawContent };

  document.querySelectorAll('[data-add]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.dataset.add;
      if (t === 'products') {
        DATA.products.push({ id: '', title: '', priceCents: 2500, sizes: ['S', 'M', 'L', 'XL', 'XXL'], image: '', alt: '', description: '' });
      }
      if (t === 'releases') {
        DATA.releases.push({ id: '', title: '', meta: '', image: '', link: '', linkLabel: 'Spotify', youtube: '' });
      }
      drawers[t]();
    });
  });

  document.querySelectorAll('[data-save]').forEach(function (b) {
    b.addEventListener('click', function () { saveData(b.dataset.save); });
  });

  var galUp = $('gallery-upload');
  if (galUp) {
    galUp.addEventListener('change', function () {
      var f = this.files && this.files[0];
      if (!f) return;
      var msg = $('gallery-msg');
      msg.innerHTML = '<span class="adm-hint">Uploading...</span>';
      var body = new FormData();
      body.append('action', 'upload'); body.append('csrf', csrf); body.append('photo', f);
      fetch(API, { method: 'POST', body: body })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; }); })
        .then(function (j) {
          DATA.gallery.push({ src: j.path, alt: '', wide: false });
          drawGallery();
          msg.innerHTML = '<span class="adm-hint">Added - now press Save Gallery.</span>';
        })
        .catch(function (e) { msg.innerHTML = '<span class="toast-err">' + esc(e.message) + '</span>'; });
      this.value = '';
    });
  }

  function loadEverything() {
    ['products', 'releases', 'gallery', 'content'].forEach(function (t) {
      getData(t).then(function () { drawers[t](); }).catch(function () {});
    });
  }

  /* ── editor ───────────────────────────────────────────── */
  function openEditor() {
    show('editor');
    loadSubs();
    loadEverything();
    fetch(API + '?action=list').then(function (r) { return r.json(); }).then(function (d) {
      shows = d.shows || [];
      render();
    });
  }

  function blank() {
    return { id: '', name: '', venue: '', date: '', price: '', ticketLink: '', photos: [] };
  }

  $('add-btn').addEventListener('click', function () {
    shows.push(blank());
    render();
    var cards = document.querySelectorAll('.adm-card');
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function render() {
    var list = $('list');
    $('count').textContent = shows.length + (shows.length === 1 ? ' show' : ' shows');

    if (!shows.length) {
      list.innerHTML = '<div class="adm-empty">No shows yet. Hit <strong>+ Add Show</strong> to put one up.</div>';
      return;
    }

    list.innerHTML = shows.map(function (s, i) { return cardHtml(i, s); }).join('');
    wire();
  }

  /* Why a row won't show up publicly. Returned so the editor can say so
     up front, instead of the gig vanishing silently after a "Saved". */
  function publicStatus(s) {
    if (!String(s.name || '').trim()) return { ok: false, msg: 'Needs a name before it can be saved.' };
    if (!String(s.date || '').trim()) return { ok: false, msg: 'Needs a date — without one this will not appear on the site.' };
    var d = new Date(s.date);
    if (isNaN(d)) return { ok: false, msg: 'That date is not valid.' };
    var cutoff = new Date(); cutoff.setHours(0, 0, 0, 0);
    if (d < cutoff) return { ok: true, past: true, msg: 'Already passed — hidden from visitors, still here for you.' };
    return { ok: true };
  }

  function flagHtml(st) {
    if (st.ok && !st.past) return '';
    return '<p class="' + (st.ok ? 'adm-hint' : 'toast-err') + '" style="margin:0 0 14px">' +
      (st.ok ? '' : '⚠ ') + esc(st.msg) + '</p>';
  }

  function refreshFlag(i) {
    var host = document.querySelector('[data-flag="' + i + '"]');
    if (!host) return;
    var st = publicStatus(shows[i]);
    host.innerHTML = flagHtml(st);
    host.closest('.adm-card').classList.toggle('adm-card-bad', !st.ok);
  }

  function cardHtml(i, s) {
    var st = publicStatus(s);
    return '<div class="adm-card' + (st.ok ? '' : ' adm-card-bad') + '" data-i="' + i + '">' +
      '<div data-flag="' + i + '">' + flagHtml(st) + '</div>' +
      '<div class="adm-row">' +
        field(i, 'name', 'Show / gig name *', s.name, 'Grand Social') +
        field(i, 'venue', 'Venue & location', s.venue, 'Grand Social, Dublin') +
      '</div>' +
      '<div class="adm-row">' +
        dateFields(i, s.date) +
        field(i, 'price', 'Ticket price (€) — blank or 0 = free', s.price, '15') +
      '</div>' +
      field(i, 'ticketLink', 'Ticket link', s.ticketLink, 'https://…') +

      '<div class="form-group" style="margin-bottom:0">' +
        '<label>Photos <span class="adm-hint">(up to 3 — tap to pick, or upload your own)</span></label>' +
        '<div class="chosen" data-chosen="' + i + '">' +
          (s.photos || []).map(function (p, pi) {
            return '<figure><img src="' + esc(p) + '" alt="">' +
                   '<button type="button" data-rm="' + i + '" data-pi="' + pi + '" title="Remove">×</button></figure>';
          }).join('') +
        '</div>' +
        '<div class="pick">' +
          STOCK.map(function (p) {
            var on = (s.photos || []).indexOf(p) > -1 ? ' on' : '';
            return '<img class="' + on.trim() + '" src="' + p + '" data-pick="' + i + '" data-src="' + p + '" alt="">';
          }).join('') +
        '</div>' +
        '<div class="adm-actions">' +
          '<label class="btn btn-outline" style="font-size:11px;cursor:pointer">' +
            'Upload photo<input type="file" accept="image/*" data-up="' + i + '" hidden>' +
          '</label>' +
          '<button type="button" class="btn btn-danger" data-del="' + i + '" style="font-size:11px">Delete show</button>' +
          '<span class="adm-hint" data-up-msg="' + i + '"></span>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

  /* Split day / month / year / time rather than one datetime-local box.
     The native control makes you arrow through the year a digit at a time,
     which is miserable; a select opens the whole list on a tap and still
     accepts typing, because select type-ahead jumps to what you type. */
  function dateFields(i, val) {
    var d = parseDate(val);
    var thisYear = new Date().getFullYear();
    var years = [];
    for (var y = thisYear; y <= thisYear + 6; y++) years.push(y);
    /* Keep an out-of-range year (editing an old gig) selectable. */
    if (d.year && years.indexOf(d.year) === -1) years.unshift(d.year);

    var daysInMonth = (d.year && d.month) ? new Date(d.year, d.month, 0).getDate() : 31;

    var opts = function (list, sel, fmt) {
      return list.map(function (v) {
        return '<option value="' + v + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' +
               (fmt ? fmt(v) : v) + '</option>';
      }).join('');
    };
    var days = []; for (var n = 1; n <= daysInMonth; n++) days.push(n);
    var months = []; for (var m = 1; m <= 12; m++) months.push(m);

    return '<div class="form-group">' +
      '<label>Date &amp; time *</label>' +
      '<div class="date-row">' +
        '<select data-d="day" data-i="' + i + '" aria-label="Day">' +
          '<option value="">Day</option>' + opts(days, d.day) + '</select>' +
        '<select data-d="month" data-i="' + i + '" aria-label="Month">' +
          '<option value="">Month</option>' +
          opts(months, d.month, function (m) { return MONTHS[m - 1]; }) + '</select>' +
        '<select data-d="year" data-i="' + i + '" aria-label="Year">' +
          '<option value="">Year</option>' + opts(years, d.year) + '</select>' +
        '<input type="time" data-d="time" data-i="' + i + '" value="' + esc(d.time) + '" aria-label="Start time">' +
      '</div>' +
    '</div>';
  }

  function parseDate(val) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(String(val || ''));
    if (!m) return { year: '', month: '', day: '', time: '20:00' };
    return { year: +m[1], month: +m[2], day: +m[3], time: m[4] || '20:00' };
  }

  function composeDate(i) {
    var pick = function (k) {
      var el = document.querySelector('[data-d="' + k + '"][data-i="' + i + '"]');
      return el ? el.value : '';
    };
    var y = pick('year'), mo = pick('month'), da = pick('day'), t = pick('time') || '20:00';
    if (!y || !mo || !da) return '';        // incomplete = no date, and the flag says so
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return y + '-' + pad(mo) + '-' + pad(da) + 'T' + t;
  }

  function field(i, key, label, val, ph, type) {
    return '<div class="form-group">' +
      '<label>' + label + '</label>' +
      '<input type="' + (type || 'text') + '" data-f="' + key + '" data-i="' + i + '" ' +
        'value="' + esc(val) + '" placeholder="' + esc(ph || '') + '">' +
    '</div>';
  }

  function wire() {
    /* text fields */
    document.querySelectorAll('[data-f]').forEach(function (el) {
      el.addEventListener('input', function () {
        shows[+el.dataset.i][el.dataset.f] = el.value;
        refreshFlag(+el.dataset.i);
        dirty();
      });
    });

    /* date parts */
    document.querySelectorAll('[data-d]').forEach(function (el) {
      el.addEventListener('change', function () {
        var i = +el.dataset.i;
        shows[i].date = composeDate(i);
        /* Changing month or year can shorten the month — redraw so 31 Feb
           can't be left selected. */
        if (el.dataset.d === 'month' || el.dataset.d === 'year') { render(); }
        else { refreshFlag(i); }
        dirty();
      });
    });

    /* stock picker — toggles, capped at 3 */
    document.querySelectorAll('[data-pick]').forEach(function (el) {
      el.addEventListener('click', function () {
        var s = shows[+el.dataset.pick];
        s.photos = s.photos || [];
        var at = s.photos.indexOf(el.dataset.src);
        if (at > -1) { s.photos.splice(at, 1); }
        else if (s.photos.length >= 3) { return; }
        else { s.photos.push(el.dataset.src); }
        render(); dirty();
      });
    });

    /* remove a chosen photo */
    document.querySelectorAll('[data-rm]').forEach(function (el) {
      el.addEventListener('click', function () {
        shows[+el.dataset.rm].photos.splice(+el.dataset.pi, 1);
        render(); dirty();
      });
    });

    /* delete show */
    document.querySelectorAll('[data-del]').forEach(function (el) {
      el.addEventListener('click', function () {
        var s = shows[+el.dataset.del];
        if (!confirm('Delete "' + (s.name || 'this show') + '"? It disappears from the site when you save.')) return;
        shows.splice(+el.dataset.del, 1);
        render(); dirty();
      });
    });

    /* upload */
    document.querySelectorAll('[data-up]').forEach(function (el) {
      el.addEventListener('change', function () {
        var i = +el.dataset.up;
        var msg = document.querySelector('[data-up-msg="' + i + '"]');
        if (!el.files || !el.files[0]) return;
        if ((shows[i].photos || []).length >= 3) { msg.textContent = 'Already 3 photos.'; return; }
        msg.textContent = 'Uploading…';
        var body = new FormData();
        body.append('action', 'upload');
        body.append('csrf', csrf);
        body.append('photo', el.files[0]);
        fetch(API, { method: 'POST', body: body })
          .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; }); })
          .then(function (j) {
            shows[i].photos = shows[i].photos || [];
            shows[i].photos.push(j.path);
            render(); dirty();
          })
          .catch(function (e) { msg.textContent = e.message; });
      });
    });
  }

  function dirty() {
    $('save-msg').innerHTML = '<span class="adm-hint">Unsaved changes</span>';
  }

  /* ── save ─────────────────────────────────────────────── */
  $('save-btn').addEventListener('click', function () {
    var btn = this;

    /* Same checks the server runs, surfaced before the round trip so the
       reason lands next to the field that caused it. */
    var blocking = shows
      .map(function (s, i) { return { i: i, st: publicStatus(s) }; })
      .filter(function (x) { return !x.st.ok; });
    if (blocking.length) {
      blocking.forEach(function (x) { refreshFlag(x.i); });
      $('save-msg').innerHTML = '<span class="toast-err">Nothing saved — ' +
        blocking.length + (blocking.length === 1 ? ' show needs' : ' shows need') +
        ' fixing above.</span>';
      document.querySelector('.adm-card-bad').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    btn.disabled = true;
    $('save-msg').innerHTML = '<span class="adm-hint">Saving…</span>';
    post('save', { shows: JSON.stringify(shows) }).then(function (r) {
      $('save-msg').innerHTML = '<span class="toast-ok">Saved — ' + r.count + ' live on the site.</span>';
      btn.disabled = false;
      openEditor();                       // re-read so ids/order match the server
    }).catch(function (e) {
      $('save-msg').innerHTML = '<span class="toast-err">' + esc(e.message) + '</span>';
      btn.disabled = false;
    });
  });
})();
