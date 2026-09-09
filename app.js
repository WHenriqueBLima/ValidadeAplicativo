const STORAGE_KEY = 'validadeApp.items';
const PRODUCTS_KEY = 'validadeApp.products';
const SECTIONS_KEY = 'validadeApp.sections';
const USERS_KEY = 'validadeApp.users';
const HISTORY_KEY = 'validadeApp.history';
const DELETED_ITEMS_KEY = 'validadeApp.deletedItems';
const DELETED_PRODUCTS_KEY = 'validadeApp.deletedProducts';
const DELETED_SECTIONS_KEY = 'validadeApp.deletedSections';
const DELETED_USERS_KEY = 'validadeApp.deletedUsers';
const RESTORED_PRODUCTS_KEY = 'validadeApp.restoredProducts';
const PRODUCT_CHANGES_KEY = 'validadeApp.productChanges';
const LAST_SYNC_AT_KEY = 'validadeApp.lastSyncAt';
const CURRENT_USER_KEY = 'validadeApp.currentUser';
const SYNC_SERVER_KEY = 'validadeApp.syncServer';
const SYNC_CONFIG_KEY = 'validadeApp.syncConfig';
const SYNC_AUTH_KEY = 'validadeApp.syncAuthorized.v4';
const SYNC_INTERVAL_MS = 30000;
const SYNC_DEBOUNCE_MS = 1500;
const SYNC_MAX_ATTEMPTS = 3;
const APP_VERSION = '20260515-22';
const DEVICE_ID = localStorage.getItem('validadeApp.deviceId') || `device-${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
const STATE_BROADCAST_KEY = 'validadeApp.stateBroadcast';
const CROSS_TAB_CHANNEL_NAME = 'validadeApp.crossTab';
let crossTabChannel = null;
localStorage.setItem('validadeApp.deviceId', DEVICE_ID);

const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const userManagementScreen = document.getElementById('userManagementScreen');

const loginForm = document.getElementById('loginForm');
const itemForm = document.getElementById('itemForm');
const createSectionForm = document.getElementById('createSectionForm');
const createUserForm = document.getElementById('createUserForm');

const itemList = document.getElementById('itemList');
const userList = document.getElementById('userList');
const productSuggestions = document.getElementById('productSuggestions');
const productSearchResults = document.getElementById('productSearchResults');
const productFilterInput = document.getElementById('productFilterInput');
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
const lastSyncInfo = document.getElementById('lastSyncInfo');
const syncNowButton = document.getElementById('syncNowButton');
const diagnoseSyncButton = document.getElementById('diagnoseSyncButton');
const configureSyncButton = document.getElementById('configureSyncButton');
const manageUsersButton = document.getElementById('manageUsersButton');
const logoutButton = document.getElementById('logoutButton');
const togglePasswordButton = document.getElementById('togglePasswordButton');
const clearAllButton = document.getElementById('clearAll');
const itemDateText = document.getElementById('itemDateText');
const itemDatePickerButton = document.getElementById('itemDatePickerButton');
const backToAppButton = document.getElementById('backToAppButton');
const addTab = document.getElementById('addTab');
const viewTab = document.getElementById('viewTab');
const sectionsTab = document.getElementById('sectionsTab');
const sheetTab = document.getElementById('sheetTab');
const productsTab = document.getElementById('productsTab');
const addSection = document.getElementById('addSection');
const viewSection = document.getElementById('viewSection');
const sectionsSection = document.getElementById('sectionsSection');
const sheetSection = document.getElementById('sheetSection');
const productsSection = document.getElementById('productsSection');
const sectionList = document.getElementById('sectionList');
const productManagementList = document.getElementById('productManagementList');
const monthlySheetBody = document.getElementById('monthlySheetBody');
const printSheetButton = document.getElementById('printSheetButton');

const itemTemplate = document.getElementById('itemTemplate');
const userTemplate = document.getElementById('userTemplate');
const sectionTemplate = document.getElementById('sectionTemplate');
const toastContainer = document.getElementById('toastContainer');

let items = loadItems();
let products = loadProducts();
let sections = loadSections();
let users = loadUsers();
let history = loadHistory();
let deletedItemIds = loadDeletedSet(DELETED_ITEMS_KEY);
let deletedProductKeys = loadDeletedSet(DELETED_PRODUCTS_KEY);
let deletedSectionIds = loadDeletedSet(DELETED_SECTIONS_KEY);
let deletedUserIds = loadDeletedSet(DELETED_USERS_KEY);
let restoredProductKeys = loadDeletedSet(RESTORED_PRODUCTS_KEY);
let productChanges = loadProductChanges();
let currentUserData = null;
let activeAlertFilter = null;
let serverSyncAvailable = false;
let isApplyingRemoteState = false;
let isSyncingWithServer = false;
let pendingSharedSave = false;
let hasPendingLocalChanges = false;
let lastSyncError = '';
let lastSyncAt = localStorage.getItem(LAST_SYNC_AT_KEY) || '';
let syncDeniedForSession = false;
let syncIntervalId = null;
let syncSaveTimeoutId = null;
let expandedProductKeys = new Set();
let lastPublishedStateHash = localStorage.getItem('validadeApp.lastPublishedStateHash') || '';
let lastRemoteStateHash = '';

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
  document.addEventListener('visibilitychange', handleVisibilitySync);
  window.addEventListener('online', handleVisibilitySync);
  window.addEventListener('storage', handleStorageSyncEvent);
  if ('BroadcastChannel' in window) {
    crossTabChannel = new BroadcastChannel(CROSS_TAB_CHANNEL_NAME);
    crossTabChannel.addEventListener('message', handleCrossTabMessage);
    window.addEventListener('beforeunload', () => crossTabChannel?.close());
  }
  syncNowButton.addEventListener('click', handleSyncNow);
  diagnoseSyncButton.addEventListener('click', handleDiagnoseSync);
  configureSyncButton.addEventListener('click', handleConfigureSync);
  itemForm.addEventListener('submit', handleSaveItem);
  createSectionForm.addEventListener('submit', handleCreateSection);
  document.getElementById('itemName').addEventListener('input', handleProductSearchInput);
  document.getElementById('itemName').addEventListener('focus', handleProductSearchInput);
  document.getElementById('itemName').addEventListener('blur', hideProductSearchResultsSoon);
  productFilterInput.addEventListener('input', renderItems);
  itemDateText.addEventListener('input', handleDateTextInput);
  itemDateText.addEventListener('blur', syncDateTextToNativeInput);
  document.getElementById('itemDate').addEventListener('change', handleNativeDateChange);
  itemDatePickerButton.addEventListener('click', openNativeDatePicker);
  createUserForm.addEventListener('submit', handleCreateUser);
  logoutButton.addEventListener('click', handleLogout);
  manageUsersButton.addEventListener('click', showUserManagement);
  backToAppButton.addEventListener('click', showApp);
  clearAllButton.addEventListener('click', handleClearAll);
  addTab.addEventListener('click', () => switchTab('add'));
  viewTab.addEventListener('click', () => {
    activeAlertFilter = null;
    switchTab('view');
  });
  sectionsTab.addEventListener('click', () => switchTab('sections'));
  sheetTab.addEventListener('click', () => switchTab('sheet'));
  printSheetButton.addEventListener('click', () => window.print());
  productsTab.addEventListener('click', () => switchTab('products'));
  urgentSummaryButton.addEventListener('click', () => expandProductsByAlert('urgent'));
  criticalSummaryButton.addEventListener('click', () => expandProductsByAlert('critical'));
  expiredSummaryButton.addEventListener('click', () => expandProductsByAlert('expired'));
  soldSummaryButton.addEventListener('click', () => expandProductsByAlert('sold'));
}

function handleVisibilitySync() {
  if (document.visibilityState === 'hidden') return;
  if (!currentUserData || !isSyncAuthorized()) return;
  syncWithServer();
}

function handleStorageSyncEvent(event) {
  if (!event.key || event.key !== STATE_BROADCAST_KEY || !event.newValue) return;
  if (!currentUserData || !isSyncAuthorized()) return;

  try {
    const payload = JSON.parse(event.newValue);
    if (payload.deviceId === DEVICE_ID) return;
  } catch {
    return;
  }

  if (!isSyncingWithServer) {
    syncWithServer({ force: true });
  }
}

function handleCrossTabMessage(event) {
  const payload = event?.data;
  if (!payload || payload.deviceId === DEVICE_ID) return;
  if (!currentUserData || !isSyncAuthorized()) return;

  if (!isSyncingWithServer) {
    syncWithServer({ force: true });
  }
}

function notifyCrossTabStateChange() {
  const payload = { deviceId: DEVICE_ID, timestamp: Date.now() };
  localStorage.setItem(STATE_BROADCAST_KEY, JSON.stringify(payload));
  crossTabChannel?.postMessage(payload);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    }).catch(() => {});
    return;
  }

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
  sectionsTab.classList.toggle('active', tab === 'sections');
  sheetTab.classList.toggle('active', tab === 'sheet');
  productsTab.classList.toggle('active', tab === 'products');

  addSection.classList.toggle('hidden', tab !== 'add');
  viewSection.classList.toggle('hidden', tab !== 'view');
  sectionsSection.classList.toggle('hidden', tab !== 'sections');
  sheetSection.classList.toggle('hidden', tab !== 'sheet');
  productsSection.classList.toggle('hidden', tab !== 'products');

  if (tab === 'add') {
    return;
  }

  if (tab === 'view') {
    renderItems();
    return;
  }

  if (tab === 'sections') {
    renderSections();
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
    showToast('Usuário já existe.', 'error');
    return;
  }

  const newUser = {
    id: Date.now().toString(),
    username,
    password,
    type
  };

  users.push(newUser);
  deletedUserIds.delete(newUser.id);
  saveUsers();

  document.getElementById('newUsername').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('newUserType').value = 'simple';

  renderUsers();
  addHistoryEntry(`Usuário ${username} criado por ${currentUserData.username}`);
  showToast('Usuário criado. Sincronizando...', 'success');
}

function handleClearAll() {
  itemForm.reset();
  itemDateText.value = '';
  document.getElementById('itemDate').value = '';
  document.getElementById('itemQuantity').value = '1';
  document.getElementById('itemQuantityUnit').value = 'un';
  clearSelectedProductHint();
  document.getElementById('itemName').focus();
}

function handleDateTextInput() {
  const formattedDate = formatDateText(itemDateText.value);
  itemDateText.value = formattedDate;
  syncDateTextToNativeInput();
}

function handleNativeDateChange(event) {
  itemDateText.value = isoToDateText(event.target.value);
}

function openNativeDatePicker() {
  const nativeDateInput = document.getElementById('itemDate');
  nativeDateInput.value = parseDateTextToIso(itemDateText.value) || nativeDateInput.value;

  if (typeof nativeDateInput.showPicker === 'function') {
    nativeDateInput.showPicker();
    return;
  }

  nativeDateInput.focus();
  nativeDateInput.click();
}

function syncDateTextToNativeInput() {
  document.getElementById('itemDate').value = parseDateTextToIso(itemDateText.value);
}

function formatDateText(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  return [day, month, year].filter(Boolean).join('/');
}

function parseDateTextToIso(value) {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsedDate = new Date(year, month - 1, day);

  if (
    parsedDate.getFullYear() !== year
    || parsedDate.getMonth() !== month - 1
    || parsedDate.getDate() !== day
  ) {
    return '';
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function isoToDateText(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
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
  notifyCrossTabStateChange();
  scheduleSharedStateSave();
}

function loadProducts() {
  try {
    const raw = localStorage.getItem(PRODUCTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadSections() {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY);
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
  hideProductSearchResults();
}

function selectProductForNewValidity(productName) {
  const nameInput = document.getElementById('itemName');

  switchTab('add');
  nameInput.value = productName;
  nameInput.readOnly = true;
  selectedProductHint.textContent = `Adicionando validade para: ${productName}`;
  selectedProductHint.classList.remove('hidden');
  hideProductSearchResults();
  itemDateText.focus();
}

function saveProducts() {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  notifyCrossTabStateChange();
  scheduleSharedStateSave();
}

function saveSections() {
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
  notifyCrossTabStateChange();
  scheduleSharedStateSave();
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
  notifyCrossTabStateChange();
  scheduleSharedStateSave();
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
  notifyCrossTabStateChange();
  scheduleSharedStateSave();
}

function loadDeletedSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function loadProductChanges() {
  try {
    const raw = localStorage.getItem(PRODUCT_CHANGES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDeletedState() {
  localStorage.setItem(DELETED_ITEMS_KEY, JSON.stringify([...deletedItemIds]));
  localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify([...deletedProductKeys]));
  localStorage.setItem(DELETED_SECTIONS_KEY, JSON.stringify([...deletedSectionIds]));
  localStorage.setItem(DELETED_USERS_KEY, JSON.stringify([...deletedUserIds]));
  localStorage.setItem(RESTORED_PRODUCTS_KEY, JSON.stringify([...restoredProductKeys]));
  localStorage.setItem(PRODUCT_CHANGES_KEY, JSON.stringify(productChanges));
  notifyCrossTabStateChange();
  scheduleSharedStateSave();
}

function getAppState() {
  return {
    items,
    products,
    sections,
    users,
    history,
    deletedItemIds: [...deletedItemIds],
    deletedProductKeys: [...deletedProductKeys],
    deletedSectionIds: [...deletedSectionIds],
    deletedUserIds: [...deletedUserIds],
    restoredProductKeys: [...restoredProductKeys],
    productChanges,
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

  const savedProvider = (savedConfig && (savedConfig.provider || '') || '').trim().toLowerCase();
  const fileProvider = (fileConfig && (fileConfig.provider || '') || '').trim().toLowerCase();

  const preferredConfig = savedProvider === 'local'
    ? { ...fileConfig, ...savedConfig, provider: 'local' }
    : savedProvider === 'supabase'
      ? savedConfig
      : savedConfig && (savedConfig.provider || savedConfig.supabaseUrl || savedConfig.supabaseAnonKey)
        ? savedConfig
        : fileConfig;

  const config = preferredConfig || {};
  const provider = (config.provider || '').trim().toLowerCase();
  const resolvedProvider = provider === 'auto' ? 'local' : provider;

  return {
    provider: resolvedProvider,
    supabaseUrl: (config.supabaseUrl || '').trim().replace(/\/$/, ''),
    supabaseAnonKey: (config.supabaseAnonKey || '').trim(),
    table: (config.table || 'app_state').trim(),
    rowId: (config.rowId || 'validadeapp').trim(),
  };
}

function hasCompleteSupabaseConfig(config) {
  return (config.provider || '').trim().toLowerCase() === 'supabase'
    && Boolean((config.supabaseUrl || '').trim())
    && Boolean((config.supabaseAnonKey || '').trim())
    && Boolean((config.table || 'app_state').trim())
    && Boolean((config.rowId || 'validadeapp').trim());
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

  syncStatus.textContent = message || getSyncStatusText();
  syncStatus.classList.toggle('online', serverSyncAvailable);
  syncStatus.classList.toggle('error', Boolean(lastSyncError));

  if (lastSyncInfo) {
    lastSyncInfo.textContent = getLastSyncStatusText();
  }
}

function getSyncStatusText() {
  if (lastSyncError) return `Sync falhou: ${lastSyncError}`;
  if (hasPendingLocalChanges) return 'Sync pendente';
  if (serverSyncAvailable) return `Sync online: ${getSyncLabel()}`;
  if (hasSupabaseSync() && !isSyncAuthorized()) return 'Sync aguardando autorização';
  return 'Sync offline';
}

function clearSyncError() {
  lastSyncError = '';
}

function setSyncError(error) {
  lastSyncError = simplifySyncError(error);
  updateSyncStatus();
}

function simplifySyncError(error) {
  const message = error instanceof Error ? error.message : String(error || 'erro desconhecido');
  return message.replace(/^Error:\s*/i, '').slice(0, 80);
}

function getLastSyncStatusText() {
  if (!lastSyncAt) return 'Última sync: nunca';
  return `Última sync: ${new Date(lastSyncAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function markSyncSuccess() {
  lastSyncAt = new Date().toISOString();
  localStorage.setItem(LAST_SYNC_AT_KEY, lastSyncAt);
}

class SyncConflictError extends Error {
  constructor(message = 'estado remoto mudou; tentando novamente') {
    super(message);
    this.name = 'SyncConflictError';
  }
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
  syncDeniedForSession = false;
  serverSyncAvailable = false;
  stopAutoSync();
  updateSyncStatus('Conectando...');
  await setupAutoSync();
  startAutoSync();
  updateSyncStatus();
  closeSettingsMenu();
}

async function handleSyncNow() {
  if (!requestSyncAuthorization({ forcePrompt: true })) {
    updateSyncStatus();
    return;
  }

  updateSyncStatus('Sincronizando...');
  await syncWithServer({ force: true });
  updateSyncStatus();
}

function handleDiagnoseSync() {
  const productList = getProductNames();
  const sectionNames = getSections().map(section => section.name);
  const lines = [
    `Versão: ${APP_VERSION}`,
    `Status: ${getSyncStatusText()}`,
    `Autorizado: ${isSyncAuthorized() ? 'sim' : 'não'}`,
    `Alterações pendentes: ${hasPendingLocalChanges ? 'sim' : 'não'}`,
    `Última sync: ${lastSyncAt ? new Date(lastSyncAt).toLocaleString('pt-BR') : 'nunca'}`,
    `Último erro: ${lastSyncError || 'nenhum'}`,
    `Produtos neste aparelho: ${productList.length}`,
    `Seções neste aparelho: ${sectionNames.length}`,
    '',
    ...productList.map((productName, index) => `${index + 1}. ${productName}`),
  ];

  alert(lines.join('\n'));
}

function showToast(message, type = 'info') {
  if (!toastContainer) {
    alert(message);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 240);
  }, 2600);
}

