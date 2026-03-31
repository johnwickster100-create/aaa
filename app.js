'use strict';

// ================================================================
//  CONSTANTS
// ================================================================

const API            = 'http://localhost:3001/api';
const SPIN_COST      = 50;
const ADMIN_USERNAME = 'GodlyAncientChampion';

const RARITIES = {
  common:      { name: 'Common',    color: '#9e9e9e', cls: 'rarity-common',      peCls: 'pe-common'     },
  uncommon:    { name: 'Uncommon',  color: '#57f287', cls: 'rarity-uncommon',    peCls: 'pe-uncommon'   },
  item_rarity: { name: 'Item',      color: '#cc44ff', cls: 'rarity-item_rarity', peCls: 'pe-item_rarity'},
  rare:        { name: 'Rare',      color: '#5865f2', cls: 'rarity-rare',        peCls: 'pe-rare'       },
  legendary:   { name: 'Legendary', color: '#ffd700', cls: 'rarity-legendary',   peCls: 'pe-legendary'  },
  mythical:    { name: 'Mythical',  color: '#ff8c00', cls: 'rarity-mythical',    peCls: 'pe-mythical'   },
  spec:        { name: 'Spec',      color: '#dc143c', cls: 'rarity-spec',        peCls: 'pe-spec'       },
};

const WIN_CHANCE = 0.10;

const RARITY_WEIGHTS = [
  { rarity: 'common',      weight: 44.44 },
  { rarity: 'uncommon',    weight: 30    },
  { rarity: 'item_rarity', weight: 20    },
  { rarity: 'rare',        weight: 5     },
  { rarity: 'legendary',   weight: 0.5   },
  { rarity: 'mythical',    weight: 0.05  },
  { rarity: 'spec',        weight: 0.01  },
];

const LOSE_RARITY_WEIGHTS = [
  { rarity: 'common',      weight: 40  },
  { rarity: 'uncommon',    weight: 28  },
  { rarity: 'item_rarity', weight: 18  },
  { rarity: 'rare',        weight: 9   },
  { rarity: 'legendary',   weight: 3.5 },
  { rarity: 'mythical',    weight: 1   },
  { rarity: 'spec',        weight: 0.5 },
];

// ================================================================
//  STORAGE
// ================================================================

function getPool()   { return JSON.parse(localStorage.getItem('gacha_pool') || '[]'); }
function savePool(p) { localStorage.setItem('gacha_pool', JSON.stringify(p)); }

function getToken()       { return localStorage.getItem('gacha_jwt') || null; }
function saveToken(t)     { localStorage.setItem('gacha_jwt', t); }
function clearToken()     { localStorage.removeItem('gacha_jwt'); }

// Per-user history keys
function txKey()    { return 'gacha_tx_'    + (currentUser?.id ?? 'anon'); }
function spinKey()  { return 'gacha_spins_' + (currentUser?.id ?? 'anon'); }
function getTxs()   { return JSON.parse(localStorage.getItem(txKey())   || '[]'); }
function getSpins() { return JSON.parse(localStorage.getItem(spinKey()) || '[]'); }

function logTx(delta, label) {
  if (!currentUser) return;
  const txs = getTxs();
  txs.unshift({ ts: Date.now(), delta, label, balance: currentUser.silver_balance });
  if (txs.length > 150) txs.length = 150;
  localStorage.setItem(txKey(), JSON.stringify(txs));
}

function logSpin(items, isWin, winItem) {
  if (!currentUser) return;
  const spins = getSpins();
  spins.unshift({
    ts: Date.now(),
    slots: items.map(i => ({ name: i.name, rarity: i.rarity })),
    isWin,
    winItem: winItem ? { name: winItem.name, rarity: winItem.rarity } : null,
    cost: SPIN_COST,
  });
  if (spins.length > 200) spins.length = 200;
  localStorage.setItem(spinKey(), JSON.stringify(spins));
}

// ================================================================
//  STATE
// ================================================================

