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

  /* ── editor ───────────────────────────────────────────── */
  function openEditor() {
    show('editor');
    loadSubs();
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