function normalizeServerState(serverState) {
  if (!serverState || serverState.encrypted) {
    return {
      items: [],
      products: [],
      sections: [],
      users: [],
      history: [],
      deletedItemIds: [],
      deletedProductKeys: [],
      deletedSectionIds: [],
      deletedUserIds: [],
      restoredProductKeys: [],
      productChanges: {},
    };
  }

  return {
    items: Array.isArray(serverState.items) ? serverState.items : [],
    products: Array.isArray(serverState.products) ? serverState.products : [],
    sections: Array.isArray(serverState.sections) ? serverState.sections : [],
    users: Array.isArray(serverState.users) ? serverState.users : [],
    history: Array.isArray(serverState.history) ? serverState.history : [],
    deletedItemIds: Array.isArray(serverState.deletedItemIds) ? serverState.deletedItemIds : [],
    deletedProductKeys: Array.isArray(serverState.deletedProductKeys) ? serverState.deletedProductKeys : [],
    deletedSectionIds: Array.isArray(serverState.deletedSectionIds) ? serverState.deletedSectionIds : [],
    deletedUserIds: Array.isArray(serverState.deletedUserIds) ? serverState.deletedUserIds : [],
    restoredProductKeys: Array.isArray(serverState.restoredProductKeys) ? serverState.restoredProductKeys : [],
    productChanges: serverState.productChanges && typeof serverState.productChanges === 'object' ? serverState.productChanges : {},
  };
}

