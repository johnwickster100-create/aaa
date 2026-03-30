/* ============================================================
   GACHA CASINO — Application Logic
   ============================================================ */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================

const SPIN_COST = 10;

const KEYS = {
  USERS:   'gacha_users',
  ITEMS:   'gacha_items',
  SESSION: 'gacha_session',
};

const RARITIES = {
  common:    { label: 'Common',    cls: 'rarity-common',    weight: 100 },
  uncommon:  { label: 'Uncommon',  cls: 'rarity-uncommon',  weight:  50 },
  rare:      { label: 'Rare',      cls: 'rarity-rare',      weight:  20 },
  legendary: { label: 'Legendary', cls: 'rarity-legendary', weight:   8 },
  item:      { label: 'Item',      cls: 'rarity-item',      weight:   5 },
  mythical:  { label: 'Mythical',  cls: 'rarity-mythical',  weight:   3 },
  spec:      { label: 'Spec',      cls: 'rarity-spec',      weight:   2 },
};

const RARITY_BORDER_COLORS = {
  common:    '#9b9b9b',
  uncommon:  '#57d257',
  rare:      '#4d88ff',
  legendary: '#ffd700',
  item:      '#ff6b6b',
  mythical:  '#ff8c00',
  spec:      '#dc143c',
};

// ============================================================
// DEFAULT DATA
// ============================================================

const DEFAULT_ADMIN = {
  username: 'admin',
  email:    'admin@gacha.com',
  password: encodePass('Admin@123'),
  silver:   99999,
  isAdmin:  true,
  inventory: [],
};

const DEFAULT_ITEMS = [
  { id: 'di01', name: 'Rusty Sword',     description: 'A worn blade that has seen better days. Still holds an edge.',          icon: '⚔️',  type: 'item',    rarity: 'common',    quantity: 10 },
  { id: 'di02', name: 'Health Potion',   description: 'A small vial of cherry-red liquid. Smells sweet.',                      icon: '🧪',  type: 'item',    rarity: 'common',    quantity: 10 },
  { id: 'di03', name: 'Leather Cap',     description: 'Basic head protection. Slightly too big.',                               icon: '🪖',  type: 'item',    rarity: 'common',    quantity: 10 },
  { id: 'di04', name: 'Forest Cloak',    description: 'Woven from shadow-moss. Grants minor stealth in forests.',               icon: '🧥',  type: 'item',    rarity: 'uncommon',  quantity:  6 },
  { id: 'di05', name: 'Silver Ring',     description: 'Etched with faint runes. Pulses softly when danger is near.',            icon: '💍',  type: 'item',    rarity: 'uncommon',  quantity:  6 },
  { id: 'di06', name: 'Novice Account',  description: 'A level 20 starter account with a clean reputation.',                   icon: '🎮',  type: 'account', rarity: 'uncommon',  quantity:  4 },
  { id: 'di07', name: 'Enchanted Bow',   description: 'Carved from moonwood. Arrows fly true regardless of wind.',              icon: '🏹',  type: 'item',    rarity: 'rare',      quantity:  3 },
  { id: 'di08', name: 'Storm Staff',     description: 'Crackles with contained lightning. Handle with care.',                  icon: '🔱',  type: 'item',    rarity: 'rare',      quantity:  3 },
  { id: 'di09', name: 'Veteran Account', description: 'Level 80 warrior — full gear, max reputation, rare cosmetics.',         icon: '🛡️',  type: 'account', rarity: 'rare',      quantity:  2 },
  { id: 'di10', name: 'Dragon Scale',    description: 'Pried from an ancient wyrm. Radiates immense power.',                   icon: '🐉',  type: 'item',    rarity: 'legendary', quantity:  1 },
  { id: 'di11', name: 'Crown Account',   description: 'Top-100 ranked account with exclusive seasonal cosmetics.',             icon: '👑',  type: 'account', rarity: 'legendary', quantity:  1 },
  { id: 'di12', name: 'Rainbow Crystal', description: 'Shifts through every colour of the spectrum. Almost impossible to find.', icon: '💠', type: 'item',    rarity: 'item',      quantity:  1 },
  { id: 'di13', name: 'Phoenix Ember',   description: 'A flame that never goes out, harvested from a reborn phoenix.',         icon: '🔥',  type: 'item',    rarity: 'mythical',  quantity:  1 },
  { id: 'di14', name: 'Obsidian Core',   description: 'Pulsing with ancient void energy. Sought by the most powerful mages.',  icon: '🌑',  type: 'item',    rarity: 'mythical',  quantity:  1 },
  { id: 'di15', name: 'Blood Shard',     description: 'A crimson splinter radiating dark power. Fewer than five exist.',       icon: '💎',  type: 'item',    rarity: 'spec',      quantity:  1 },
];

