const STORAGE_KEY = 'validadeApp.items';
const PRODUCTS_KEY = 'validadeApp.products';
const USERS_KEY = 'validadeApp.users';
const HISTORY_KEY = 'validadeApp.history';
const DELETED_ITEMS_KEY = 'validadeApp.deletedItems';
const DELETED_PRODUCTS_KEY = 'validadeApp.deletedProducts';
const CURRENT_USER_KEY = 'validadeApp.currentUser';
const SYNC_SERVER_KEY = 'validadeApp.syncServer';
const SYNC_CONFIG_KEY = 'validadeApp.syncConfig';
const SYNC_AUTH_KEY = 'validadeApp.syncAuthorized.v3';
const SYNC_INTERVAL_MS = 5000;

const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const userManagementScreen = document.getElementById('userManagementScreen');

const loginForm = document.getElementById('loginForm');
const itemForm = document.getElementById('itemForm');
const createUserForm = document.getElementById('createUserForm');

const itemList = document.getElementById('itemList');
const userList = document.getElementById('userList');
const productSuggestions = document.getElementById('productSuggestions');
const selectedProductHint = document.getElementById('selectedProductHint');

const totalItems = document.getElementById('totalItems');
const urgentCount = document.getElementById('urgentCount');
const criticalCount = document.getElementById('criticalCount');
const expiredCount = document.getElementById('expiredCount');
const soldCount = document.getElementById('soldCount');
const urgentSummaryButton = document.getElementById('urgentSummaryButton');
const criticalSummaryButton = document.getElementById('criticalSummaryButton');
const expiredSummaryButton = document.getElementById('expiredSummaryButton');
const soldSummaryButton = document.getElementById('soldSummaryButton');

const currentUser = document.getElementById('currentUser');
const settingsButton = document.getElementById('settingsButton');
const settingsMenu = document.getElementById('settingsMenu');
const syncStatus = document.getElementById('syncStatus');
const configureSyncButton = document.getElementById('configureSyncButton');
const manageUsersButton = document.getElementById('manageUsersButton');
const logoutButton = document.getElementById('logoutButton');
const togglePasswordButton = document.getElementById('togglePasswordButton');
const backToAppButton = document.getElementById('backToAppButton');
const addTab = document.getElementById('addTab');
const viewTab = document.getElementById('viewTab');
const sheetTab = document.getElementById('sheetTab');
const productsTab = document.getElementById('productsTab');
const addSection = document.getElementById('addSection');
const viewSection = document.getElementById('viewSection');
const sheetSection = document.getElementById('sheetSection');
const productsSection = document.getElementById('productsSection');
const productManagementList = document.getElementById('productManagementList');
const monthlySheetBody = document.getElementById('monthlySheetBody');
const printSheetButton = document.getElementById('printSheetButton');

const itemTemplate = document.getElementById('itemTemplate');
const userTemplate = document.getElementById('userTemplate');

let items = loadItems();
let products = loadProducts();
let users = loadUsers();
let history = loadHistory();
let deletedItemIds = loadDeletedSet(DELETED_ITEMS_KEY);
let deletedProductKeys = loadDeletedSet(DELETED_PRODUCTS_KEY);
let currentUserData = null;
let activeAlertFilter = null;
let serverSyncAvailable = false;
let isApplyingRemoteState = false;
let syncIntervalId = null;
let expandedProductKeys = new Set();

// Initialize app
initApp();

async function initApp() {
  registerServiceWorker();
  await setupAutoSync();

  if (users.length === 0) {
    users.push({
      id: 'master',
      username: 'master',
      password: 'master123',
      type: 'master'
    });
    users.push({
      id: 'simple',
      username: 'simple',
      password: 'simple123',
      type: 'simple'
    });
    saveUsers();
  }

  syncProductsFromItems();

  // Check if user is logged in
  const savedUser = localStorage.getItem(CURRENT_USER_KEY);
  if (savedUser) {
    const user = JSON.parse(savedUser);
    const userData = users.find(u => u.id === user.id);
    if (userData) {
      login(userData);
    }
  }

  setupEventListeners();
}

function setupEventListeners() {
  loginForm.addEventListener('submit', handleLogin);
  togglePasswordButton.addEventListener('click', togglePasswordVisibility);
  settingsButton.addEventListener('click', toggleSettingsMenu);
  document.addEventListener('click', closeSettingsMenuOnOutsideClick);
  configureSyncButton.addEventListener('click', handleConfigureSync);
  itemForm.addEventListener('submit', handleSaveItem);
  createUserForm.addEventListener('submit', handleCreateUser);
  logoutButton.addEventListener('click', handleLogout);
  manageUsersButton.addEventListener('click', showUserManagement);
  backToAppButton.addEventListener('click', showApp);
  clearAll.addEventListener('click', handleClearAll);
  addTab.addEventListener('click', () => switchTab('add'));
  viewTab.addEventListener('click', () => {
    activeAlertFilter = null;
    switchTab('view');
  });
  sheetTab.addEventListener('click', () => switchTab('sheet'));
  printSheetButton.addEventListener('click', () => window.print());
  productsTab.addEventListener('click', () => switchTab('products'));
  urgentSummaryButton.addEventListener('click', () => expandProductsByAlert('urgent'));
  criticalSummaryButton.addEventListener('click', () => expandProductsByAlert('critical'));
  expiredSummaryButton.addEventListener('click', () => expandProductsByAlert('expired'));
  soldSummaryButton.addEventListener('click', () => expandProductsByAlert('sold'));
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {
      // Offline mode still works with local storage if the browser does not allow service workers.
    });
  });
}

