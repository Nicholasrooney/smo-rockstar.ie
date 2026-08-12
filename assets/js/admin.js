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

  /* ── editor ───────────────────────────────────────────── */
  function openEditor() {
    show('editor');
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

  function cardHtml(i, s) {
    return '<div class="adm-card" data-i="' + i + '">' +
      '<div class="adm-row">' +
        field(i, 'name', 'Show / gig name', s.name, 'Grand Social') +
        field(i, 'venue', 'Venue & location', s.venue, 'Grand Social, Dublin') +
      '</div>' +
      '<div class="adm-row">' +
        field(i, 'date', 'Date & time', s.date, '', 'datetime-local') +
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