let currentUser = null;
let isSpinning  = false;

// ================================================================
//  API HELPER
// ================================================================

async function apiRequest(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const url = API + path;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    console.error(`[fetch] ${method} ${url} → network error:`, networkErr);
    throw new Error('Cannot reach the server. Make sure the backend is running on ' + API);
  }

  let data;
  try {
    data = await res.json();
  } catch (parseErr) {
    console.error(`[fetch] ${method} ${url} → non-JSON response (status ${res.status})`);
    throw new Error('Unexpected server response (status ' + res.status + ').');
  }

  if (!res.ok) {
    console.warn(`[fetch] ${method} ${url} → ${res.status}`, data);
    throw new Error(data.error || 'Request failed.');
  }

  console.debug(`[fetch] ${method} ${url} → ${res.status} OK`);
  return data;
}

// ================================================================
//  18+ DISCLAIMER
// ================================================================

const DISCLAIMER_KEY = 'gacha_18_accepted';

function hasAcceptedDisclaimer() {
  return localStorage.getItem(DISCLAIMER_KEY) === '1';
}

function acceptDisclaimer() {
  localStorage.setItem(DISCLAIMER_KEY, '1');
  document.getElementById('modalDisclaimer').classList.add('hidden');
  initAfterDisclaimer();
}

// ================================================================
//  INIT
// ================================================================

async function init() {
  if (!hasAcceptedDisclaimer()) {
    // Show disclaimer — block everything until accepted
    document.getElementById('modalDisclaimer').classList.remove('hidden');
    return;
  }
  await initAfterDisclaimer();
}

async function initAfterDisclaimer() {
  renderHeader();
  renderPool();

  const token = getToken();
  if (token) {
    try {
      const user = await apiRequest('GET', '/auth/me');
      currentUser = user;
      renderHeader();
    } catch {
      clearToken();
    }
  }

  // Always show the casino/games view after disclaimer
  showView('slot');

  // Global click guard: any click while logged out triggers login modal
  document.addEventListener('click', globalClickGuard);
  // Close username dropdown on any outside click
  document.addEventListener('click', () => closeUserMenu());
}

// ================================================================
//  GLOBAL CLICK GUARD  (non-logged-in users → show login)
// ================================================================

let suppressGuard = false;

function globalClickGuard(e) {
  if (suppressGuard) return;
  if (currentUser) return; // already logged in

  // Let clicks inside any modal overlay pass through (modals handle themselves)
  if (e.target.closest('.modal-overlay')) return;

  // Don't stack login modals
  const loginModal = document.getElementById('modalLogin');
  if (loginModal && !loginModal.classList.contains('hidden')) return;

  showModal('login');
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
    $('silverAmount').textContent   = currentUser.silver_balance.toLocaleString();

    const adminBtn = $('adminMenuBtn');
    if (adminBtn) adminBtn.classList.toggle('hidden', currentUser.username !== ADMIN_USERNAME);
  } else {
    $('authButtons').classList.remove('hidden');
    $('userInfo').classList.add('hidden');
    $('silverAmount').textContent = '—';
  }
}

function refreshSilver() {
  if (currentUser) {
    document.getElementById('silverAmount').textContent = currentUser.silver_balance.toLocaleString();
  }
}

// ================================================================
//  USER MENU DROPDOWN
// ================================================================

function toggleUserMenu(e) {
  e.stopPropagation();
  const menu = document.getElementById('userMenu');
  menu.classList.toggle('hidden');
}

function closeUserMenu() {
  const menu = document.getElementById('userMenu');
  if (menu) menu.classList.add('hidden');
}