function toggleSettingsMenu(event) {
  event.stopPropagation();
  const isOpening = settingsMenu.classList.contains('hidden');

  settingsMenu.classList.toggle('hidden', !isOpening);
  settingsButton.setAttribute('aria-expanded', String(isOpening));
}

function closeSettingsMenu() {
  settingsMenu.classList.add('hidden');
  settingsButton.setAttribute('aria-expanded', 'false');
}

function closeSettingsMenuOnOutsideClick(event) {
  if (!settingsMenu.contains(event.target) && event.target !== settingsButton) {
    closeSettingsMenu();
  }
}

function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    login(user);
  } else {
    document.getElementById('loginError').textContent = 'Usuário ou senha incorretos';
  }
}

function login(user) {
  currentUserData = user;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ id: user.id }));
  startAutoSync();
  updateSyncStatus();

  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  userManagementScreen.classList.add('hidden');

  currentUser.textContent = user.username;
  manageUsersButton.classList.toggle('hidden', user.type !== 'master');
  productsTab.classList.toggle('hidden', user.type !== 'master');

  if (user.type !== 'master' && !productsSection.classList.contains('hidden')) {
    switchTab('add');
  }

  renderProductSuggestions();
  renderItems();
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById('loginPassword');
  const shouldShow = passwordInput.type === 'password';

  passwordInput.type = shouldShow ? 'text' : 'password';
  togglePasswordButton.textContent = shouldShow ? 'Ocultar' : 'Ver';
  togglePasswordButton.setAttribute('aria-label', shouldShow ? 'Ocultar senha' : 'Ver senha');
}

function handleLogout() {
  currentUserData = null;
  localStorage.removeItem(CURRENT_USER_KEY);
  stopAutoSync();
  closeSettingsMenu();

  loginScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  userManagementScreen.classList.add('hidden');
  productsTab.classList.add('hidden');

  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginPassword').type = 'password';
  togglePasswordButton.textContent = 'Ver';
  togglePasswordButton.setAttribute('aria-label', 'Ver senha');
  document.getElementById('loginError').textContent = '';
}

function showUserManagement() {
  appScreen.classList.add('hidden');
  userManagementScreen.classList.remove('hidden');
  renderUsers();
}

function showApp() {
  userManagementScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  switchTab('add'); // Volta para a aba de adicionar por padrão
}

function switchTab(tab) {
  if (tab === 'products' && currentUserData.type !== 'master') {
    tab = 'add';
  }

  addTab.classList.toggle('active', tab === 'add');
  viewTab.classList.toggle('active', tab === 'view');
  sheetTab.classList.toggle('active', tab === 'sheet');
  productsTab.classList.toggle('active', tab === 'products');

  addSection.classList.toggle('hidden', tab !== 'add');
  viewSection.classList.toggle('hidden', tab !== 'view');
  sheetSection.classList.toggle('hidden', tab !== 'sheet');
  productsSection.classList.toggle('hidden', tab !== 'products');

  if (tab === 'add') {
    return;
  }

  if (tab === 'view') {
    renderItems();
    return;
  }

  if (tab === 'sheet') {
    renderMonthlySheet();
    return;
  }

  if (tab === 'products') {
    renderProductManagement();
  }
}

function handleCreateUser(event) {
  event.preventDefault();
  const username = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value;
  const type = document.getElementById('newUserType').value;

  if (users.some(u => u.username === username)) {
    alert('Usuário já existe');
    return;
  }

  const newUser = {
    id: Date.now().toString(),
    username,
    password,
    type
  };

  users.push(newUser);
  saveUsers();

  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newUserType').value = 'simple';

  renderUsers();
  addHistoryEntry(`Usuário ${username} criado por ${currentUserData.username}`);
}

function handleClearAll() {
  itemForm.reset();
  document.getElementById('itemQuantity').value = '1';
  clearSelectedProductHint();
  document.getElementById('itemName').focus();
}

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).map(item => ({
      ...item,
      date: item.date,
    }));
  } catch {
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  saveSharedState();
}