// ============================================================
// STATE
// ============================================================

let currentUser = null;
let isSpinning  = false;

// ============================================================
// STORAGE HELPERS
// ============================================================

function getUsers() {
  return JSON.parse(localStorage.getItem(KEYS.USERS) || '[]');
}
function saveUsers(users) {
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
}
function getItems() {
  return JSON.parse(localStorage.getItem(KEYS.ITEMS) || '[]');
}
function saveItems(items) {
  localStorage.setItem(KEYS.ITEMS, JSON.stringify(items));
}
function saveSession(username) {
  localStorage.setItem(KEYS.SESSION, username);
}
function clearSession() {
  localStorage.removeItem(KEYS.SESSION);
}

// ============================================================
// PASSWORD (simple obfuscation — demo only)
// ============================================================

function encodePass(raw) {
  return btoa(raw.split('').reverse().join('') + '::gacha');
}

function validatePassword(pw) {
  const hasLength  = pw.length >= 8;
  const hasSpecial = /[!@#$%^&*()\-_=+\[\]{};':",.<>/?\\|`~]/.test(pw);
  return { hasLength, hasSpecial, valid: hasLength && hasSpecial };
}

// ============================================================
// INIT
// ============================================================

function init() {
  // Seed default data on first visit
  if (!localStorage.getItem(KEYS.USERS)) {
    saveUsers([DEFAULT_ADMIN]);
  }
  if (!localStorage.getItem(KEYS.ITEMS)) {
    saveItems(DEFAULT_ITEMS);
  }

  // Restore session
  const saved = localStorage.getItem(KEYS.SESSION);
  if (saved) {
    currentUser = getUsers().find(u => u.username === saved) || null;
  }

  renderHeader();
  renderNav();
  showView('main');
  initSlotMachine();
  bindForms();
}

// ============================================================
// FORM BINDINGS
// ============================================================

function bindForms() {

  // ---- Login ----
  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    const user = getUsers().find(u => u.username === username);
    if (!user || user.password !== encodePass(password)) {
      showError('login-error', 'Invalid username or password.');
      return;
    }

    currentUser = user;
    saveSession(user.username);
    renderHeader();
    renderNav();
    showView('main');
    updateSpinButton();
    showToast(`Welcome back, ${user.username}!`, 'success');
  });

  // ---- Register ----
  document.getElementById('register-form').addEventListener('submit', e => {
    e.preventDefault();

    const email    = document.getElementById('reg-email').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm  = document.getElementById('reg-confirm').value;

    if (!email || !username || !password || !confirm) {
      showError('register-error', 'Please fill in all fields.');
      return;
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      showError('register-error', 'Password must be at least 8 characters and contain a special character.');
      return;
    }

    if (password !== confirm) {
      showError('register-error', 'Passwords do not match.');
      return;
    }

    const users = getUsers();

    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      showError('register-error', 'That username is already taken.');
      return;
    }
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      showError('register-error', 'That email is already registered.');
      return;
    }

    const newUser = {
      username,
      email,
      password: encodePass(password),
      silver:    100,
      isAdmin:   false,
      inventory: [],
    };
    users.push(newUser);
    saveUsers(users);

    currentUser = newUser;
    saveSession(newUser.username);
    renderHeader();
    renderNav();
    showView('main');
    updateSpinButton();
    showToast('Account created! You start with 100 free Silver.', 'success');
  });

  // ---- Password live validation ----
  document.getElementById('reg-password').addEventListener('input', e => {
    const v    = validatePassword(e.target.value);
    const len  = document.getElementById('req-length');
    const spec = document.getElementById('req-special');
    const typed = e.target.value.length > 0;

    len.textContent  = (v.hasLength  ? '✓' : '✗') + ' At least 8 characters';
    len.className    = 'req' + (typed ? (v.hasLength  ? ' met' : ' unmet') : '');
    spec.textContent = (v.hasSpecial ? '✓' : '✗') + ' At least 1 special character';
    spec.className   = 'req' + (typed ? (v.hasSpecial ? ' met' : ' unmet') : '');
  });

  // ---- Admin item form ----
  document.getElementById('item-form').addEventListener('submit', e => {
    e.preventDefault();

    const id          = document.getElementById('item-id').value  || 'item_' + Date.now();
    const name        = document.getElementById('item-name').value.trim();
    const description = document.getElementById('item-desc').value.trim();
    const icon        = document.getElementById('item-icon').value.trim() || '📦';
    const type        = document.getElementById('item-type').value;
    const rarity      = document.getElementById('item-rarity').value;
    const quantity    = Math.max(1, parseInt(document.getElementById('item-qty').value) || 1);

    if (!name) { showToast('Item name is required.', 'error'); return; }

    const items = getItems();
    const idx   = items.findIndex(i => i.id === id);
    const item  = { id, name, description, icon, type, rarity, quantity };

    if (idx >= 0) {
      items[idx] = item;
      showToast('Item updated.', 'success');
    } else {
      items.push(item);
      showToast('Item added.', 'success');
    }

    saveItems(items);
    clearItemForm();
    renderAdminList();
  });
}

