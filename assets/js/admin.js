import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, orderBy, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig, ADMIN_EMAIL } from './firebase-config.js';

// ── INIT ──
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ── ELEMENTS ──
const loginSection = document.getElementById('login-section');
const adminPanel = document.getElementById('admin-panel');
const loginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const showsTableBody = document.getElementById('shows-body');
const newShowBtn = document.getElementById('new-show-btn');
const modal = document.getElementById('show-modal');
const modalTitle = document.getElementById('modal-title');
const showForm = document.getElementById('show-form');
const cancelModal = document.getElementById('cancel-modal');
const saveShowBtn = document.getElementById('save-show-btn');

let editingId = null;

// ── AUTH STATE ──
onAuthStateChanged(auth, user => {
  if (user && user.email === ADMIN_EMAIL) {
    loginSection.classList.add('hidden');
    adminPanel.classList.remove('hidden');
    if (userAvatar) userAvatar.src = user.photoURL || '';
    if (userName) userName.textContent = user.displayName || user.email;
    loadShows();
  } else {
    loginSection.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    if (user) {
      auth.signOut();
      showToast('Access denied. Only Sam can log in here.');
    }
  }
});

// ── LOGIN ──
loginBtn?.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) {
    showToast('Login failed: ' + e.message);
  }
});

// ── LOGOUT ──
logoutBtn?.addEventListener('click', () => signOut(auth));

// ── LOAD SHOWS ──
async function loadShows() {
  if (!showsTableBody) return;
  showsTableBody.innerHTML = '<tr><td colspan="6" style="color:var(--grey);text-align:center;padding:30px">Loading...</td></tr>';

  try {
    const q = query(collection(db, 'shows'), orderBy('date', 'asc'));
    const snap = await getDocs(q);

    if (snap.empty) {
      showsTableBody.innerHTML = '<tr><td colspan="6" style="color:var(--grey);text-align:center;padding:30px">No shows yet. Click "+ New Show" to add one.</td></tr>';
      return;
    }

    showsTableBody.innerHTML = snap.docs.map(d => {
      const s = { id: d.id, ...d.data() };
      const date = new Date(s.date);
      const dateStr = date.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
      const price = s.price === '0' || s.price === 0 ? 'Free' : `€${s.price}`;
      return `
        <tr>
          <td>${dateStr} ${timeStr}</td>
          <td>${s.name}</td>
          <td>${s.venue}</td>
          <td>${price}</td>
          <td>${s.ticketLink ? `<a href="${s.ticketLink}" target="_blank" style="color:var(--red);font-size:11px">Link ↗</a>` : '—'}</td>
          <td>
            <div class="action-btns">
              <button class="btn btn-outline btn-sm" onclick="editShow('${s.id}', ${JSON.stringify(s).replace(/'/g, "&#39;")})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="deleteShow('${s.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    showsTableBody.innerHTML = `<tr><td colspan="6" style="color:var(--red)">Error: ${e.message}</td></tr>`;
  }
}

// ── NEW SHOW MODAL ──
newShowBtn?.addEventListener('click', () => {
  editingId = null;
  if (modalTitle) modalTitle.textContent = 'New Show';
  showForm?.reset();
  modal?.classList.remove('hidden');
});

cancelModal?.addEventListener('click', () => modal?.classList.add('hidden'));

modal?.addEventListener('click', e => {
  if (e.target === modal) modal.classList.add('hidden');
});

// ── SAVE SHOW ──
showForm?.addEventListener('submit', async e => {
  e.preventDefault();
  saveShowBtn.disabled = true;
  saveShowBtn.textContent = 'Saving...';

  const data = {
    name: document.getElementById('f-name').value.trim(),
    venue: document.getElementById('f-venue').value.trim(),
    date: document.getElementById('f-date').value,
    price: document.getElementById('f-price').value.trim() || '0',
    ticketLink: document.getElementById('f-tickets').value.trim(),
    updatedAt: serverTimestamp()
  };

  try {
    if (editingId) {
      await updateDoc(doc(db, 'shows', editingId), data);
      showToast('Show updated ✓');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'shows'), data);
      showToast('Show added ✓');
    }
    modal.classList.add('hidden');
    loadShows();
  } catch (err) {
    showToast('Error: ' + err.message);
  }

  saveShowBtn.disabled = false;
  saveShowBtn.textContent = 'Save Show';
});

// ── EDIT ──
window.editShow = (id, show) => {
  editingId = id;
  if (modalTitle) modalTitle.textContent = 'Edit Show';
  document.getElementById('f-name').value = show.name || '';
  document.getElementById('f-venue').value = show.venue || '';
  // Format datetime-local value
  const d = new Date(show.date);
  const pad = n => n.toString().padStart(2, '0');
  document.getElementById('f-date').value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  document.getElementById('f-price').value = show.price || '';
  document.getElementById('f-tickets').value = show.ticketLink || '';
  modal?.classList.remove('hidden');
};

// ── DELETE ──
window.deleteShow = async (id) => {
  if (!confirm('Delete this show?')) return;
  try {
    await deleteDoc(doc(db, 'shows', id));
    showToast('Show deleted');
    loadShows();
  } catch (e) {
    showToast('Error: ' + e.message);
  }
};

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
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 3500);
}