function loadProducts() {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function clearSelectedProductHint() {
  const nameInput = document.getElementById('itemName');

  nameInput.readOnly = false;
  selectedProductHint.textContent = '';
  selectedProductHint.classList.add('hidden');
}

function selectProductForNewValidity(productName) {
  const nameInput = document.getElementById('itemName');
  const dateInput = document.getElementById('itemDate');

  switchTab('add');
  nameInput.value = productName;
  nameInput.readOnly = true;
  selectedProductHint.textContent = `Adicionando validade para: ${productName}`;
  selectedProductHint.classList.remove('hidden');
  dateInput.focus();
}

function saveProducts() {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  saveSharedState();
}

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveUsers() {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  saveSharedState();
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  saveSharedState();
}

function loadDeletedSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDeletedState() {
  localStorage.setItem(DELETED_ITEMS_KEY, JSON.stringify([...deletedItemIds]));
  localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify([...deletedProductKeys]));
  saveSharedState();
}

function getAppState() {
  return {
    items,
    products,
    users,
    history,
    deletedItemIds: [...deletedItemIds],
    deletedProductKeys: [...deletedProductKeys],
  };
}

function getDefaultSyncServer() {
  if (location.protocol.startsWith('http')) {
    return location.origin;
  }

  return localStorage.getItem(SYNC_SERVER_KEY) || 'http://192.168.15.8:8080';
}

function getStateUrl(server) {
  return `${server.replace(/\/$/, '')}/api/state`;
}

function getSyncConfig() {
  const fileConfig = window.VALIDADEAPP_SYNC || {};
  const savedConfig = loadSavedSyncConfig();
  const config = savedConfig || fileConfig;
  return {
    provider: (config.provider || '').trim().toLowerCase(),
    supabaseUrl: (config.supabaseUrl || '').trim().replace(/\/$/, ''),
    supabaseAnonKey: (config.supabaseAnonKey || '').trim(),
    table: (config.table || 'app_state').trim(),
    rowId: (config.rowId || 'validadeapp').trim(),
  };
}

function loadSavedSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSyncConfig(config) {
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  localStorage.removeItem(SYNC_AUTH_KEY);
}

function hasSupabaseSync() {
  const config = getSyncConfig();
  return config.provider === 'supabase'
    && Boolean(config.supabaseUrl)
    && Boolean(config.supabaseAnonKey)
    && Boolean(config.table)
    && Boolean(config.rowId);
}

function getSyncLabel() {
  return hasSupabaseSync() ? 'Supabase online' : getDefaultSyncServer();
}

function updateSyncStatus(message) {
  if (!syncStatus) return;

  syncStatus.textContent = message || (serverSyncAvailable ? `Sync online: ${getSyncLabel()}` : 'Sync offline');
  syncStatus.classList.toggle('online', serverSyncAvailable);
}

async function handleConfigureSync() {
  const currentConfig = getSyncConfig();
  const supabaseUrl = prompt('URL do Supabase:', currentConfig.supabaseUrl || '');
  if (supabaseUrl === null) return;

  const supabaseAnonKey = prompt('Anon public key do Supabase:', currentConfig.supabaseAnonKey || '');
  if (supabaseAnonKey === null) return;

  const table = prompt('Tabela:', currentConfig.table || 'app_state');
  if (table === null) return;

  const rowId = prompt('ID do registro:', currentConfig.rowId || 'validadeapp');
  if (rowId === null) return;

  const nextConfig = {
    provider: 'supabase',
    supabaseUrl,
    supabaseAnonKey,
    table: table || 'app_state',
    rowId: rowId || 'validadeapp',
  };

  saveSyncConfig(nextConfig);
  serverSyncAvailable = false;
  stopAutoSync();
  updateSyncStatus('Conectando...');
  await setupAutoSync();
  startAutoSync();
  updateSyncStatus();
  closeSettingsMenu();
}

function normalizeServerState(serverState) {
  if (!serverState || serverState.encrypted) {
    return {
      items: [],
      products: [],
      users: [],
      history: [],
      deletedItemIds: [],
      deletedProductKeys: [],
    };
  }

  return {
    items: Array.isArray(serverState.items) ? serverState.items : [],
    products: Array.isArray(serverState.products) ? serverState.products : [],
    users: Array.isArray(serverState.users) ? serverState.users : [],
    history: Array.isArray(serverState.history) ? serverState.history : [],
    deletedItemIds: Array.isArray(serverState.deletedItemIds) ? serverState.deletedItemIds : [],
    deletedProductKeys: Array.isArray(serverState.deletedProductKeys) ? serverState.deletedProductKeys : [],
  };
}

function persistLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  localStorage.setItem(DELETED_ITEMS_KEY, JSON.stringify([...deletedItemIds]));
  localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify([...deletedProductKeys]));
}

function hasUsefulState(state) {
  return ['items', 'products', 'users', 'history'].some(key => Array.isArray(state[key]) && state[key].length > 0);
}

function mergeDeletedSet(serverEntries = [], localEntries = []) {
  return new Set([...(serverEntries || []), ...(localEntries || [])]);
}

function mergeById(serverEntries = [], localEntries = [], deletedIds = new Set()) {
  const merged = new Map();

  for (const entry of serverEntries) {
    if (entry && entry.id && !deletedIds.has(entry.id)) merged.set(entry.id, entry);
  }

  for (const entry of localEntries) {
    if (entry && entry.id && !deletedIds.has(entry.id)) merged.set(entry.id, entry);
  }

  return [...merged.values()];
}

