'use strict';

// ================================================================
//  CONSTANTS
// ================================================================

const SPIN_COST = 10;

const RARITIES = {
  common:      { name: 'Common',    color: '#9e9e9e', cls: 'rarity-common',      peCls: 'pe-common'     },
  uncommon:    { name: 'Uncommon',  color: '#57f287', cls: 'rarity-uncommon',    peCls: 'pe-uncommon'   },
  item_rarity: { name: 'Item',      color: '#cc44ff', cls: 'rarity-item_rarity', peCls: 'pe-item_rarity'},
  rare:        { name: 'Rare',      color: '#5865f2', cls: 'rarity-rare',        peCls: 'pe-rare'       },
  legendary:   { name: 'Legendary', color: '#ffd700', cls: 'rarity-legendary',   peCls: 'pe-legendary'  },
  mythical:    { name: 'Mythical',  color: '#ff8c00', cls: 'rarity-mythical',    peCls: 'pe-mythical'   },
  spec:        { name: 'Spec',      color: '#dc143c', cls: 'rarity-spec',        peCls: 'pe-spec'       },
};

// ================================================================
//  STORAGE
// ================================================================

function getUsers()   { return JSON.parse(localStorage.getItem('gacha_users')   || '[]'); }
function saveUsers(u) { localStorage.setItem('gacha_users',   JSON.stringify(u)); }
function getPool()    { return JSON.parse(localStorage.getItem('gacha_pool')    || '[]'); }
function savePool(p)  { localStorage.setItem('gacha_pool',    JSON.stringify(p)); }

// ================================================================
//  STATE
// ================================================================

let currentUser = null;
let isSpinning  = false;

// ================================================================
//  INIT
// ================================================================

function init() {
  // Ensure admin account exists
  const users = getUsers();
  if (!users.find(u => u.isAdmin)) {
    users.push({
      id: 'admin',
      email: 'admin@gacha.gg',
      username: 'admin',
      password: hashPw('Admin123!'),
      silver: 999999,
      isAdmin: true,
      inventory: [],
    });
    saveUsers(users);
  }

  // Restore session
  const raw = localStorage.getItem('gacha_session');
  if (raw) {
    const saved = JSON.parse(raw);
    const fresh = getUsers().find(u => u.id === saved.id);
    if (fresh) currentUser = fresh;
  }

  renderHeader();
  showView('slot');
  renderPool();
}

// ================================================================
//  SIMPLE PASSWORD HASH (demo only — not cryptographic)
// ================================================================

function hashPw(pw) {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) h = ((h << 5) + h) ^ pw.charCodeAt(i);
  return 'gh_' + (h >>> 0).toString(36) + '_' + pw.length;
}

// ================================================================
//  HEADER
// ================================================================

function renderHeader() {
  const $ = id => document.getElementById(id);
  if (currentUser) {
    $('authButtons').classList.add('hidden');
    $('userInfo').classList.remove('hidden');
    $('headerUsername').textContent = currentUser.username;
    $('silverAmount').textContent   = currentUser.silver.toLocaleString();
    $('silverDisplay').style.visibility = 'visible';
    $('adminNavBtn').classList.toggle('hidden', !currentUser.isAdmin);
  } else {
    $('authButtons').classList.remove('hidden');
    $('userInfo').classList.add('hidden');
    $('silverAmount').textContent = '—';
    $('adminNavBtn').classList.add('hidden');
  }
}

function refreshSilver() {
  if (currentUser) document.getElementById('silverAmount').textContent = currentUser.silver.toLocaleString();
}

// ================================================================
//  VIEW ROUTING
// ================================================================

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view' + cap(name)).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nb = document.querySelector(`.nav-btn[onclick="showView('${name}')"]`);
  if (nb) nb.classList.add('active');
  if (name === 'admin') {
    if (!currentUser?.isAdmin) { showView('slot'); return; }
    renderAdmin();
  }
}

function goShop() {
  if (!currentUser) { showModal('login'); return; }
  showView('shop');
}

// ================================================================
//  MODALS
// ================================================================

function showModal(type) {
  document.getElementById('modal' + cap(type)).classList.remove('hidden');
}
function hideModal(type) {
  const m = document.getElementById('modal' + cap(type));
  m.classList.add('hidden');
  const err = document.getElementById(type + 'Error');
  if (err) { err.classList.add('hidden'); err.textContent = ''; }
}
function overlayClose(e, type) { if (e.target === e.currentTarget) hideModal(type); }
function switchModal(from, to) { hideModal(from); showModal(to); }

// ================================================================
//  PASSWORD HINTS
// ================================================================

function updateHints() {
  const pw = document.getElementById('signupPassword').value;
  document.getElementById('hintLen') .classList.toggle('ok', pw.length >= 8);
  document.getElementById('hintSpec').classList.toggle('ok', /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(pw));
}