// ============================================================
// AUTH ACTIONS
// ============================================================

function logout() {
  currentUser = null;
  clearSession();
  renderHeader();
  renderNav();
  showView('main');
  updateSpinButton();
  showToast('Logged out.', 'info');
}

// ============================================================
// RENDER — HEADER
// ============================================================

function renderHeader() {
  const auth   = document.getElementById('auth-section');
  const silver = document.getElementById('silver-display');

  if (currentUser) {
    auth.innerHTML = `
      <div class="user-info">
        <div class="user-avatar">${currentUser.username[0].toUpperCase()}</div>
        <span class="username-label">${currentUser.username}</span>
        ${currentUser.isAdmin ? '<span class="admin-chip">ADMIN</span>' : ''}
        <button class="btn btn-secondary btn-sm" onclick="logout()">Logout</button>
      </div>`;

    silver.innerHTML = `
      <div class="silver-badge" onclick="showView('shop')" title="Click to buy Silver">
        <span class="silver-icon">🪙</span>
        <span>${formatNum(currentUser.silver)} Silver</span>
      </div>`;
  } else {
    auth.innerHTML = `
      <button class="btn btn-secondary btn-sm" onclick="showView('login')">Login</button>
      <button class="btn btn-primary  btn-sm" onclick="showView('register')">Sign Up</button>`;

    silver.innerHTML = `
      <div class="silver-badge" onclick="showView('shop')" title="Login to buy Silver">
        <span class="silver-icon">🪙</span>
        <span>— Silver</span>
      </div>`;
  }
}

// ============================================================
// RENDER — NAV
// ============================================================

function renderNav() {
  const nav   = document.getElementById('main-nav');
  const links = [{ id: 'main', label: 'Slot Machine' }];

  if (currentUser) {
    links.push({ id: 'inventory', label: 'My Inventory' });
    if (currentUser.isAdmin) links.push({ id: 'admin', label: '⚙ Admin' });
  }

  nav.innerHTML = links
    .map(l => `<div class="nav-item" id="nav-${l.id}" onclick="showView('${l.id}')">${l.label}</div>`)
    .join('');
}

