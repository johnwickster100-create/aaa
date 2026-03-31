'use strict';

// ================================================================
//  CONSTANTS
// ================================================================

const API = 'http://localhost:3001/api';

const SPIN_COST = 35;

const RARITIES = {
  common:      { name: 'Common',    color: '#9e9e9e', cls: 'rarity-common',      peCls: 'pe-common'     },
  uncommon:    { name: 'Uncommon',  color: '#57f287', cls: 'rarity-uncommon',    peCls: 'pe-uncommon'   },
  item_rarity: { name: 'Item',      color: '#cc44ff', cls: 'rarity-item_rarity', peCls: 'pe-item_rarity'},
  rare:        { name: 'Rare',      color: '#5865f2', cls: 'rarity-rare',        peCls: 'pe-rare'       },
  legendary:   { name: 'Legendary', color: '#ffd700', cls: 'rarity-legendary',   peCls: 'pe-legendary'  },
  mythical:    { name: 'Mythical',  color: '#ff8c00', cls: 'rarity-mythical',    peCls: 'pe-mythical'   },
  spec:        { name: 'Spec',      color: '#dc143c', cls: 'rarity-spec',        peCls: 'pe-spec'       },
};

// Win chance: 10% of all spins are potential triples
const WIN_CHANCE = 0.10;

// Weighted rarity odds (within the 10% winning spins) — must sum to ~100
const RARITY_WEIGHTS = [
  { rarity: 'common',      weight: 44.44 },
  { rarity: 'uncommon',    weight: 30    },
  { rarity: 'item_rarity', weight: 20    },
  { rarity: 'rare',        weight: 5     },
  { rarity: 'legendary',   weight: 0.5   },
  { rarity: 'mythical',    weight: 0.05  },
  { rarity: 'spec',        weight: 0.01  },
];

// Rarity weights for LOSING spins — higher rarity = less likely to appear
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
//  STORAGE  (item pool stays in localStorage; auth moves to backend)
// ================================================================

function getPool()   { return JSON.parse(localStorage.getItem('gacha_pool') || '[]'); }
function savePool(p) { localStorage.setItem('gacha_pool', JSON.stringify(p)); }

function getToken()       { return localStorage.getItem('gacha_jwt') || null; }
function saveToken(token) { localStorage.setItem('gacha_jwt', token); }
function clearToken()     { localStorage.removeItem('gacha_jwt'); }

// ================================================================
//  STATE
// ================================================================

let currentUser = null;  // shape: { id, email, username, silver_balance, email_verified }
let isSpinning  = false;

// ================================================================
//  API HELPER
// ================================================================

async function apiRequest(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

// ================================================================
//  INIT
// ================================================================

async function init() {
  renderHeader();         // render immediately (logged-out state)
  showView('slot');
  renderPool();

  // Restore session if a token exists
  const token = getToken();
  if (token) {
    try {
      const user = await apiRequest('GET', '/auth/me');
      currentUser = user;
      renderHeader();
    } catch {
      // Token expired / invalid — clear it silently
      clearToken();
    }
  }
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
    $('adminNavBtn').classList.add('hidden'); // admin UI coming in a later step
  } else {
    $('authButtons').classList.remove('hidden');
    $('userInfo').classList.add('hidden');
    $('silverAmount').textContent = '—';
    $('adminNavBtn').classList.add('hidden');
  }
}

function refreshSilver() {
  if (currentUser) {
    document.getElementById('silverAmount').textContent = currentUser.silver_balance.toLocaleString();
  }
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
//  PASSWORD HINTS
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
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;

  try {
    const { token, user } = await apiRequest('POST', '/auth/login', { username, password });
    saveToken(token);
    currentUser = user;
    hideModal('login');
    renderHeader();
    notify('Welcome back, ' + user.username + '!', 'success');
    e.target.reset();
  } catch (err) {
    showErr('loginError', err.message);
  } finally {
    btn.disabled = false;
  }
}

// ================================================================
//  AUTH — LOGOUT
// ================================================================

function logout() {
  currentUser = null;
  clearToken();
  renderHeader();
  showView('slot');
  notify('Logged out.', 'info');
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
  if (pool.length === 0) { notify('The item pool is empty — ask the admin to add items.', 'error'); return; }
  if (currentUser.silver_balance < SPIN_COST) { notify('Not enough silver! Click ◈ to buy more.', 'error'); return; }

  // Deduct silver via backend (atomic — fails if balance insufficient)
  try {
    const { silver_balance } = await apiRequest('PATCH', '/auth/silver', { delta: -SPIN_COST });
    currentUser.silver_balance = silver_balance;
    refreshSilver();
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

  if (isWin) awardWin(results[0]);
}

function awardWin(item) {
  const r = RARITIES[item.rarity] || RARITIES.common;

  document.getElementById('winItemDisplay').innerHTML =
    `<span class="${r.cls}" style="font-size:16px;font-weight:700;">`
    + (item.type === 'account' ? '👤' : '📦') + ' ' + esc(item.name) + '</span>'
    + `<span style="margin-left:8px;font-size:12px;color:var(--text3)">(${r.name})</span>`;
  document.getElementById('winBanner').classList.remove('hidden');

  // Inventory persistence will be added in a later backend step
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

  // Add silver via backend so the real balance stays in sync
  try {
    const { silver_balance } = await apiRequest('PATCH', '/auth/silver', { delta: silverAmount });
    currentUser.silver_balance = silver_balance;
    refreshSilver();
    notify(`◈ +${silverAmount.toLocaleString()} Silver added! (${priceLabel})`, 'success');
  } catch (err) {
    notify(err.message || 'Could not add silver.', 'error');
  }
}

// Legacy alias
function purchaseSilver(amount, usd) {
  initPurchase(amount, '$' + usd + '.00', usd * 100);
}

// ================================================================
//  ADMIN — ITEM POOL  (localStorage until backend step covers it)
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
    const descPreview = item.description
      ? ' · ' + esc(item.description.slice(0, 42)) + (item.description.length > 42 ? '…' : '')
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

// ================================================================
//  BOOT
// ================================================================

document.addEventListener('DOMContentLoaded', init);