function openAdmin() {
  closeUserMenu();
  if (currentUser?.username !== ADMIN_USERNAME) return;
  showView('admin');
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
  if (name === 'admin') renderAdmin();
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
//  PASSWORD HINTS (signup)
// ================================================================

function updateHints() {
  const pw = document.getElementById('signupPassword').value;
  document.getElementById('hintLen') .classList.toggle('ok', pw.length >= 8);
  document.getElementById('hintSpec').classList.toggle('ok', /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(pw));
}

// ================================================================
//  AUTH — SIGN UP
// ================================================================

async function signup(e) {
  e.preventDefault();
  const email    = document.getElementById('signupEmail').value.trim();
  const username = document.getElementById('signupUsername').value.trim();
  const password = document.getElementById('signupPassword').value;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    const { token, user } = await apiRequest('POST', '/auth/signup', { email, username, password });
    saveToken(token);
    currentUser = user;
    hideModal('signup');
    renderHeader();
    // After sign-up, take the user into the casino
    showView('slot');
    notify('Welcome to Gacha, ' + user.username + '!', 'success');
    e.target.reset();
  } catch (err) {
    showErr('signupError', err.message);
  } finally {
    btn.disabled = false;
  }
}

// ================================================================
//  AUTH — LOGIN
// ================================================================

async function login(e) {
  e.preventDefault();
  // The field accepts email OR username; backend handles both
  const identifier = document.getElementById('loginUsername').value.trim();
  const password   = document.getElementById('loginPassword').value;
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    const { token, user } = await apiRequest('POST', '/auth/login', { identifier, password });
    saveToken(token);
    currentUser = user;
    hideModal('login');
    renderHeader();
    // After login, take the user into the casino
    showView('slot');
    notify('Welcome back, ' + user.username + '!', 'success');
    e.target.reset();
  } catch (err) {
    // Backend returns specific strings: "Can't find email." or "Wrong password."
    // showErr() surfaces them directly below the form
    showErr('loginError', err.message);
  } finally {
    btn.disabled = false;
  }
}

// ================================================================
//  AUTH — LOGOUT
// ================================================================

function logout() {
  // Suppress click guard for this event so login modal doesn't auto-pop on logout click
  suppressGuard = true;
  setTimeout(() => { suppressGuard = false; }, 0);

  closeUserMenu();
  currentUser = null;
  clearToken();
  renderHeader();
  showView('slot');
  notify('Logged out.', 'info');
}

// ================================================================
//  FORGOT PASSWORD  (mock — no real email sending)
// ================================================================

async function forgotPassword() {
  const email  = document.getElementById('forgotPwEmail').value.trim();
  const errEl  = document.getElementById('forgotPwError');
  const sucEl  = document.getElementById('forgotPwSuccess');
  const btn    = document.getElementById('forgotPwBtn');

  // Clear previous messages
  errEl.classList.add('hidden'); errEl.textContent = '';
  sucEl.classList.add('hidden'); sucEl.textContent = '';

  // Basic email validation — show "Can't find email" for blank/invalid input
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRe.test(email)) {
    errEl.textContent = "Can't find email.";
    errEl.classList.remove('hidden');
    return;
  }

  // Simulate a network round-trip so the UX feels real
  btn.disabled = true;
  btn.textContent = 'Sending…';
  await new Promise(r => setTimeout(r, 900));
  btn.disabled = false;
  btn.textContent = 'Send Reset Email';

  // Mock result: any properly-formatted email is treated as "found"
  // In production this would call POST /api/auth/forgot-password and
  // the backend would send a real email only if the address exists.
  sucEl.textContent = 'Check your email for reset instructions.';
  sucEl.classList.remove('hidden');
  document.getElementById('forgotPwEmail').value = '';
}

// ================================================================
//  SETTINGS MODAL
// ================================================================

function openSettings() {
  closeUserMenu();
  if (!currentUser) return;

  document.getElementById('setUsername').textContent = currentUser.username;
  document.getElementById('setEmail').textContent    = currentUser.email;
  document.getElementById('unverifiedDot').classList.toggle('hidden', !!currentUser.email_verified);

  // Reset change-pw form
  document.getElementById('changePwBox').classList.add('hidden');
  ['cpCurrent', 'cpNew', 'cpConfirm'].forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.type  = 'password';
  });
  document.querySelectorAll('.pw-eye').forEach(b => b.textContent = '👁');

  renderTxHistory();
  renderSpinHistory();
  showModal('settings');
}