// ============================================================
// VIEW ROUTER
// ============================================================

function showView(id) {
  if (id === 'admin'     && (!currentUser || !currentUser.isAdmin)) { showToast('Access denied.', 'error'); return; }
  if (id === 'inventory' && !currentUser) { showView('login'); return; }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + id);
  if (el) el.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const ni = document.getElementById('nav-' + id);
  if (ni) ni.classList.add('active');

  clearError('login-error');
  clearError('register-error');

  if (id === 'admin')     renderAdminList();
  if (id === 'inventory') renderUserInventory();
  if (id === 'main')      initSlotMachine();
}

// ============================================================
// SLOT MACHINE
// ============================================================

function initSlotMachine() {
  updateSpinButton();

  // Reset each reel to placeholder
  for (let i = 0; i < 3; i++) {
    const win = document.getElementById('reel-' + i);
    const dis = document.getElementById('reel-display-' + i);
    const tip = document.getElementById('reel-tooltip-' + i);

    if (win) { win.className = 'reel-window'; win.removeAttribute('data-rarity'); }
    if (dis) dis.innerHTML = '<span class="reel-placeholder">◈</span>';
    if (tip) tip.innerHTML = '';
  }

  const winBar = document.getElementById('win-bar');
  if (winBar) winBar.className = 'win-bar';

  const msg = document.getElementById('spin-message');
  if (msg) { msg.textContent = ''; msg.className = 'spin-message'; }
}

function updateSpinButton() {
  const btn  = document.getElementById('spin-btn');
  const text = document.getElementById('spin-btn-text');
  if (!btn || !text) return;

  if (!currentUser) {
    btn.disabled = true;
    text.textContent = 'LOGIN TO SPIN';
  } else if (isSpinning) {
    btn.disabled = true;
    text.textContent = 'SPINNING…';
  } else if (currentUser.silver < SPIN_COST) {
    btn.disabled = true;
    text.textContent = 'NOT ENOUGH SILVER';
  } else {
    btn.disabled = false;
    text.textContent = `SPIN  ·  ${SPIN_COST} Silver`;
  }
}