function validatePw(pw) {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(pw)) return 'Password must contain at least one special character.';
  return null;
}

// ================================================================
//  AUTH — SIGN UP
// ================================================================

function signup(e) {
  e.preventDefault();
  const email    = document.getElementById('signupEmail').value.trim();
  const username = document.getElementById('signupUsername').value.trim();
  const password = document.getElementById('signupPassword').value;

  const pwErr = validatePw(password);
  if (pwErr) { showErr('signupError', pwErr); return; }

  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    showErr('signupError', 'Username already taken — choose another.'); return;
  }
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    showErr('signupError', 'Email already registered.'); return;
  }

  const newUser = {
    id: 'u_' + Date.now(),
    email, username,
    password: hashPw(password),
    silver: 0, isAdmin: false, inventory: [],
  };
  users.push(newUser);
  saveUsers(users);

  currentUser = newUser;
  localStorage.setItem('gacha_session', JSON.stringify({ id: newUser.id }));
  hideModal('signup');
  renderHeader();
  notify('Welcome to Gacha, ' + username + '!', 'success');
  document.getElementById('signupUsername').closest('form').reset();
}

// ================================================================
//  AUTH — LOGIN
// ================================================================

function login(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  const user = getUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || user.password !== hashPw(password)) {
    showErr('loginError', 'Incorrect username or password.'); return;
  }

  currentUser = user;
  localStorage.setItem('gacha_session', JSON.stringify({ id: user.id }));
  hideModal('login');
  renderHeader();
  notify('Welcome back, ' + user.username + '!', 'success');
  document.getElementById('loginUsername').closest('form').reset();
  if (user.isAdmin) renderAdmin();
}

// ================================================================
//  AUTH — LOGOUT
// ================================================================

function logout() {
  currentUser = null;
  localStorage.removeItem('gacha_session');
  renderHeader();
  showView('slot');
  notify('Logged out.', 'info');
}

// ================================================================
//  SLOT MACHINE
// ================================================================

function renderCase(index, item) {
  const card    = document.getElementById('case' + index);
  const tname   = document.getElementById('tname' + index);
  const tdesc   = document.getElementById('tdesc' + index);

  if (!item) {
    card.className = 'case-item';
    card.innerHTML = '<div class="item-display empty"><span class="empty-icon">?</span></div>';
    tname.textContent = '';
    tdesc.textContent = '';
    return;
  }

  const r = RARITIES[item.rarity] || RARITIES.common;
  card.className = 'case-item ' + r.cls;
  card.innerHTML = `
    <div class="item-display">
      <span class="item-icon">${item.type === 'account' ? '👤' : '📦'}</span>
      <div class="item-name">${esc(item.name)}</div>
      <div class="item-badge">${item.type}</div>
      <div class="item-rarity">${r.name}</div>
    </div>`;

  tname.textContent = item.name;
  tdesc.textContent = item.description || 'No description available.';
}

async function spinReel(index, finalItem, stopMs) {
  const pool = getPool();
  return new Promise(resolve => {
    const start = Date.now();
    let delay = 55;

    function tick() {
      const elapsed = Date.now() - start;
      if (elapsed >= stopMs) { renderCase(index, finalItem); resolve(); return; }

      const rnd = pool[Math.floor(Math.random() * pool.length)];
      renderCase(index, rnd);

      // Gradually slow down
      const prog = elapsed / stopMs;
      if      (prog > 0.9)  delay = 260;
      else if (prog > 0.78) delay = 170;
      else if (prog > 0.62) delay = 110;

      setTimeout(tick, delay);
    }
    tick();
  });
}

async function spin() {
  if (isSpinning) return;
  if (!currentUser) { showModal('login'); return; }

  const pool = getPool();
  if (pool.length === 0) { notify('The item pool is empty — ask the admin to add items.', 'error'); return; }
  if (currentUser.silver < SPIN_COST) { notify('Not enough silver! Click ◈ to buy more.', 'error'); return; }

  // Deduct silver
  currentUser.silver -= SPIN_COST;
  syncUser();
  refreshSilver();

  document.getElementById('winBanner').classList.add('hidden');
  isSpinning = true;
  document.getElementById('spinBtn').disabled = true;

  // Pick results
  const pick = () => pool[Math.floor(Math.random() * pool.length)];
  const results = [pick(), pick(), pick()];

  await Promise.all([
    spinReel(0, results[0], 1500),
    spinReel(1, results[1], 2100),
    spinReel(2, results[2], 2700),
  ]);

  isSpinning = false;
  document.getElementById('spinBtn').disabled = false;

  // Win check: all 3 match
  if (results[0].id === results[1].id && results[1].id === results[2].id) {
    awardWin(results[0]);
  }
}