function mergeProducts(serverProducts = [], localProducts = [], deletedProducts = new Set()) {
  const merged = new Map();

  for (const productName of [...serverProducts, ...localProducts]) {
    const normalizedName = normalizeProductName(productName || '');
    if (!normalizedName) continue;
    const productKey = getProductKey(normalizedName);
    if (deletedProducts.has(productKey)) continue;
    if (!merged.has(productKey)) {
      merged.set(productKey, normalizedName);
    }
  }

  return [...merged.values()];
}

function mergeStates(serverState, localState) {
  const mergedDeletedItemIds = mergeDeletedSet(serverState.deletedItemIds, localState.deletedItemIds);
  const mergedDeletedProductKeys = mergeDeletedSet(serverState.deletedProductKeys, localState.deletedProductKeys);
  const mergedItems = mergeById(serverState.items, localState.items, mergedDeletedItemIds)
    .filter(item => !mergedDeletedProductKeys.has(getProductKey(item.name || '')));

  return {
    items: mergedItems,
    products: mergeProducts(serverState.products, localState.products, mergedDeletedProductKeys),
    users: mergeById(serverState.users, localState.users),
    history: mergeById(serverState.history, localState.history),
    deletedItemIds: [...mergedDeletedItemIds],
    deletedProductKeys: [...mergedDeletedProductKeys],
  };
}

function applyState(state) {
  isApplyingRemoteState = true;
  items = Array.isArray(state.items) ? state.items : [];
  products = Array.isArray(state.products) ? state.products : [];
  users = Array.isArray(state.users) ? state.users : [];
  history = Array.isArray(state.history) ? state.history : [];
  deletedItemIds = new Set(Array.isArray(state.deletedItemIds) ? state.deletedItemIds : []);
  deletedProductKeys = new Set(Array.isArray(state.deletedProductKeys) ? state.deletedProductKeys : []);
  persistLocalState();
  isApplyingRemoteState = false;
}

function isSyncAuthorized() {
  return localStorage.getItem(SYNC_AUTH_KEY) === 'allowed';
}

function requestSyncAuthorization() {
  const savedChoice = localStorage.getItem(SYNC_AUTH_KEY);
  if (savedChoice) return savedChoice === 'allowed';

  const allow = confirm(`Ativar sincronização automática com ${getSyncLabel()}? Esta autorização será salva neste aparelho.`);
  localStorage.setItem(SYNC_AUTH_KEY, allow ? 'allowed' : 'denied');
  return allow;
}

async function setupAutoSync() {
  updateSyncStatus(hasSupabaseSync() ? 'Conectando...' : 'Sync offline');
  if (!isSyncAuthorized() && !(await canReachSyncServer())) {
    updateSyncStatus('Sync offline');
    return;
  }
  if (!requestSyncAuthorization()) return;
  await syncWithServer();
  updateSyncStatus();
}

async function canReachSyncServer() {
  try {
    return Boolean(await fetchRemoteState());
  } catch {
    return false;
  }
}

async function syncWithServer() {
  try {
    const rawServerState = await fetchRemoteState();
    if (!rawServerState) return;
    const serverState = normalizeServerState(rawServerState);

    serverSyncAvailable = true;
    updateSyncStatus();
    const localState = getAppState();
    const mergedState = mergeStates(serverState, localState);

    if (hasUsefulState(mergedState)) {
      applyState(mergedState);
      saveSharedState();
      refreshCurrentView();
    }
  } catch {
    serverSyncAvailable = false;
    updateSyncStatus();
  }
}

async function saveSharedState() {
  if (!serverSyncAvailable || isApplyingRemoteState) return;

  await postRemoteState(getAppState());
}

async function fetchRemoteState() {
  if (hasSupabaseSync()) {
    return fetchSupabaseState();
  }

  return fetchLocalServerState();
}

async function postRemoteState(state) {
  if (hasSupabaseSync()) {
    return postSupabaseState(state);
  }

  return postLocalServerState(state);
}

async function fetchLocalServerState() {
  const response = await fetch(getStateUrl(getDefaultSyncServer()), { cache: 'no-store' });
  if (!response.ok) return null;
  return response.json();
}

async function postLocalServerState(state) {
  try {
    const response = await fetch(getStateUrl(getDefaultSyncServer()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });

    if (!response.ok) {
      serverSyncAvailable = false;
      updateSyncStatus();
      return false;
    }

    return true;
  } catch {
    serverSyncAvailable = false;
    updateSyncStatus();
    return false;
  }
}

function getSupabaseStateUrl() {
  const config = getSyncConfig();
  const table = encodeURIComponent(config.table);
  const rowId = encodeURIComponent(config.rowId);
  return `${config.supabaseUrl}/rest/v1/${table}?id=eq.${rowId}`;
}

function getSupabaseHeaders() {
  const config = getSyncConfig();
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };
}