// Weighted random item pick
function pickItem(items) {
  const totalWeight = items.reduce((s, it) => s + (RARITIES[it.rarity]?.weight ?? 1), 0);
  let r = Math.random() * totalWeight;
  for (const it of items) {
    r -= (RARITIES[it.rarity]?.weight ?? 1);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

// Render an item inside a reel display cell
function renderItemInReel(index, item, animate) {
  const display = document.getElementById('reel-display-' + index);
  const win     = document.getElementById('reel-' + index);
  const tip     = document.getElementById('reel-tooltip-' + index);
  if (!display || !item) return;

  const rar = RARITIES[item.rarity] || RARITIES.common;

  display.innerHTML = `
    <div class="reel-item-icon">${item.icon || '📦'}</div>
    <div class="reel-item-name  ${rar.cls}">${item.name}</div>
    <div class="reel-item-rarity ${rar.cls}">${rar.label}</div>`;

  if (animate) {
    display.classList.remove('pop');
    // Force reflow so animation re-triggers
    void display.offsetWidth;
    display.classList.add('pop');
  }

  if (win) {
    win.setAttribute('data-rarity', item.rarity);
  }

  if (tip) {
    tip.innerHTML = `
      <div class="tip-name  ${rar.cls}">${item.icon || ''} ${item.name}</div>
      <div class="tip-meta">${item.type} · ${rar.label}</div>
      <div class="tip-desc">${item.description || 'No description available.'}</div>`;
  }
}

// Spin one reel: rapidly cycle items, slow down, stop at result
function spinReel(index, result, duration) {
  return new Promise(resolve => {
    const items  = getItems();
    const win    = document.getElementById('reel-' + index);

    if (win) {
      win.className = 'reel-window spinning';
      win.removeAttribute('data-rarity');
    }

    let elapsed     = 0;
    let speed       = 55;          // ms per frame (start fast)
    const slowStart = duration * 0.60;

    function tick() {
      // Pick a random visual item
      const visual = items[Math.floor(Math.random() * items.length)];
      renderItemInReel(index, visual, true);

      elapsed += speed;

      if (elapsed >= duration) {
        // Land on the predetermined result
        renderItemInReel(index, result, false);
        if (win) win.className = 'reel-window';
        resolve();
        return;
      }

      // Progressively slow down
      if (elapsed >= slowStart) {
        speed = Math.min(speed * 1.18, 320);
      }

      setTimeout(tick, speed);
    }

    setTimeout(tick, speed);
  });
}

async function spin() {
  if (!currentUser || isSpinning) return;

  const items = getItems();
  if (!items.length) {
    showToast('No items in the pool yet. Admin needs to add items.', 'error');
    return;
  }

  if (currentUser.silver < SPIN_COST) {
    showToast('Not enough Silver! Visit the shop to get more.', 'error');
    return;
  }

  // Deduct silver immediately
  currentUser.silver -= SPIN_COST;
  updateUserInStorage(currentUser);
  renderHeader();

  isSpinning = true;
  updateSpinButton();

  const btn = document.getElementById('spin-btn');
  if (btn) btn.classList.add('spinning');

  const msg    = document.getElementById('spin-message');
  const winBar = document.getElementById('win-bar');
  if (msg)    { msg.textContent = ''; msg.className = 'spin-message'; }
  if (winBar) winBar.className = 'win-bar';

  // Predetermine results (weighted)
  const results = [pickItem(items), pickItem(items), pickItem(items)];

  // Spin all three reels, staggered stops
  await Promise.all([
    spinReel(0, results[0], 2000),
    spinReel(1, results[1], 3000),
    spinReel(2, results[2], 4000),
  ]);

  if (btn) btn.classList.remove('spinning');
  isSpinning = false;

  // Win check: all three IDs must match
  const isWin = results[0].id === results[1].id && results[1].id === results[2].id;

  if (isWin) {
    const won = results[0];

    // Award item to user
    if (!Array.isArray(currentUser.inventory)) currentUser.inventory = [];
    currentUser.inventory.push({ ...won, wonAt: Date.now() });
    updateUserInStorage(currentUser);

    // Flash win state on reels
    for (let i = 0; i < 3; i++) {
      const rw = document.getElementById('reel-' + i);
      if (rw) rw.classList.add('win');
    }

    if (winBar) winBar.className = 'win-bar active';

    if (msg) {
      msg.textContent = `🎉  YOU WON  ${won.icon || ''}  ${won.name}!`;
      msg.className   = 'spin-message win';
    }
    showToast(`You won ${won.icon || ''} ${won.name}!`, 'success');
  } else {
    if (msg) {
      msg.textContent = 'No match — try again!';
      msg.className   = 'spin-message lose';
    }
  }

  renderHeader();
  updateSpinButton();
}

// ============================================================
// ADMIN PANEL
// ============================================================

function renderAdminList() {
  const list  = document.getElementById('admin-item-list');
  const count = document.getElementById('item-count');
  if (!list) return;

  const items = getItems();
  if (count) count.textContent = items.length;

  if (!items.length) {
    list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">No items yet. Add one using the form.</div>';
    return;
  }

  list.innerHTML = items.map(item => {
    const rar = RARITIES[item.rarity] || RARITIES.common;
    return `
      <div class="admin-item">
        <div class="ai-icon">${item.icon || '📦'}</div>
        <div class="ai-info">
          <div class="ai-name ${rar.cls}">${item.name}</div>
          <div class="ai-meta">
            <span>${item.type}</span>
            <span>·</span>
            <span class="${rar.cls}">${rar.label}</span>
            <span>·</span>
            <span>Qty: ${item.quantity}</span>
          </div>
        </div>
        <div class="ai-acts">
          <button class="btn-icon"     onclick="editItem('${item.id}')">Edit</button>
          <button class="btn-icon del" onclick="deleteItem('${item.id}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

function editItem(id) {
  const item = getItems().find(i => i.id === id);
  if (!item) return;
  document.getElementById('item-id').value       = item.id;
  document.getElementById('item-name').value     = item.name;
  document.getElementById('item-desc').value     = item.description;
  document.getElementById('item-icon').value     = item.icon;
  document.getElementById('item-type').value     = item.type;
  document.getElementById('item-rarity').value   = item.rarity;
  document.getElementById('item-qty').value      = item.quantity;
  // Scroll form into view
  document.getElementById('item-name').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteItem(id) {
  if (!confirm('Delete this item from the inventory?')) return;
  saveItems(getItems().filter(i => i.id !== id));
  renderAdminList();
  showToast('Item deleted.', 'info');
}

function clearItemForm() {
  document.getElementById('item-id').value     = '';
  document.getElementById('item-name').value   = '';
  document.getElementById('item-desc').value   = '';
  document.getElementById('item-icon').value   = '';
  document.getElementById('item-type').value   = 'item';
  document.getElementById('item-rarity').value = 'common';
  document.getElementById('item-qty').value    = '1';
}

// ============================================================
// SILVER SHOP
// ============================================================

function purchaseSilver(amount, price) {
  if (!currentUser) {
    showView('login');
    showToast('Please log in to purchase Silver.', 'error');
    return;
  }

  // Demo: instant fulfillment (no real payment gateway)
  currentUser.silver += amount;
  updateUserInStorage(currentUser);
  renderHeader();

  const msgEl = document.getElementById('shop-msg');
  if (msgEl) {
    msgEl.textContent = `✓ Purchased ${formatNum(amount)} Silver for $${price.toFixed(2)}. Enjoy!`;
    msgEl.className   = 'shop-msg success';
    msgEl.classList.remove('hidden');
    setTimeout(() => msgEl.classList.add('hidden'), 5000);
  }

  showToast(`+${formatNum(amount)} Silver added to your balance!`, 'success');
}

// ============================================================
// USER INVENTORY
// ============================================================

function renderUserInventory() {
  const list = document.getElementById('user-inv-list');
  if (!list || !currentUser) return;

  const inv = currentUser.inventory || [];

  if (!inv.length) {
    list.innerHTML = `
      <div class="inv-empty">
        Your inventory is empty.<br>
        Spin the slot machine and match all 3 to win items!
      </div>`;
    return;
  }

  list.innerHTML = inv.map(item => {
    const rar = RARITIES[item.rarity] || RARITIES.common;
    const bc  = RARITY_BORDER_COLORS[item.rarity] || '#40444b';
    return `
      <div class="inv-item" style="border-color:${bc}">
        <div class="inv-icon">${item.icon || '📦'}</div>
        <div class="inv-name   ${rar.cls}">${item.name}</div>
        <div class="inv-type">${item.type}</div>
        <div class="inv-rarity ${rar.cls}">${rar.label}</div>
      </div>`;
  }).join('');
}

// ============================================================
// HELPERS
// ============================================================

function updateUserInStorage(user) {
  const users = getUsers();
  const idx   = users.findIndex(u => u.username === user.username);
  if (idx >= 0) { users[idx] = user; saveUsers(users); }
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}
function clearError(id) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}

let toastTimer = null;
function showToast(message, type = 'info') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = message;
  t.className   = `toast ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3600);
}

function formatNum(n) {
  return Number(n).toLocaleString();
}

// ============================================================
// GLOBAL EXPORTS (inline onclick handlers)
// ============================================================

window.showView      = showView;
window.logout        = logout;
window.spin          = spin;
window.purchaseSilver= purchaseSilver;
window.editItem      = editItem;
window.deleteItem    = deleteItem;
window.clearItemForm = clearItemForm;

// ============================================================
// BOOT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  init();
  bindForms();
});