function awardWin(item) {
  const r = RARITIES[item.rarity] || RARITIES.common;

  // Win banner
  document.getElementById('winItemDisplay').innerHTML =
    `<span class="${r.cls}" style="font-size:16px;font-weight:700;">`
    + (item.type === 'account' ? '👤' : '📦') + ' ' + esc(item.name) + '</span>'
    + `<span style="margin-left:8px;font-size:12px;color:var(--text3)">(${r.name})</span>`;
  document.getElementById('winBanner').classList.remove('hidden');

  // Add to user inventory
  currentUser.inventory = currentUser.inventory || [];
  currentUser.inventory.push({ ...item, wonAt: Date.now() });
  syncUser();
  notify('🎉 You won: ' + item.name + '!', 'success');
}

// ================================================================
//  SHOP
// ================================================================

function purchaseSilver(amount, usd) {
  if (!currentUser) { showModal('login'); return; }
  currentUser.silver += amount;
  syncUser();
  refreshSilver();
  notify(`+ ${amount} Silver added! ($${usd}.00 charged)`, 'success');
}

// ================================================================
//  ADMIN — ITEM POOL
// ================================================================

function addItem(e) {
  e.preventDefault();
  const name   = document.getElementById('itemName').value.trim();
  const desc   = document.getElementById('itemDesc').value.trim();
  const type   = document.getElementById('itemType').value;
  const rarity = document.getElementById('itemRarity').value;
  if (!name) return;

  const pool = getPool();
  pool.push({ id: 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2), name, description: desc, type, rarity });
  savePool(pool);
  renderPool();
  document.getElementById('addItemForm').reset();
  notify('Item added to pool.', 'success');
}

function removeItem(id) {
  savePool(getPool().filter(i => i.id !== id));
  renderPool();
}

function renderPool() {
  const pool      = getPool();
  const container = document.getElementById('itemPool');
  const countEl   = document.getElementById('poolCount');
  if (!container) return;

  countEl.textContent = `(${pool.length})`;

  if (pool.length === 0) {
    container.innerHTML = '<p class="empty-state">No items in pool yet.</p>';
    return;
  }

  container.innerHTML = pool.map(item => {
    const r = RARITIES[item.rarity] || RARITIES.common;
    const descPreview = item.description ? ' · ' + esc(item.description.slice(0, 42)) + (item.description.length > 42 ? '…' : '') : '';
    return `<div class="pool-entry ${r.peCls}">
      <div class="pool-entry-info">
        <span class="pool-entry-name">${esc(item.name)}</span>
        <span class="pool-entry-meta">${r.name} · ${item.type}${descPreview}</span>
      </div>
      <button class="btn-x" onclick="removeItem('${item.id}')" title="Remove">✕</button>
    </div>`;
  }).join('');
}

// ================================================================
//  ADMIN — USERS
// ================================================================

function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  const users = getUsers().filter(u => !u.isAdmin);
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No users yet.</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(u => {
    const wins = (u.inventory || []).length;
    return `<tr>
      <td><strong>${esc(u.username)}</strong></td>
      <td style="color:var(--text3)">${esc(u.email)}</td>
      <td>◈ ${u.silver.toLocaleString()}</td>
      <td>${wins} item${wins !== 1 ? 's' : ''}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="adminAddSilver('${u.id}', 100)">+100 ◈</button>
      </td>
    </tr>`;
  }).join('');
}

function adminAddSilver(userId, amount) {
  const users = getUsers();
  const u = users.find(x => x.id === userId);
  if (!u) return;
  u.silver += amount;
  saveUsers(users);
  if (currentUser && currentUser.id === userId) { currentUser = u; localStorage.setItem('gacha_session', JSON.stringify({ id: u.id })); refreshSilver(); }
  renderUsersTable();
  notify(`Added ${amount} silver to ${u.username}.`, 'success');
}

function renderAdmin() {
  renderPool();
  renderUsersTable();
}

// ================================================================
//  SYNC USER
// ================================================================

function syncUser() {
  if (!currentUser) return;
  const users = getUsers();
  const idx = users.findIndex(u => u.id === currentUser.id);
  if (idx !== -1) { users[idx] = currentUser; saveUsers(users); }
}

// ================================================================
//  NOTIFICATION
// ================================================================

let notifTimer = null;
function notify(msg, type = 'info') {
  const el = document.getElementById('notification');
  el.className = 'notification ' + type;
  document.getElementById('notifText').textContent = msg;
  if (notifTimer) clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

// ================================================================
//  UTILS
// ================================================================

function showErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ================================================================
//  BOOT
// ================================================================

document.addEventListener('DOMContentLoaded', init);