async function fetchSupabaseState() {
  const response = await fetch(`${getSupabaseStateUrl()}&select=state`, {
    headers: getSupabaseHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) return null;

  const rows = await response.json();
  return normalizeServerState(rows[0]?.state || {});
}

async function postSupabaseState(state) {
  try {
    const config = getSyncConfig();
    const response = await fetch(`${config.supabaseUrl}/rest/v1/${encodeURIComponent(config.table)}?on_conflict=id`, {
      method: 'POST',
      headers: {
        ...getSupabaseHeaders(),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        id: config.rowId,
        state,
        updated_at: new Date().toISOString(),
      }),
    });

    serverSyncAvailable = response.ok;
    updateSyncStatus();
    return response.ok;
  } catch {
    serverSyncAvailable = false;
    updateSyncStatus();
    return false;
  }
}

function startAutoSync() {
  if (!isSyncAuthorized() || syncIntervalId) return;
  syncIntervalId = setInterval(syncWithServer, SYNC_INTERVAL_MS);
}

function stopAutoSync() {
  if (!syncIntervalId) return;
  clearInterval(syncIntervalId);
  syncIntervalId = null;
}

function refreshCurrentView() {
  if (!currentUserData) return;

  renderProductSuggestions();

  if (!viewSection.classList.contains('hidden')) {
    renderItems();
  }

  if (!productsSection.classList.contains('hidden')) {
    renderProductManagement();
  }

  if (!sheetSection.classList.contains('hidden')) {
    renderMonthlySheet();
  }

  if (!userManagementScreen.classList.contains('hidden')) {
    renderUsers();
  }
}

function rememberExpandedProducts() {
  expandedProductKeys = new Set(
    [...itemList.querySelectorAll('.product-group.expanded')]
      .map(group => group.dataset.productKey)
      .filter(Boolean)
  );
}

function addHistoryEntry(action) {
  history.push({
    id: Date.now().toString(),
    action,
    user: currentUserData.username,
    timestamp: new Date().toISOString()
  });
  saveHistory();
  cleanupOldHistory();
}

function getProductKey(name) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function normalizeProductName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

function getExistingProductName(name) {
  const productKey = getProductKey(name);
  if (deletedProductKeys.has(productKey)) return null;
  return products.find(product => getProductKey(product) === productKey) || null;
}

function ensureProduct(name) {
  const normalizedName = normalizeProductName(name);
  if (!normalizedName) return null;
  deletedProductKeys.delete(getProductKey(normalizedName));

  const existingName = getExistingProductName(normalizedName);
  if (existingName) return existingName;

  products.push(normalizedName);
  saveProducts();
  return normalizedName;
}

function syncProductsFromItems() {
  let changed = false;

  for (const item of items) {
    const normalizedName = normalizeProductName(item.name || '');
    if (!normalizedName) continue;
    if (deletedProductKeys.has(getProductKey(normalizedName))) continue;

    if (!getExistingProductName(normalizedName)) {
      products.push(normalizedName);
      changed = true;
    }
  }

  if (changed) {
    saveProducts();
  }
}