function toggleChangePwForm() {
  const box = document.getElementById('changePwBox');
  box.classList.toggle('hidden');
  const errEl = document.getElementById('changePwError');
  errEl.classList.add('hidden');
  errEl.textContent = '';
}

function togglePwField(id, btn) {
  const input = document.getElementById(id);
  if (input.type === 'password') { input.type = 'text';     btn.textContent = '🙈'; }
  else                           { input.type = 'password'; btn.textContent = '👁'; }
}

async function changePassword() {
  const current = document.getElementById('cpCurrent').value;
  const newPw   = document.getElementById('cpNew').value;
  const confirm = document.getElementById('cpConfirm').value;

  if (!current || !newPw || !confirm) { showErr('changePwError', 'All fields are required.'); return; }
  if (newPw !== confirm)              { showErr('changePwError', 'New passwords do not match.'); return; }

  const btn = document.getElementById('changePwBtn');
  btn.disabled = true;
  try {
    await apiRequest('PATCH', '/auth/password', { currentPassword: current, newPassword: newPw });
    notify('Password updated!', 'success');
    toggleChangePwForm();
  } catch (err) {
    showErr('changePwError', err.message);
  } finally {
    btn.disabled = false;
  }
}

function renderTxHistory() {
  const el = document.getElementById('txList');
  if (!el || !currentUser) return;
  const txs = getTxs();

  if (txs.length === 0) { el.innerHTML = '<p class="empty-state">No transactions yet.</p>'; return; }

  el.innerHTML = txs.map(tx => {
    const isPos = tx.delta > 0;
    const date  = fmtDate(tx.ts);
    return `<div class="hist-entry">
      <div class="hist-info">
        <span class="hist-label">${esc(tx.label)}</span>
        <span class="hist-date">${date}</span>
      </div>
      <span class="hist-delta ${isPos ? 'delta-pos' : 'delta-neg'}">${isPos ? '+' : ''}${tx.delta.toLocaleString()} ◈</span>
    </div>`;
  }).join('');
}

function renderSpinHistory() {
  const el = document.getElementById('spinHistList');
  if (!el || !currentUser) return;
  const spins = getSpins();

  if (spins.length === 0) { el.innerHTML = '<p class="empty-state">No spins yet.</p>'; return; }

  el.innerHTML = spins.map(sp => {
    const date      = fmtDate(sp.ts);
    const slotsHtml = sp.slots.map(s => {
      const r = RARITIES[s.rarity] || RARITIES.common;
      return `<span style="color:${r.color || '#cc44ff'}">${esc(s.name)}</span>`;
    }).join(' · ');
    const result = sp.isWin
      ? `<span class="hist-win">WIN!</span>`
      : `<span class="hist-loss">-${sp.cost} ◈</span>`;

    return `<div class="hist-entry">
      <div class="hist-info">
        <div class="hist-slots">${slotsHtml}</div>
        <span class="hist-date">${date}</span>
      </div>
      ${result}
    </div>`;
  }).join('');
}

// ================================================================
//  SLOT MACHINE
// ================================================================