function persistLocalState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  localStorage.setItem(DELETED_ITEMS_KEY, JSON.stringify([...deletedItemIds]));
  localStorage.setItem(DELETED_PRODUCTS_KEY, JSON.stringify([...deletedProductKeys]));
  localStorage.setItem(DELETED_SECTIONS_KEY, JSON.stringify([...deletedSectionIds]));
  localStorage.setItem(DELETED_USERS_KEY, JSON.stringify([...deletedUserIds]));
  localStorage.setItem(RESTORED_PRODUCTS_KEY, JSON.stringify([...restoredProductKeys]));
  localStorage.setItem(PRODUCT_CHANGES_KEY, JSON.stringify(productChanges));
  notifyCrossTabStateChange();
}

function hasUsefulState(state) {
  return ['items', 'products', 'sections', 'users', 'history'].some(key => Array.isArray(state[key]) && state[key].length > 0);
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
    if (!entry || !entry.id || deletedIds.has(entry.id)) continue;
    const existing = merged.get(entry.id);
    if (!existing || getEntryTimestamp(entry) >= getEntryTimestamp(existing)) {
      merged.set(entry.id, entry);
    }
  }

  return [...merged.values()];
}

function getEntryTimestamp(entry) {
  const timestamps = [entry.updatedAt, entry.soldDate, entry.timestamp, entry.createdAt, entry.id]
    .map(value => Date.parse(value) || Number(value) || 0);
  return Math.max(...timestamps, 0);
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeItems(serverItems = [], localItems = [], deletedIds = new Set(), deletedProducts = new Set()) {
  const mergedItems = [];

  for (const item of mergeById(serverItems, localItems, deletedIds)) {
    if (!item || !item.id) continue;

    const normalizedName = normalizeProductName(item.name || '');
    if (!normalizedName) continue;
    if (deletedProducts.has(getProductKey(normalizedName))) continue;

    const normalizedItem = {
      ...item,
      name: normalizedName,
      quantity: normalizeQuantity(item.quantity),
      quantityUnit: normalizeQuantityUnit(item.quantityUnit),
      sold: Boolean(item.sold),
    };
    mergedItems.push(normalizedItem);
  }

  return mergedItems;
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

function mergeSections(serverSections = [], localSections = [], deletedSections = new Set(), deletedProducts = new Set()) {
  const merged = new Map();

  for (const section of [...serverSections, ...localSections]) {
    const normalizedSection = normalizeSection(section, deletedProducts);
    if (!normalizedSection || deletedSections.has(normalizedSection.id)) continue;

    const existing = merged.get(normalizedSection.id);
    if (!existing) {
      merged.set(normalizedSection.id, normalizedSection);
      continue;
    }

    const latest = getEntryTimestamp(normalizedSection) >= getEntryTimestamp(existing)
      ? normalizedSection
      : existing;
    const productKeyChanges = mergeSectionProductChanges(
      existing.productKeyChanges,
      normalizedSection.productKeyChanges
    );

    merged.set(normalizedSection.id, normalizeSection({
      ...existing,
      ...latest,
      createdAt: existing.createdAt || normalizedSection.createdAt || latest.createdAt,
      productKeyChanges,
    }, deletedProducts));
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function normalizeSection(section, deletedProducts = new Set()) {
  if (!section || !section.id) return null;
  const name = normalizeProductName(section.name || '');
  if (!name) return null;
  const productKeyChanges = mergeSectionProductChanges(section.productKeyChanges || {});

  const baseProductKeys = Array.isArray(section.productKeys)
    ? section.productKeys
      .map(productKey => getProductKey(productKey || ''))
      .filter(productKey => productKey && !deletedProducts.has(productKey))
    : [];

  for (const productKey of baseProductKeys) {
    if (!productKeyChanges[productKey]) {
      productKeyChanges[productKey] = {
        status: 'added',
        timestamp: section.createdAt || '1970-01-01T00:00:00.000Z',
      };
    }
  }

  const productKeys = Object.entries(productKeyChanges)
    .filter(([productKey, change]) => change.status === 'added' && !deletedProducts.has(productKey))
    .map(([productKey]) => productKey);

  return {
    ...section,
    name,
    productKeys: [...new Set(productKeys)],
    productKeyChanges,
  };
}

function mergeSectionProductChanges(...changeMaps) {
  const merged = {};

  for (const changes of changeMaps) {
    for (const [rawProductKey, change] of Object.entries(changes || {})) {
      const productKey = getProductKey(rawProductKey || '');
      if (!productKey || !change || !change.status) continue;

      const normalizedChange = {
        status: change.status === 'removed' ? 'removed' : 'added',
        timestamp: change.timestamp || '1970-01-01T00:00:00.000Z',
      };
      const existing = merged[productKey];
      if (!existing || getEntryTimestamp(normalizedChange) >= getEntryTimestamp(existing)) {
        merged[productKey] = normalizedChange;
      }
    }
  }

  return merged;
}

function mergeProductChanges(serverChanges = {}, localChanges = {}) {
  const merged = {};

  for (const changes of [serverChanges, localChanges]) {
    for (const [productKey, change] of Object.entries(changes || {})) {
      if (!productKey || !change || !change.status) continue;
      const existing = merged[productKey];
      if (!existing || getProductChangeTimestamp(change) >= getProductChangeTimestamp(existing)) {
        merged[productKey] = change;
      }
    }
  }

  return merged;
}

function getProductChangeTimestamp(change) {
  return Date.parse(change?.timestamp) || 0;
}

function markProductChanged(productKey, status) {
  productChanges[productKey] = {
    status,
    timestamp: new Date().toISOString(),
  };
}

function mergeStates(serverState, localState) {
  const mergedDeletedItemIds = mergeDeletedSet(serverState.deletedItemIds, localState.deletedItemIds);
  const mergedDeletedProductKeys = mergeDeletedSet(serverState.deletedProductKeys, localState.deletedProductKeys);
  const mergedDeletedSectionIds = mergeDeletedSet(serverState.deletedSectionIds, localState.deletedSectionIds);
  const mergedDeletedUserIds = mergeDeletedSet(serverState.deletedUserIds, localState.deletedUserIds);
  const mergedProductChanges = mergeProductChanges(serverState.productChanges, localState.productChanges);

  for (const [productKey, change] of Object.entries(mergedProductChanges)) {
    if (change.status === 'restored') {
      mergedDeletedProductKeys.delete(productKey);
    }
    if (change.status === 'deleted') {
      mergedDeletedProductKeys.add(productKey);
    }
  }

  const mergedItems = mergeItems(serverState.items, localState.items, mergedDeletedItemIds, mergedDeletedProductKeys);

  return {
    items: mergedItems,
    products: mergeProducts(
      mergeProducts(serverState.products, localState.products, mergedDeletedProductKeys),
      mergedItems.map(item => item.name),
      mergedDeletedProductKeys
    ),
    sections: mergeSections(serverState.sections, localState.sections, mergedDeletedSectionIds, mergedDeletedProductKeys),
    users: mergeById(serverState.users, localState.users, mergedDeletedUserIds),
    history: mergeById(serverState.history, localState.history),
    deletedItemIds: [...mergedDeletedItemIds],
    deletedProductKeys: [...mergedDeletedProductKeys],
    deletedSectionIds: [...mergedDeletedSectionIds],
    deletedUserIds: [...mergedDeletedUserIds],
    restoredProductKeys: Array.from(new Set([...(serverState.restoredProductKeys || []), ...(localState.restoredProductKeys || [])])),
    productChanges: mergedProductChanges,
  };
}

function applyState(state) {
  isApplyingRemoteState = true;
  items = Array.isArray(state.items) ? state.items : [];
  products = Array.isArray(state.products) ? state.products : [];
  sections = Array.isArray(state.sections) ? state.sections : [];
  users = Array.isArray(state.users) ? state.users : [];
  history = Array.isArray(state.history) ? state.history : [];
  deletedItemIds = new Set(Array.isArray(state.deletedItemIds) ? state.deletedItemIds : []);
  deletedProductKeys = new Set(Array.isArray(state.deletedProductKeys) ? state.deletedProductKeys : []);
  deletedSectionIds = new Set(Array.isArray(state.deletedSectionIds) ? state.deletedSectionIds : []);
  deletedUserIds = new Set(Array.isArray(state.deletedUserIds) ? state.deletedUserIds : []);
  restoredProductKeys = new Set(Array.isArray(state.restoredProductKeys) ? state.restoredProductKeys : []);
  productChanges = state.productChanges && typeof state.productChanges === 'object' ? state.productChanges : {};
  rebuildProductCatalog();
  persistLocalState();
  isApplyingRemoteState = false;
}

function isSyncAuthorized() {
  return localStorage.getItem(SYNC_AUTH_KEY) === 'allowed';
}

function requestSyncAuthorization(options = {}) {
  const forcePrompt = Boolean(options.forcePrompt);
  const savedChoice = localStorage.getItem(SYNC_AUTH_KEY);
  if (savedChoice === 'allowed') return true;
  if (syncDeniedForSession && !forcePrompt) return false;

  const allow = confirm(`Ativar sincronização automática com ${getSyncLabel()}? Esta autorização será salva neste aparelho.`);
  if (allow) {
    localStorage.setItem(SYNC_AUTH_KEY, 'allowed');
    syncDeniedForSession = false;
  } else {
    localStorage.removeItem(SYNC_AUTH_KEY);
    syncDeniedForSession = true;
  }
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
    await fetchRemoteState();
    return true;
  } catch {
    return false;
  }
}

async function syncWithServer(options = {}) {
  if (options.force && syncSaveTimeoutId) {
    clearTimeout(syncSaveTimeoutId);
    syncSaveTimeoutId = null;
  }

  if (isSyncingWithServer) {
    pendingSharedSave = true;
    return;
  }

  isSyncingWithServer = true;

  try {
    await syncRemoteState({ force: Boolean(options.force) });
  } catch (error) {
    serverSyncAvailable = false;
    setSyncError(error);
  } finally {
    isSyncingWithServer = false;

    if (pendingSharedSave) {
      pendingSharedSave = false;
      await saveSharedState();
    }
  }
}

function scheduleSharedStateSave() {
  if (isApplyingRemoteState) return;
  hasPendingLocalChanges = true;
  if (!isSyncAuthorized()) {
    updateSyncStatus();
    return;
  }
  if (!serverSyncAvailable && !hasSupabaseSync()) return;

  if (syncSaveTimeoutId) {
    clearTimeout(syncSaveTimeoutId);
  }

  syncSaveTimeoutId = setTimeout(() => {
    syncSaveTimeoutId = null;
    saveSharedState();
  }, SYNC_DEBOUNCE_MS);
}

function getStateHash(state) {
  return JSON.stringify(normalizeServerState(state));
}

function persistPublishedStateHash(state) {
  lastPublishedStateHash = getStateHash(state);
  localStorage.setItem('validadeApp.lastPublishedStateHash', lastPublishedStateHash);
}

async function saveSharedState() {
  if (isApplyingRemoteState) return;
  if (!isSyncAuthorized()) return;
  if (!serverSyncAvailable && !hasSupabaseSync()) return;

  if (isSyncingWithServer) {
    pendingSharedSave = true;
    return;
  }

  isSyncingWithServer = true;

  try {
    await syncRemoteState({ force: false });
  } catch (error) {
    serverSyncAvailable = false;
    setSyncError(error);
  } finally {
    isSyncingWithServer = false;

    if (pendingSharedSave) {
      pendingSharedSave = false;
      await saveSharedState();
    }
  }
}

async function syncRemoteState(options = {}) {
  let lastConflict = null;

  for (let attempt = 1; attempt <= SYNC_MAX_ATTEMPTS; attempt += 1) {
    const remoteSnapshot = await fetchRemoteSnapshot();
    const serverState = normalizeServerState(remoteSnapshot.state);
    const localState = getAppState();
    const mergedState = mergeStates(serverState, localState);
    const localHash = getStateHash(localState);
    const remoteHash = getStateHash(serverState);
    const localChangedComparedToRemote = !areStatesEqual(serverState, localState);
    const mergedStateChanged = !areStatesEqual(serverState, mergedState);
    const remoteHashChanged = remoteHash !== lastRemoteStateHash;
    const writeNeeded = options.force
      || hasPendingLocalChanges
      || localChangedComparedToRemote
      || mergedStateChanged;
    const canPublish = writeNeeded && localHash !== lastPublishedStateHash;

    serverSyncAvailable = true;
    lastRemoteStateHash = remoteHash;
    applyState(mergedState);

    if (!canPublish && !remoteHashChanged) {
      clearSyncError();
      markSyncSuccess();
      refreshCurrentView();
      updateSyncStatus();
      return;
    }

    if (!canPublish) {
      clearSyncError();
      markSyncSuccess();
      refreshCurrentView();
      updateSyncStatus();
      return;
    }

    try {
      const payload = getAppState();
      await postRemoteState(payload, remoteSnapshot.version);
      hasPendingLocalChanges = false;
      persistPublishedStateHash(payload);
      clearSyncError();
      markSyncSuccess();
      refreshCurrentView();
      updateSyncStatus();
      return;
    } catch (error) {
      if (!(error instanceof SyncConflictError)) throw error;
      lastConflict = error;
    }
  }

  throw lastConflict || new Error('sincronização concorrente não concluída');
}

function areStatesEqual(firstState, secondState) {
  return JSON.stringify(normalizeServerState(firstState)) === JSON.stringify(normalizeServerState(secondState));
}

async function fetchRemoteState() {
  const snapshot = await fetchRemoteSnapshot();
  return snapshot.state;
}

async function postRemoteState(state, expectedVersion = null) {
  if (hasSupabaseSync()) {
    return postSupabaseState(state, expectedVersion);
  }

  return postLocalServerState(state);
}

async function fetchRemoteSnapshot() {
  if (hasSupabaseSync()) {
    return fetchSupabaseSnapshot();
  }

  return {
    state: await fetchLocalServerState(),
    version: null,
  };
}

async function fetchLocalServerState() {
  const response = await fetch(getStateUrl(getDefaultSyncServer()), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Servidor local ${response.status}`);
  return response.json();
}

async function postLocalServerState(state) {
  try {
    const response = await fetch(getStateUrl(getDefaultSyncServer()), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });

    if (!response.ok) throw new Error(`Servidor local ${response.status}`);

    return true;
  } catch (error) {
    serverSyncAvailable = false;
    throw error;
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
  const snapshot = await fetchSupabaseSnapshot();
  return snapshot.state;
}

async function fetchSupabaseSnapshot() {
  const response = await fetch(`${getSupabaseStateUrl()}&select=state,updated_at`, {
    headers: getSupabaseHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Supabase leitura ${response.status}`);

  const rows = await response.json();
  return {
    state: normalizeServerState(rows[0]?.state || {}),
    version: rows[0]?.updated_at || null,
  };
}

async function postSupabaseState(state, expectedVersion = null) {
  try {
    const config = getSyncConfig();
    const baseUrl = `${config.supabaseUrl}/rest/v1/${encodeURIComponent(config.table)}`;
    const body = JSON.stringify({
      id: config.rowId,
      state,
      updated_at: new Date().toISOString(),
    });

    if (!expectedVersion) {
      const insertResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          ...getSupabaseHeaders(),
          Prefer: 'return=representation',
        },
        body,
      });

      if (insertResponse.status === 409) throw new SyncConflictError();
      if (!insertResponse.ok) throw new Error(`Supabase gravação ${insertResponse.status}`);

      serverSyncAvailable = true;
      return true;
    }

    const response = await fetch(`${getSupabaseStateUrl()}&updated_at=eq.${encodeURIComponent(expectedVersion)}`, {
      method: 'PATCH',
      headers: {
        ...getSupabaseHeaders(),
        Prefer: 'return=representation',
      },
      body,
    });

    if (!response.ok) throw new Error(`Supabase gravação ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) throw new SyncConflictError();

    serverSyncAvailable = true;
    return true;
  } catch (error) {
    serverSyncAvailable = false;
    throw error;
  }
}

function startAutoSync() {
  if (!isSyncAuthorized() || syncIntervalId) return;
  syncIntervalId = setInterval(() => {
    if (!isSyncingWithServer) {
      syncWithServer();
    }
  }, SYNC_INTERVAL_MS);
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

  if (!sectionsSection.classList.contains('hidden')) {
    renderSections();
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
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function normalizeProductName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

function normalizeQuantityUnit(unit) {
  return unit === 'kg' ? 'kg' : 'un';
}

function normalizeQuantity(quantity) {
  const value = Number(quantity);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function formatQuantity(quantity, unit = 'un') {
  const normalizedUnit = normalizeQuantityUnit(unit);
  const value = normalizeQuantity(quantity);
  const formattedValue = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 3,
  }).format(value);

  return `${formattedValue} ${normalizedUnit === 'kg' ? 'kg' : 'un.'}`;
}

function getExistingProductName(name) {
  const productKey = getProductKey(name);
  if (deletedProductKeys.has(productKey)) return null;
  return products.find(product => getProductKey(product) === productKey) || null;
}

function ensureProduct(name) {
  const normalizedName = normalizeProductName(name);
  if (!normalizedName) return null;
  const productKey = getProductKey(normalizedName);
  deletedProductKeys.delete(productKey);
  restoredProductKeys.add(productKey);
  markProductChanged(productKey, 'restored');

  const existingName = getExistingProductName(normalizedName);
  if (existingName) return existingName;

  products.push(normalizedName);
  saveProducts();
  return normalizedName;
}

function resolveProductName(name) {
  const normalizedName = normalizeProductName(name || '');
  if (!normalizedName) return null;

  const existingName = getExistingProductName(normalizedName);
  return existingName || normalizedName;
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

function rebuildProductCatalog() {
  const rebuiltProducts = mergeProducts(
    products,
    items.map(item => item.name),
    deletedProductKeys
  );

  if (JSON.stringify(rebuiltProducts) !== JSON.stringify(products)) {
    products = rebuiltProducts;
  }
}

function getProductNames() {
  const productsByKey = new Map();

  rebuildProductCatalog();

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

function handleProductSearchInput(event) {
  const input = event.currentTarget;
  if (input.readOnly) {
    hideProductSearchResults();
    return;
  }

  renderProductSearchResults(input.value);
}

function renderProductSearchResults(query) {
  const normalizedQuery = getProductKey(query || '');
  const productNames = getProductNames()
    .filter(productName => !normalizedQuery || getProductKey(productName).includes(normalizedQuery))
    .slice(0, 8);

  productSearchResults.innerHTML = '';

  if (productNames.length === 0) {
    productSearchResults.classList.add('hidden');
    return;
  }

  for (const productName of productNames) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'product-search-result';
    button.textContent = productName;
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => selectProductFromSearch(productName));
    productSearchResults.appendChild(button);
  }

  productSearchResults.classList.remove('hidden');
}

function selectProductFromSearch(productName) {
  const nameInput = document.getElementById('itemName');
  nameInput.value = productName;
  hideProductSearchResults();
  itemDateText.focus();
}

function hideProductSearchResultsSoon() {
  setTimeout(hideProductSearchResults, 120);
}

function hideProductSearchResults() {
  productSearchResults.innerHTML = '';
  productSearchResults.classList.add('hidden');
}

function handleCreateSection(event) {
  event.preventDefault();
  const nameInput = document.getElementById('newSectionName');
  const sectionName = normalizeProductName(nameInput.value);

  if (!sectionName) {
    showToast('Informe o nome da seção.', 'error');
    return;
  }

  if (sections.some(section => getProductKey(section.name) === getProductKey(sectionName))) {
    showToast('Essa seção já existe.', 'error');
    return;
  }

  const section = {
    id: createId(),
    name: sectionName,
    productKeys: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sections.push(section);
  deletedSectionIds.delete(section.id);
  nameInput.value = '';
  saveSections();
  renderSections();
  addHistoryEntry(`Seção "${sectionName}" criada por ${currentUserData.username}`);
  showToast('Seção criada. Sincronizando...', 'success');
}

function renderSections() {
  sectionList.innerHTML = '';
  const visibleSections = getSections();

  if (visibleSections.length === 0) {
    const emptyRow = document.createElement('li');
    emptyRow.className = 'empty-product-row';
    emptyRow.textContent = 'Nenhuma seção criada';
    sectionList.appendChild(emptyRow);
    return;
  }

  for (const section of visibleSections) {
    const clone = sectionTemplate.content.cloneNode(true);
    const productNames = getProductNames();
    const sectionProducts = getSectionProductNames(section);

    clone.querySelector('.section-name').textContent = section.name;
    clone.querySelector('.section-count').textContent = `${sectionProducts.length} produto${sectionProducts.length === 1 ? '' : 's'}`;

    const productSelect = clone.querySelector('.section-product-select');
    renderSectionProductOptions(productSelect, productNames, section);

    clone.querySelector('.section-add-existing-button')
      .addEventListener('click', () => addExistingProductToSection(section.id, productSelect.value));

    const newProductInput = clone.querySelector('.section-new-product-input');
    clone.querySelector('.section-create-product-button')
      .addEventListener('click', () => createProductInsideSection(section.id, newProductInput));

    clone.querySelector('.delete-section-button')
      .addEventListener('click', () => deleteSection(section.id));

    const productList = clone.querySelector('.section-product-list');
    renderSectionProductList(productList, section, sectionProducts);
    sectionList.appendChild(clone);
  }
}

function getSections() {
  return sections
    .map(section => normalizeSection(section, deletedProductKeys))
    .filter(section => section && !deletedSectionIds.has(section.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

function renderSectionProductOptions(select, productNames, section) {
  select.innerHTML = '';
  const sectionProductKeys = new Set(section.productKeys || []);
  const availableProducts = productNames.filter(productName => !sectionProductKeys.has(getProductKey(productName)));

  if (availableProducts.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Nenhum produto disponível';
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  select.disabled = false;
  for (const productName of availableProducts) {
    const option = document.createElement('option');
    option.value = getProductKey(productName);
    option.textContent = productName;
    select.appendChild(option);
  }
}

function renderSectionProductList(list, section, productNames) {
  list.innerHTML = '';

  if (productNames.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'empty-product-row';
    emptyItem.textContent = 'Nenhum produto nesta seção';
    list.appendChild(emptyItem);
    return;
  }

  for (const productName of productNames) {
    const row = document.createElement('li');
    row.className = 'section-product-row';

    const nameEl = document.createElement('strong');
    nameEl.textContent = productName;

    const actions = document.createElement('div');
    actions.className = 'section-product-actions';

    const addValidityButton = document.createElement('button');
    addValidityButton.type = 'button';
    addValidityButton.className = 'section-action-button primary';
    addValidityButton.textContent = 'Adicionar validade';
    addValidityButton.addEventListener('click', () => selectProductForNewValidity(productName));

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'section-action-button danger';
    removeButton.textContent = 'Remover';
    removeButton.addEventListener('click', () => removeProductFromSection(section.id, productName));

    actions.appendChild(addValidityButton);
    actions.appendChild(removeButton);
    row.appendChild(nameEl);
    row.appendChild(actions);
    list.appendChild(row);
  }
}

function getSectionProductNames(section) {
  return [...new Set(section.productKeys || [])]
    .map(productKey => getProductNameByKey(productKey))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function getProductNameByKey(productKey) {
  return getProductNames().find(productName => getProductKey(productName) === getProductKey(productKey || '')) || null;
}

function addExistingProductToSection(sectionId, productKey) {
  if (!productKey) {
    showToast('Escolha um produto para adicionar.', 'error');
    return;
  }

  const productName = getProductNameByKey(productKey);
  if (!productName) {
    showToast('Produto não encontrado.', 'error');
    return;
  }

  addProductKeyToSection(sectionId, getProductKey(productName), `Produto "${productName}" adicionado à seção`);
}

function createProductInsideSection(sectionId, input) {
  const productName = normalizeProductName(input.value);
  if (!productName) {
    showToast('Informe o nome do produto.', 'error');
    return;
  }

  const finalProductName = ensureProduct(getExistingProductName(productName) || productName);
  renderProductSuggestions();
  if (!productsSection.classList.contains('hidden')) {
    renderProductManagement();
  }
  addProductKeyToSection(sectionId, getProductKey(finalProductName), `Produto "${finalProductName}" criado na seção`);
  input.value = '';
}

function addProductKeyToSection(sectionId, productKey, historyText) {
  const section = sections.find(entry => entry.id === sectionId);
  if (!section || deletedSectionIds.has(sectionId)) return;
  const normalizedProductKey = getProductKey(productKey || '');
  if (!normalizedProductKey) return;

  const currentSection = normalizeSection(section, deletedProductKeys);
  const productKeys = new Set(currentSection?.productKeys || []);
  if (productKeys.has(normalizedProductKey)) {
    showToast('Produto já está nesta seção.', 'error');
    return;
  }

  const now = new Date().toISOString();
  productKeys.add(normalizedProductKey);

  sections = sections.map(entry => entry.id === sectionId
    ? {
      ...entry,
      productKeys: [...productKeys],
      productKeyChanges: mergeSectionProductChanges(entry.productKeyChanges, {
        [normalizedProductKey]: { status: 'added', timestamp: now },
      }),
      updatedAt: now,
    }
    : entry);

  saveSections();
  renderSections();
  addHistoryEntry(`${historyText} "${section.name}" por ${currentUserData.username}`);
  showToast('Seção atualizada. Sincronizando...', 'success');
}

function removeProductFromSection(sectionId, productName) {
  const section = sections.find(entry => entry.id === sectionId);
  if (!section) return;

  const productKey = getProductKey(productName);
  const now = new Date().toISOString();
  sections = sections.map(entry => entry.id === sectionId
    ? {
      ...entry,
      productKeys: (entry.productKeys || []).filter(entryKey => getProductKey(entryKey) !== productKey),
      productKeyChanges: mergeSectionProductChanges(entry.productKeyChanges, {
        [productKey]: { status: 'removed', timestamp: now },
      }),
      updatedAt: now,
    }
    : entry);

  saveSections();
  renderSections();
  addHistoryEntry(`Produto "${productName}" removido da seção "${section.name}" por ${currentUserData.username}`);
  showToast('Produto removido da seção. Sincronizando...', 'success');
}

function replaceProductKeyInSections(oldProductKey, newProductKey) {
  const normalizedOldKey = getProductKey(oldProductKey || '');
  const normalizedNewKey = getProductKey(newProductKey || '');
  if (!normalizedOldKey || !normalizedNewKey || normalizedOldKey === normalizedNewKey) return false;

  let changed = false;
  const now = new Date().toISOString();

  sections = sections.map(section => {
    const normalizedSection = normalizeSection(section, deletedProductKeys);
    if (!normalizedSection?.productKeys.includes(normalizedOldKey)) return section;

    changed = true;
    const productKeys = new Set(normalizedSection.productKeys);
    productKeys.delete(normalizedOldKey);
    productKeys.add(normalizedNewKey);

    return {
      ...section,
      productKeys: [...productKeys],
      productKeyChanges: mergeSectionProductChanges(section.productKeyChanges, {
        [normalizedOldKey]: { status: 'removed', timestamp: now },
        [normalizedNewKey]: { status: 'added', timestamp: now },
      }),
      updatedAt: now,
    };
  });

  return changed;
}

function removeProductKeyFromSections(productKey) {
  const normalizedProductKey = getProductKey(productKey || '');
  if (!normalizedProductKey) return false;

  let changed = false;
  const now = new Date().toISOString();

  sections = sections.map(section => {
    const normalizedSection = normalizeSection(section, deletedProductKeys);
    if (!normalizedSection?.productKeys.includes(normalizedProductKey)) return section;

    changed = true;
    return {
      ...section,
      productKeys: normalizedSection.productKeys.filter(entryKey => entryKey !== normalizedProductKey),
      productKeyChanges: mergeSectionProductChanges(section.productKeyChanges, {
        [normalizedProductKey]: { status: 'removed', timestamp: now },
      }),
      updatedAt: now,
    };
  });

  return changed;
}

function deleteSection(sectionId) {
  const section = sections.find(entry => entry.id === sectionId);
  if (!section) return;
  if (!confirm(`Excluir a seção "${section.name}"? Os produtos e validades serão mantidos.`)) return;

  deletedSectionIds.add(sectionId);
  sections = sections.filter(entry => entry.id !== sectionId);
  saveDeletedState();
  saveSections();
  renderSections();
  addHistoryEntry(`Seção "${section.name}" excluída por ${currentUserData.username}`);
  showToast('Seção excluída. Sincronizando...', 'success');
}

function cleanupOldHistory() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  history = history.filter(entry => new Date(entry.timestamp) > thirtyDaysAgo);
  saveHistory();
}

function handleSaveItem(event) {
  event.preventDefault();
  syncDateTextToNativeInput();
  const nameInput = document.getElementById('itemName');
  const dateInput = document.getElementById('itemDate');
  const quantityInput = document.getElementById('itemQuantity');
  const quantityUnitInput = document.getElementById('itemQuantityUnit');
  const typedName = normalizeProductName(nameInput.value);
  const date = dateInput.value;
  const quantity = Number(quantityInput.value);
  const quantityUnit = normalizeQuantityUnit(quantityUnitInput.value);

  if (!typedName || !date || quantity <= 0) {
    showToast('Preencha produto, data e quantidade corretamente.', 'error');
    return;
  }

  const name = ensureProduct(getExistingProductName(typedName) || typedName);

  items.push({
    id: Date.now().toString(),
    name,
    date,
    quantity,
    quantityUnit,
    sold: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  nameInput.value = '';
  dateInput.value = '';
  itemDateText.value = '';
  quantityInput.value = '1';
  quantityUnitInput.value = 'un';
  clearSelectedProductHint();
  saveItems();
  renderProductSuggestions();
  // Não chamar renderItems() aqui pois estamos na aba adicionar
  addHistoryEntry(`Item "${name}" adicionado por ${currentUserData.username}`);
  
  showToast('Item salvo. Sincronizando...', 'success');
}

function formatDate(dateString) {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getDaysRemaining(dateString) {
  const now = new Date();
  const target = parseLocalDate(dateString);
  const diff = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString || '').split('-').map(Number);
  if (year && month && day) {
    return new Date(year, month - 1, day);
  }

  return new Date(dateString);
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
  const nextItems = [];
  for (const item of items) {
    if (!item.sold || !item.soldDate) {
      nextItems.push(item);
      continue;
    }
    const daysSinceSold = getDaysSinceSold(item);
    if (daysSinceSold !== null && daysSinceSold <= 30) {
      nextItems.push(item);
    } else {
      deletedItemIds.add(item.id);
    }
  }

  items = nextItems;

  if (items.length !== originalCount) {
    saveDeletedState();
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
    const productName = resolveProductName(item.name);
    if (!productName || deletedProductKeys.has(getProductKey(productName))) continue;
    if (!activeItemsByProduct.has(productName)) {
      activeItemsByProduct.set(productName, []);
    }
    activeItemsByProduct.get(productName).push(item);
  }

  for (const productName of getProductNames()) {
    const productItems = (activeItemsByProduct.get(productName) || [])
      .sort((a, b) => getDaysRemaining(a.date) - getDaysRemaining(b.date));
    const visibleProductItems = productItems.slice(0, 4);

    const row = document.createElement('tr');
    appendSheetCell(row, productName, 'sheet-product-cell');

    for (let index = 0; index < 4; index += 1) {
      const item = visibleProductItems[index];
      if (item) {
        const status = getStatus(item, getDaysRemaining(item.date));
        appendSheetCell(row, formatDate(item.date), 'sheet-date-cell');
        appendSheetCell(row, formatQuantity(item.quantity, item.quantityUnit), 'sheet-quantity-cell');
        appendSheetCell(row, status.label, `sheet-status-cell sheet-status-${status.css}`);
      } else {
        appendSheetCell(row, '', 'sheet-date-cell');
        appendSheetCell(row, '', 'sheet-quantity-cell');
        appendSheetCell(row, '', 'sheet-status-cell');
      }
    }

    appendSheetCell(row, getSheetNotes(productItems), 'sheet-notes-cell');
    monthlySheetBody.appendChild(row);
  }
}

function getSheetNotes(productItems) {
  if (productItems.length === 0) {
    return 'Sem validade ativa';
  }

  const notes = [];

  for (const item of productItems) {
    const days = getDaysRemaining(item.date);
    const quantity = formatQuantity(item.quantity, item.quantityUnit);
    const date = formatDate(item.date);

    if (days < 0) {
      notes.push(`Vencido: ${quantity} em ${date}`);
    } else if (days <= 10) {
      notes.push(`Muito próximo: ${quantity} em ${date}`);
    } else if (days <= 20) {
      notes.push(`Atenção: ${quantity} em ${date}`);
    }
  }

  const extraItems = productItems.slice(4);
  if (extraItems.length > 0) {
    const extraText = extraItems
      .map(item => `${formatDate(item.date)} (${formatQuantity(item.quantity, item.quantityUnit)})`)
      .join(', ');
    notes.push(`Outras validades: ${extraText}`);
  }

  return notes.length > 0 ? notes.join(' | ') : 'Em dia';
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
  const productFilter = getProductKey(productFilterInput.value || '');

  const sorted = [...items].sort((a, b) => {
    if ((a.sold ? 1 : 0) !== (b.sold ? 1 : 0)) {
      return a.sold ? 1 : -1;
    }
    return getDaysRemaining(a.date) - getDaysRemaining(b.date);
  });

  // Group validity entries under the product catalog, so products remain visible with zero dates.
  const grouped = Object.fromEntries(getProductNames().map(productName => [productName, []]));
  for (const item of sorted) {
    const productName = resolveProductName(item.name);
    if (!productName || deletedProductKeys.has(getProductKey(productName))) continue;
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
    if (productFilter && !getProductKey(productName).includes(productFilter)) {
      continue;
    }

    const productGroup = document.createElement('li');
    productGroup.className = 'product-group';
    productGroup.dataset.productKey = getProductKey(productName);

    for (const item of productItems) {
      const days = getDaysRemaining(item.date);
      if (!item.sold) {
        if (days < 0) {
          expired += 1;
        }
        if (days <= 10 && days >= 0) {
          critical += 1;
        } else if (days <= 20 && days >= 0) {
          urgent += 1;
        }
      } else {
        sold += 1;
      }
    }

    const headerRow = document.createElement('div');
    headerRow.className = 'product-header-row';

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
      quantityInput.value = normalizeQuantity(item.quantity);
      const quantityUnitSelect = clone.querySelector('.quantity-unit-select');
      quantityUnitSelect.value = normalizeQuantityUnit(item.quantityUnit);

      const statusEl = clone.querySelector('.item-status');
      statusEl.textContent = status.label;
      statusEl.className = `item-status ${status.css}`;

      // Save quantity button
      const saveQtyBtn = clone.querySelector('.save-quantity-button');
      saveQtyBtn.addEventListener('click', () => saveQuantity(item.id, quantityInput, quantityUnitSelect, item));

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

  totalItems.textContent = Object.keys(grouped).filter(productName => (
    !productFilter || getProductKey(productName).includes(productFilter)
  )).length;
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
    updatedAt: new Date().toISOString(),
  } : entry);

  saveItems();
  renderItems();
  addHistoryEntry(`Item "${item.name}" marcado como vendido por ${currentUserData.username}`);
  showToast('Saída marcada. Sincronizando...', 'success');
}

function saveQuantity(id, input, unitInput, item) {
  const newQuantity = Number(input.value);
  const newQuantityUnit = normalizeQuantityUnit(unitInput.value);
  
  if (!newQuantity || newQuantity <= 0) {
    showToast('Quantidade deve ser maior que zero.', 'error');
    input.value = normalizeQuantity(item.quantity);
    unitInput.value = normalizeQuantityUnit(item.quantityUnit);
    return;
  }

  items = items.map(entry => entry.id === id ? {
    ...entry,
    quantity: newQuantity,
    quantityUnit: newQuantityUnit,
    updatedAt: new Date().toISOString(),
  } : entry);

  saveItems();
  renderItems();
  addHistoryEntry(`Quantidade de "${item.name}" alterada para ${formatQuantity(newQuantity, newQuantityUnit)} por ${currentUserData.username}`);
  showToast('Quantidade salva. Sincronizando...', 'success');
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
  showToast('Item excluído. Sincronizando...', 'success');
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
  const sectionChanged = replaceProductKeyInSections(oldProductKey, getProductKey(finalName));

  products = products
    .filter(product => getProductKey(product) !== oldProductKey)
    .filter(product => getProductKey(product) !== getProductKey(finalName));
  products.push(finalName);
  deletedProductKeys.add(oldProductKey);
  deletedProductKeys.delete(getProductKey(finalName));
  restoredProductKeys.delete(oldProductKey);
  restoredProductKeys.add(getProductKey(finalName));
  markProductChanged(oldProductKey, 'deleted');
  markProductChanged(getProductKey(finalName), 'restored');

  items = items.map(item => getProductKey(item.name) === oldProductKey
    ? { ...item, name: finalName }
    : item);

  saveDeletedState();
  saveProducts();
  if (sectionChanged) saveSections();
  saveItems();
  renderProductSuggestions();
  renderItems();
  if (!sectionsSection.classList.contains('hidden')) {
    renderSections();
  }
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

  const sectionChanged = removeProductKeyFromSections(productKey);
  deletedProductKeys.add(productKey);
  restoredProductKeys.delete(productKey);
  markProductChanged(productKey, 'deleted');
  for (const item of productItems) {
    deletedItemIds.add(item.id);
  }

  products = products.filter(product => getProductKey(product) !== productKey);
  items = items.filter(item => getProductKey(item.name) !== productKey);

  saveDeletedState();
  saveProducts();
  if (sectionChanged) saveSections();
  saveItems();
  renderProductSuggestions();
  renderItems();
  if (!sectionsSection.classList.contains('hidden')) {
    renderSections();
  }
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
    deletedUserIds.add(id);
    users = users.filter(u => u.id !== id);
    saveDeletedState();
    saveUsers();
    renderUsers();
    addHistoryEntry(`Usuário ${user.username} excluído por ${currentUserData.username}`);
    showToast('Usuário excluído. Sincronizando...', 'success');
  }
}