function getProductNames() {
  const productsByKey = new Map();

  syncProductsFromItems();

  for (const product of products) {
    const name = normalizeProductName(product);
    if (!name) continue;

    const productKey = getProductKey(name);
    if (deletedProductKeys.has(productKey)) continue;
    if (!productsByKey.has(productKey)) {
      productsByKey.set(productKey, name);
    }
  }

  return [...productsByKey.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function renderProductSuggestions() {
  productSuggestions.innerHTML = '';

  for (const productName of getProductNames()) {
    const option = document.createElement('option');
    option.value = productName;
    productSuggestions.appendChild(option);
  }
}

function cleanupOldHistory() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  history = history.filter(entry => new Date(entry.timestamp) > thirtyDaysAgo);
  saveHistory();
}

function handleSaveItem(event) {
  event.preventDefault();
  const nameInput = document.getElementById('itemName');
  const dateInput = document.getElementById('itemDate');
  const quantityInput = document.getElementById('itemQuantity');
  const typedName = normalizeProductName(nameInput.value);
  const name = ensureProduct(getExistingProductName(typedName) || typedName);
  const date = dateInput.value;
  const quantity = Number(quantityInput.value) || 1;

  if (!name || !date || quantity < 1) {
    alert('Por favor, preencha todos os campos corretamente.');
    return;
  }

  items.push({
    id: Date.now().toString(),
    name,
    date,
    quantity,
    sold: false,
  });

  nameInput.value = '';
  dateInput.value = '';
  quantityInput.value = '1';
  clearSelectedProductHint();
  saveItems();
  renderProductSuggestions();
  // Não chamar renderItems() aqui pois estamos na aba adicionar
  addHistoryEntry(`Item "${name}" adicionado por ${currentUserData.username}`);
  
  alert('Item adicionado com sucesso!');
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getDaysRemaining(dateString) {
  const now = new Date();
  const target = new Date(dateString);
  const diff = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getDaysSinceSold(item) {
  if (!item.sold || !item.soldDate) return null;
  const now = new Date();
  const soldDate = new Date(item.soldDate);
  const diff = now.setHours(0, 0, 0, 0) - soldDate.setHours(0, 0, 0, 0);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function cleanupOldSoldItems() {
  const originalCount = items.length;
  items = items.filter(item => {
    if (!item.sold || !item.soldDate) return true;
    const daysSinceSold = getDaysSinceSold(item);
    return daysSinceSold !== null && daysSinceSold <= 30;
  });

  if (items.length !== originalCount) {
    saveItems();
  }
}

function getStatus(item, days) {
  if (item.sold) {
    const soldDays = getDaysSinceSold(item);
    const label = soldDays === 0
      ? `Saída por ${item.soldTo} hoje`
      : `Saída por ${item.soldTo} há ${soldDays} dia${soldDays === 1 ? '' : 's'}`;
    return { label, css: 'sold' };
  }

  if (days < 0) return { label: 'Vencido', css: 'expired' };
  if (days <= 10) return { label: `Vence em ${days} dia${days === 1 ? '' : 's'}`, css: 'critical' };
  if (days <= 20) return { label: `Vence em ${days} dias`, css: 'urgent' };
  return { label: `Faltam ${days} dias`, css: 'safe' };
}

function matchesAlertFilter(item, filter) {
  if (filter === 'sold') return item.sold;
  if (item.sold) return false;

  const days = getDaysRemaining(item.date);
  if (filter === 'expired') return days < 0;
  if (filter === 'critical') return days >= 0 && days <= 10;
  if (filter === 'urgent') return days > 10 && days <= 20;
  return false;
}

function expandProductsByAlert(filter) {
  activeAlertFilter = filter;
  switchTab('view');
  document.getElementById('listCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderMonthlySheet() {
  cleanupOldSoldItems();
  renderProductSuggestions();
  monthlySheetBody.innerHTML = '';

  const activeItemsByProduct = new Map();
  for (const item of items.filter(entry => !entry.sold)) {
    const productName = ensureProduct(getExistingProductName(item.name) || item.name);
    if (!activeItemsByProduct.has(productName)) {
      activeItemsByProduct.set(productName, []);
    }
    activeItemsByProduct.get(productName).push(item);
  }

  for (const productName of getProductNames()) {
    const productItems = (activeItemsByProduct.get(productName) || [])
      .sort((a, b) => getDaysRemaining(a.date) - getDaysRemaining(b.date))
      .slice(0, 4);

    const row = document.createElement('tr');
    appendSheetCell(row, productName, 'sheet-product-cell');

    for (let index = 0; index < 4; index += 1) {
      const item = productItems[index];
      if (item) {
        const status = getStatus(item, getDaysRemaining(item.date));
        appendSheetCell(row, formatDate(item.date));
        appendSheetCell(row, item.quantity ?? 1, 'sheet-quantity-cell');
        appendSheetCell(row, status.label, `sheet-status-cell ${status.css}`);
      } else {
        appendSheetCell(row, '');
        appendSheetCell(row, '', 'sheet-quantity-cell');
        appendSheetCell(row, '', 'sheet-status-cell');
      }
    }

    appendSheetCell(row, getSheetNotes(productItems), 'sheet-notes-cell');
    monthlySheetBody.appendChild(row);
  }
}

function getSheetNotes(productItems) {
  const notes = [];

  for (const item of productItems) {
    const days = getDaysRemaining(item.date);
    const quantity = item.quantity ?? 1;
    const date = formatDate(item.date);

    if (days < 0) {
      notes.push(`Vencido: ${quantity} un. em ${date}`);
    } else if (days <= 10) {
      notes.push(`Muito próximo: ${quantity} un. em ${date}`);
    } else if (days <= 20) {
      notes.push(`Atenção: ${quantity} un. em ${date}`);
    }
  }

  return notes.join(' | ');
}

function appendSheetCell(row, value, className = '') {
  const cell = document.createElement('td');
  cell.textContent = value;
  if (className) {
    cell.className = className;
  }
  row.appendChild(cell);
}

function renderItems() {
  rememberExpandedProducts();
  cleanupOldSoldItems();
  renderProductSuggestions();
  itemList.innerHTML = '';

  const sorted = [...items].sort((a, b) => {
    if ((a.sold ? 1 : 0) !== (b.sold ? 1 : 0)) {
      return a.sold ? 1 : -1;
    }
    return getDaysRemaining(a.date) - getDaysRemaining(b.date);
  });

  // Group validity entries under the product catalog, so products remain visible with zero dates.
  const grouped = Object.fromEntries(getProductNames().map(productName => [productName, []]));
  for (const item of sorted) {
    const productName = ensureProduct(getExistingProductName(item.name) || item.name);
    if (!grouped[productName]) {
      grouped[productName] = [];
    }
    grouped[productName].push(item);
  }

  let expired = 0;
  let urgent = 0;
  let critical = 0;
  let sold = 0;

  // Create group headers
  for (const [productName, productItems] of Object.entries(grouped)) {
    const productGroup = document.createElement('li');
    productGroup.className = 'product-group';
    productGroup.dataset.productKey = getProductKey(productName);

    // Count stats for this product
    let productUrgent = 0;
    let productExpired = 0;
    let productSold = 0;

    for (const item of productItems) {
      const days = getDaysRemaining(item.date);
      if (!item.sold) {
        if (days < 0) {
          productExpired += 1;
          expired += 1;
        }
        if (days <= 10 && days >= 0) {
          critical += 1;
        } else if (days <= 20 && days >= 0) {
          productUrgent += 1;
          urgent += 1;
        }
      } else {
        productSold += 1;
        sold += 1;
      }
    }

    const headerRow = document.createElement('div');
    headerRow.className = 'product-header-row';

    // Product header
    const header = document.createElement('button');
    header.className = 'product-header';
    
    const productInfo = document.createElement('div');
    productInfo.className = 'product-info';
    
    const nameEl = document.createElement('strong');
    nameEl.className = 'product-name';
    nameEl.textContent = productName;
    
    const countEl = document.createElement('span');
    countEl.className = 'product-count';
    countEl.textContent = `${productItems.length}`;
    
    productInfo.appendChild(nameEl);
    productInfo.appendChild(countEl);
    
    const expandIcon = document.createElement('span');
    expandIcon.className = 'expand-icon';
    expandIcon.textContent = '▼';
    
    header.appendChild(productInfo);
    header.appendChild(expandIcon);
    headerRow.appendChild(header);

    const productActions = document.createElement('div');
    productActions.className = 'product-admin-actions';

    const addValidityButton = document.createElement('button');
    addValidityButton.type = 'button';
    addValidityButton.className = 'product-admin-button primary';
    addValidityButton.textContent = 'Adicionar';
    addValidityButton.addEventListener('click', () => selectProductForNewValidity(productName));
    productActions.appendChild(addValidityButton);

    headerRow.appendChild(productActions);

    // Product details list
    const detailsList = document.createElement('ul');
    detailsList.className = 'product-details hidden';
    const productKey = getProductKey(productName);
    const shouldExpand = expandedProductKeys.has(productKey)
      || (activeAlertFilter && productItems.some(item => matchesAlertFilter(item, activeAlertFilter)));

    if (shouldExpand) {
      productGroup.classList.add('expanded');
      detailsList.classList.remove('hidden');
    }

    if (productItems.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'empty-product-row';
      emptyItem.textContent = 'Sem validades cadastradas';
      detailsList.appendChild(emptyItem);
    }

    for (const item of productItems) {
      const days = getDaysRemaining(item.date);
      const status = getStatus(item, days);

      const clone = itemTemplate.content.cloneNode(true);
      
      const itemDate = clone.querySelector('.item-date');
      itemDate.textContent = `Validade: ${formatDate(item.date)}`;

      const quantityInput = clone.querySelector('.quantity-input');
      quantityInput.value = item.quantity ?? 1;

      const statusEl = clone.querySelector('.item-status');
      statusEl.textContent = status.label;
      statusEl.className = `item-status ${status.css}`;

      // Save quantity button
      const saveQtyBtn = clone.querySelector('.save-quantity-button');
      saveQtyBtn.addEventListener('click', () => saveQuantity(item.id, quantityInput, item));

      // Sold button
      const soldButton = clone.querySelector('.sold-button');
      soldButton.addEventListener('click', () => markSold(item.id));
      soldButton.disabled = item.sold;

      // Delete button
      const deleteButton = clone.querySelector('.delete-button');
      if (currentUserData.type === 'master' && item.sold) {
        deleteButton.style.display = 'block';
        deleteButton.addEventListener('click', () => removeItem(item.id));
      } else {
        deleteButton.style.display = 'none';
      }

      detailsList.appendChild(clone);
    }

    // Toggle expansion on header click
    header.addEventListener('click', () => {
      productGroup.classList.toggle('expanded');
      detailsList.classList.toggle('hidden');
      if (productGroup.classList.contains('expanded')) {
        expandedProductKeys.add(productKey);
      } else {
        expandedProductKeys.delete(productKey);
      }
    });

    productGroup.appendChild(headerRow);
    productGroup.appendChild(detailsList);
    itemList.appendChild(productGroup);
  }

  totalItems.textContent = Object.keys(grouped).length;
  urgentCount.textContent = urgent;
  criticalCount.textContent = critical;
  expiredCount.textContent = expired;
  soldCount.textContent = sold;
}

function markSold(id) {
  const item = items.find(entry => entry.id === id);
  if (!item || item.sold) return;

  items = items.map(entry => entry.id === id ? {
    ...entry,
    sold: true,
    soldTo: currentUserData.username,
    soldDate: new Date().toISOString(),
  } : entry);

  saveItems();
  renderItems();
  addHistoryEntry(`Item "${item.name}" marcado como vendido por ${currentUserData.username}`);
}

function saveQuantity(id, input, item) {
  const newQuantity = Number(input.value);
  
  if (!newQuantity || newQuantity < 1) {
    alert('Quantidade deve ser maior que zero.');
    input.value = item.quantity ?? 1;
    return;
  }

  items = items.map(entry => entry.id === id ? {
    ...entry,
    quantity: newQuantity
  } : entry);

  saveItems();
  renderItems();
  addHistoryEntry(`Quantidade de "${item.name}" alterada para ${newQuantity} por ${currentUserData.username}`);
}

function removeItem(id) {
  const item = items.find(entry => entry.id === id);
  deletedItemIds.add(id);
  items = items.filter(entry => entry.id !== id);
  saveDeletedState();
  saveItems();
  renderProductSuggestions();
  renderItems();
  addHistoryEntry(`Item "${item.name}" removido por ${currentUserData.username}`);
}

function renderProductManagement() {
  productManagementList.innerHTML = '';
  const productNames = getProductNames();

  if (productNames.length === 0) {
    const emptyRow = document.createElement('li');
    emptyRow.className = 'empty-product-row';
    emptyRow.textContent = 'Nenhum produto cadastrado';
    productManagementList.appendChild(emptyRow);
    return;
  }

  for (const productName of productNames) {
    const productKey = getProductKey(productName);
    const validityCount = items.filter(item => getProductKey(item.name) === productKey).length;

    const row = document.createElement('li');
    row.className = 'management-row';

    const productInfo = document.createElement('div');
    productInfo.className = 'management-info';

    const nameEl = document.createElement('strong');
    nameEl.textContent = productName;

    const countEl = document.createElement('span');
    countEl.textContent = `${validityCount} validade${validityCount === 1 ? '' : 's'} cadastrada${validityCount === 1 ? '' : 's'}`;

    const actions = document.createElement('div');
    actions.className = 'management-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'management-button';
    editButton.textContent = 'Editar nome';
    editButton.addEventListener('click', () => editProduct(productName));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'management-button danger';
    deleteButton.textContent = 'Excluir produto';
    deleteButton.addEventListener('click', () => deleteProduct(productName));

    productInfo.appendChild(nameEl);
    productInfo.appendChild(countEl);
    actions.appendChild(editButton);
    actions.appendChild(deleteButton);
    row.appendChild(productInfo);
    row.appendChild(actions);
    productManagementList.appendChild(row);
  }
}

function editProduct(productName) {
  if (currentUserData.type !== 'master') return;

  const newName = normalizeProductName(prompt('Novo nome do produto:', productName) || '');
  if (!newName || newName === productName) return;

  const oldProductKey = getProductKey(productName);
  const existingName = getExistingProductName(newName);
  const finalName = existingName || newName;

  products = products
    .filter(product => getProductKey(product) !== oldProductKey)
    .filter(product => getProductKey(product) !== getProductKey(finalName));
  products.push(finalName);
  deletedProductKeys.add(oldProductKey);
  deletedProductKeys.delete(getProductKey(finalName));

  items = items.map(item => getProductKey(item.name) === oldProductKey
    ? { ...item, name: finalName }
    : item);

  saveDeletedState();
  saveProducts();
  saveItems();
  renderProductSuggestions();
  renderItems();
  renderProductManagement();
  addHistoryEntry(`Produto "${productName}" renomeado para "${finalName}" por ${currentUserData.username}`);
}

function deleteProduct(productName) {
  if (currentUserData.type !== 'master') return;

  const productKey = getProductKey(productName);
  const productItems = items.filter(item => getProductKey(item.name) === productKey);
  const message = productItems.length > 0
    ? `Excluir totalmente "${productName}" e suas ${productItems.length} validade(s)?`
    : `Excluir totalmente "${productName}"?`;

  if (!confirm(message)) return;

  deletedProductKeys.add(productKey);
  for (const item of productItems) {
    deletedItemIds.add(item.id);
  }

  products = products.filter(product => getProductKey(product) !== productKey);
  items = items.filter(item => getProductKey(item.name) !== productKey);

  saveDeletedState();
  saveProducts();
  saveItems();
  renderProductSuggestions();
  renderItems();
  renderProductManagement();
  addHistoryEntry(`Produto "${productName}" excluído totalmente por ${currentUserData.username}`);
}

function renderUsers() {
  userList.innerHTML = '';

  for (const user of users) {
    const clone = userTemplate.content.cloneNode(true);
    clone.querySelector('.user-name').textContent = user.username;
    clone.querySelector('.user-type').textContent = user.type === 'master' ? 'Mestre' : 'Simples';

    const deleteButton = clone.querySelector('.delete-user-button');
    deleteButton.addEventListener('click', () => deleteUser(user.id));
    deleteButton.disabled = user.id === currentUserData.id;

    userList.appendChild(clone);
  }
}

function deleteUser(id) {
  const user = users.find(u => u.id === id);
  if (!user || user.id === currentUserData.id) return;

  if (confirm(`Excluir usuário ${user.username}?`)) {
    users = users.filter(u => u.id !== id);
    saveUsers();
    renderUsers();
    addHistoryEntry(`Usuário ${user.username} excluído por ${currentUserData.username}`);
  }
}