function renderCase(index, item) {
  const card  = document.getElementById('case' + index);
  const tname = document.getElementById('tname' + index);
  const tdesc = document.getElementById('tdesc' + index);

  if (!item) {
    card.className = 'case-item';
    card.innerHTML = '<div class="item-display empty"><span class="empty-icon">?</span></div>';
    tname.textContent = '';
    tdesc.textContent = '';
    return;
  }

  const r = RARITIES[item.rarity] || RARITIES.common;
  const iconHtml = item.image
    ? `<img class="item-img" src="${esc(item.image)}" alt="${esc(item.name)}" onerror="this.style.display='none'">`
    : `<span class="item-icon">${item.type === 'account' ? '👤' : '📦'}</span>`;

  card.className = 'case-item ' + r.cls;
  card.innerHTML = `
    <div class="item-display">
      ${iconHtml}
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

      renderCase(index, pool[Math.floor(Math.random() * pool.length)]);

      const prog = elapsed / stopMs;
      if      (prog > 0.9)  delay = 260;
      else if (prog > 0.78) delay = 170;
      else if (prog > 0.62) delay = 110;

      setTimeout(tick, delay);
    }
    tick();
  });
}

// ── Weighted helpers ──────────────────────────────────────────────

function weightedPickRarity(weights) {
  const total = weights.reduce((s, w) => s + w.weight, 0);
  let roll = Math.random() * total;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) return entry.rarity;
  }
  return weights[weights.length - 1].rarity;
}

function itemsOfRarity(pool, rarity) { return pool.filter(i => i.rarity === rarity); }
function pickRandomFrom(arr)         { return arr[Math.floor(Math.random() * arr.length)]; }

function pickLoseItem(pool) {
  const rarity = weightedPickRarity(LOSE_RARITY_WEIGHTS);
  const bucket = itemsOfRarity(pool, rarity);
  return bucket.length > 0 ? pickRandomFrom(bucket) : pickRandomFrom(pool);
}

function generateResults(pool) {
  if (Math.random() < WIN_CHANCE) {
    const chosenRarity = weightedPickRarity(RARITY_WEIGHTS);
    const bucket = itemsOfRarity(pool, chosenRarity);
    if (bucket.length > 0) {
      const winItem = pickRandomFrom(bucket);
      return { results: [winItem, winItem, winItem], isWin: true };
    }
  }

  const r0 = pickLoseItem(pool);
  let r1 = pickLoseItem(pool);
  let r2 = pickLoseItem(pool);

  let safety = 20;
  while (r0.id === r1.id && r1.id === r2.id && safety-- > 0) {
    r1 = pickLoseItem(pool);
    r2 = pickLoseItem(pool);
  }

  return { results: [r0, r1, r2], isWin: false };
}

async function spin() {
  if (isSpinning) return;
  if (!currentUser) { showModal('login'); return; }

  const pool = getPool();
  if (pool.length === 0) { notify('The item pool is empty.', 'error'); return; }
  if (currentUser.silver_balance < SPIN_COST) { notify('Not enough silver! Click ◈ to buy more.', 'error'); return; }

  // Deduct via backend
  try {
    const { silver_balance } = await apiRequest('PATCH', '/auth/silver', { delta: -SPIN_COST });
    currentUser.silver_balance = silver_balance;
    refreshSilver();
    logTx(-SPIN_COST, 'Spin');
  } catch (err) {
    notify(err.message || 'Could not deduct silver.', 'error');
    return;
  }

  document.getElementById('winBanner').classList.add('hidden');
  isSpinning = true;
  document.getElementById('spinBtn').disabled = true;

  const { results, isWin } = generateResults(pool);

  await Promise.all([
    spinReel(0, results[0], 1500),
    spinReel(1, results[1], 2100),
    spinReel(2, results[2], 2700),
  ]);

  isSpinning = false;
  document.getElementById('spinBtn').disabled = false;

  logSpin(results, isWin, isWin ? results[0] : null);
  if (isWin) awardWin(results[0]);
}

function awardWin(item) {
  const r = RARITIES[item.rarity] || RARITIES.common;

  document.getElementById('winItemDisplay').innerHTML =
    `<span class="${r.cls}" style="font-size:16px;font-weight:700;">`
    + (item.type === 'account' ? '👤' : '📦') + ' ' + esc(item.name) + '</span>'
    + `<span style="margin-left:8px;font-size:12px;color:var(--text3)">(${r.name})</span>`;
  document.getElementById('winBanner').classList.remove('hidden');

  notify('🎉 You won: ' + item.name + '!', 'success');
}

// ================================================================
//  SHOP
// ================================================================

const PAYMENT_URL = 'https://payment.gacha.gg/checkout';
let pendingPurchase = null;

function initPurchase(silverAmount, priceLabel, usdCents) {
  if (!currentUser) { showModal('login'); return; }
  pendingPurchase = { silverAmount, priceLabel, usdCents };
  document.getElementById('purchaseAmount').textContent = silverAmount.toLocaleString();
  document.getElementById('purchasePrice').textContent  = priceLabel;
  window.open(PAYMENT_URL + '?amount=' + usdCents + '&silver=' + silverAmount, '_blank');
  showModal('confirmPurchase');
}

async function confirmPurchase() {
  if (!pendingPurchase || !currentUser) return;
  const { silverAmount, priceLabel } = pendingPurchase;
  pendingPurchase = null;
  hideModal('confirmPurchase');

  try {
    const { silver_balance } = await apiRequest('PATCH', '/auth/silver', { delta: silverAmount });
    currentUser.silver_balance = silver_balance;
    refreshSilver();
    logTx(silverAmount, 'Purchase ' + priceLabel);
    notify(`◈ +${silverAmount.toLocaleString()} Silver added! (${priceLabel})`, 'success');
  } catch (err) {
    notify(err.message || 'Could not add silver.', 'error');
  }
}

function purchaseSilver(amount, usd) {
  initPurchase(amount, '$' + usd + '.00', usd * 100);
}

// ================================================================
//  ADMIN — ITEM POOL
// ================================================================

function switchAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('adminTab' + cap(tab)).classList.remove('hidden');
  btn.classList.add('active');
}

function addItem(e) {
  e.preventDefault();
  const name   = document.getElementById('itemName').value.trim();
  const desc   = document.getElementById('itemDesc').value.trim();
  const rarity = document.getElementById('itemRarity').value;
  const image  = document.getElementById('itemImage').value.trim();
  if (!name) return;

  const pool = getPool();
  pool.push({
    id: 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    name, description: desc, type: 'item', rarity,
    image: image || null,
  });
  savePool(pool);
  renderPool();
  document.getElementById('addItemForm').reset();
  notify('Item added to pool.', 'success');
}

function addAccount(e) {
  e.preventDefault();
  const accUser  = document.getElementById('accUsername').value.trim();
  const accEmail = document.getElementById('accEmail').value.trim();
  const accPw    = document.getElementById('accPassword').value.trim();
  const rarity   = document.getElementById('accRarity').value;
  if (!accUser || !accEmail) return;

  const desc = `Username: ${accUser}\nEmail: ${accEmail}${accPw ? '\nPassword: ' + accPw : ''}`;

  const pool = getPool();
  pool.push({
    id: 'acc_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    name: accUser, description: desc, type: 'account', rarity,
    image: null, accountEmail: accEmail, accountPassword: accPw || null,
  });
  savePool(pool);
  renderPool();
  document.getElementById('addAccountForm').reset();
  notify('Account added to pool.', 'success');
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

  if (countEl) countEl.textContent = `(${pool.length})`;

  if (pool.length === 0) {
    container.innerHTML = '<p class="empty-state">No items yet.</p>';
    return;
  }

  container.innerHTML = pool.map(item => {
    const r = RARITIES[item.rarity] || RARITIES.common;
    const descPreview = item.description
      ? ' · ' + esc(item.description.split('\n')[0].slice(0, 40)) + (item.description.length > 40 ? '…' : '')
      : '';
    return `<div class="pool-entry ${r.peCls}">
      <div class="pool-entry-info">
        <span class="pool-entry-name">${esc(item.name)}</span>
        <span class="pool-entry-meta">${r.name} · ${item.type}${descPreview}</span>
      </div>
      <button class="btn-x" onclick="removeItem('${item.id}')" title="Remove">✕</button>
    </div>`;
  }).join('');
}

function renderAdmin() {
  renderPool();
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

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ================================================================
//  BOOT
// ================================================================

document.addEventListener('DOMContentLoaded', init);
