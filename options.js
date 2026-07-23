// ============================================
// TeaPass - Options 配置页面逻辑 (v2)
// ============================================

let environments = [];
let accounts = [];
let loginConfigs = [];
let cookieMappingSets = [];
let whitelistSets = [];
let localhostTargets = [];
let presets = [];
let proxyPort = 9793;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadAllData();
  setupEventListeners();
  renderAll();
  document.getElementById('proxyPortInput').value = proxyPort;
});

// ==================== 数据加载 ====================
async function loadAllData() {
  const result = await chrome.storage.local.get([
    'environments', 'accounts', 'loginConfigs', 'cookieMappingSets',
    'whitelistSets', 'localhostTargets', 'presets', 'proxyPort'
  ]);

  environments = result.environments || [];
  accounts = result.accounts || [];
  loginConfigs = result.loginConfigs || [];
  cookieMappingSets = result.cookieMappingSets || [];
  whitelistSets = result.whitelistSets || [];
  localhostTargets = result.localhostTargets || [];
  presets = result.presets || [];
  proxyPort = result.proxyPort || 9793;
}

async function saveProxyPort() {
  const val = parseInt(document.getElementById('proxyPortInput').value, 10);
  if (!val || val < 1024 || val > 65535) {
    document.getElementById('proxyPortStatus').textContent = '端口范围 1024-65535';
    document.getElementById('proxyPortStatus').style.color = '#c00';
    return;
  }

  const oldPort = proxyPort;
  proxyPort = val;
  await chrome.storage.local.set({ proxyPort });

  // 尝试通知本地代理更新 port.txt
  const statusEl = document.getElementById('proxyPortStatus');
  let notified = false;

  for (const port of [oldPort, val]) {
    if (notified) break;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`http://localhost:${port}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port: val }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        notified = true;
      }
    } catch (e) {
      // 代理未在该端口运行，继续尝试
    }
  }

  if (notified) {
    statusEl.textContent = '已保存，代理配置已同步';
  } else {
    statusEl.textContent = '已保存，下次启动代理时生效';
  }
  statusEl.style.color = '#3D8B70';
  setTimeout(() => { statusEl.textContent = ''; }, 5000);
}

async function saveAllToStorage() {
  await chrome.storage.local.set({
    environments,
    accounts,
    loginConfigs,
    cookieMappingSets,
    whitelistSets,
    localhostTargets,
    presets,
  });
}

// ==================== 事件监听 ====================
function setupEventListeners() {
  // Tab 切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // 弹窗关闭
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => { if (e.target === modal) closeAllModals(); });
  });

  // 独立配置添加按钮
  document.querySelector('[data-action="add-env"]').addEventListener('click', () => openEnvModal());
  document.querySelector('[data-action="add-account"]').addEventListener('click', () => openAccountModal());
  document.querySelector('[data-action="add-login"]').addEventListener('click', () => openLoginModal());
  document.querySelector('[data-action="add-mapping-set"]').addEventListener('click', () => openMappingSetModal());
  document.querySelector('[data-action="add-whitelist-set"]').addEventListener('click', () => openWhitelistSetModal());
  document.querySelector('[data-action="add-localhost"]').addEventListener('click', () => openLocalhostModal());
  document.querySelector('[data-action="add-preset"]').addEventListener('click', () => openPresetModal());

  // 保存按钮
  document.getElementById('btnSaveEnv').addEventListener('click', saveEnv);
  document.getElementById('btnSaveAccount').addEventListener('click', saveAccount);
  document.getElementById('btnSaveLogin').addEventListener('click', saveLogin);
  document.getElementById('btnSaveMappingSet').addEventListener('click', saveMappingSet);
  document.getElementById('btnSaveWhitelistSet').addEventListener('click', saveWhitelistSet);
  document.getElementById('btnSaveLocalhost').addEventListener('click', saveLocalhost);
  document.getElementById('btnSavePreset').addEventListener('click', savePreset);

  // 内联行添加
  document.getElementById('btnAddMappingRow').addEventListener('click', () => addMappingRow());
  document.getElementById('btnAddWhitelistRow').addEventListener('click', () => addWhitelistRow());

  // 代理端口保存
  document.getElementById('btnSaveProxyPort').addEventListener('click', saveProxyPort);

  // 配置导入导出
  document.getElementById('btnExportConfig').addEventListener('click', exportConfig);
  document.getElementById('btnImportConfig').addEventListener('click', () => document.getElementById('importFileInput').click());
  document.getElementById('importFileInput').addEventListener('change', importConfig);

  // 列表事件委托
  setupListDelegation('envList', { 'edit-env': openEnvModal, 'delete-env': deleteEnv });
  setupListDelegation('accountList', { 'edit-account': openAccountModal, 'delete-account': deleteAccount });
  setupListDelegation('loginList', { 'edit-login': openLoginModal, 'delete-login': deleteLogin });
  setupListDelegation('mappingSetList', { 'edit-mapping-set': openMappingSetModal, 'delete-mapping-set': deleteMappingSet });
  setupListDelegation('whitelistSetList', { 'edit-whitelist-set': openWhitelistSetModal, 'delete-whitelist-set': deleteWhitelistSet });
  setupListDelegation('localhostList', { 'edit-localhost': openLocalhostModal, 'delete-localhost': deleteLocalhost });
  setupListDelegation('presetList', { 'edit-preset': openPresetModal, 'delete-preset': deletePreset });
}

function setupListDelegation(containerId, actionMap) {
  document.getElementById(containerId).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const index = parseInt(btn.dataset.index);
    if (actionMap[action]) actionMap[action](index);
  });
}

// ==================== 渲染 ====================
function renderAll() {
  renderEnvironments();
  renderAccounts();
  renderLogins();
  renderMappingSets();
  renderWhitelistSets();
  renderLocalhosts();
  renderPresets();
}

function renderEnvironments() {
  const container = document.getElementById('envList');
  if (environments.length === 0) { container.innerHTML = '<div class="empty">暂无环境配置</div>'; return; }
  container.innerHTML = environments.map((env, i) => `
    <div class="item-row">
      <div class="item-info"><span class="item-name">${esc(env.name)}</span><span class="item-detail">${esc(env.domain)}</span></div>
      <div class="item-actions">
        <button class="btn btn-sm btn-secondary" data-action="edit-env" data-index="${i}">编辑</button>
        <button class="btn btn-sm btn-danger" data-action="delete-env" data-index="${i}">删除</button>
      </div>
    </div>`).join('');
}

function renderAccounts() {
  const container = document.getElementById('accountList');
  if (accounts.length === 0) { container.innerHTML = '<div class="empty">暂无账号配置</div>'; return; }
  container.innerHTML = accounts.map((a, i) => `
    <div class="item-row">
      <div class="item-info"><span class="item-name">${esc(a.name)}</span><span class="item-detail">${esc(a.username)}</span></div>
      <div class="item-actions">
        <button class="btn btn-sm btn-secondary" data-action="edit-account" data-index="${i}">编辑</button>
        <button class="btn btn-sm btn-danger" data-action="delete-account" data-index="${i}">删除</button>
      </div>
    </div>`).join('');
}

function renderLogins() {
  const container = document.getElementById('loginList');
  if (loginConfigs.length === 0) { container.innerHTML = '<div class="empty">暂无登录接口配置</div>'; return; }
  container.innerHTML = loginConfigs.map((l, i) => `
    <div class="item-row">
      <div class="item-info"><span class="item-name">${esc(l.name)}</span><span class="item-detail">${esc(l.url)}</span></div>
      <div class="item-actions">
        <button class="btn btn-sm btn-secondary" data-action="edit-login" data-index="${i}">编辑</button>
        <button class="btn btn-sm btn-danger" data-action="delete-login" data-index="${i}">删除</button>
      </div>
    </div>`).join('');
}

function renderMappingSets() {
  const container = document.getElementById('mappingSetList');
  if (cookieMappingSets.length === 0) { container.innerHTML = '<div class="empty">暂无映射配置集</div>'; return; }
  container.innerHTML = cookieMappingSets.map((s, i) => `
    <div class="item-row">
      <div class="item-info"><span class="item-name">${esc(s.name)}</span><span class="item-detail">${s.mappings?.length || 0} 条映射规则</span></div>
      <div class="item-actions">
        <button class="btn btn-sm btn-secondary" data-action="edit-mapping-set" data-index="${i}">编辑</button>
        <button class="btn btn-sm btn-danger" data-action="delete-mapping-set" data-index="${i}">删除</button>
      </div>
    </div>`).join('');
}

function renderWhitelistSets() {
  const container = document.getElementById('whitelistSetList');
  if (whitelistSets.length === 0) { container.innerHTML = '<div class="empty">暂无白名单配置集</div>'; return; }
  container.innerHTML = whitelistSets.map((s, i) => `
    <div class="item-row">
      <div class="item-info"><span class="item-name">${esc(s.name)}</span><span class="item-detail">${s.items?.length || 0} 条规则</span></div>
      <div class="item-actions">
        <button class="btn btn-sm btn-secondary" data-action="edit-whitelist-set" data-index="${i}">编辑</button>
        <button class="btn btn-sm btn-danger" data-action="delete-whitelist-set" data-index="${i}">删除</button>
      </div>
    </div>`).join('');
}

function renderLocalhosts() {
  const container = document.getElementById('localhostList');
  if (localhostTargets.length === 0) { container.innerHTML = '<div class="empty">暂无 目标配置</div>'; return; }
  container.innerHTML = localhostTargets.map((t, i) => `
    <div class="item-row">
      <div class="item-info"><span class="item-name">${esc(t.name)}</span><span class="item-detail">${esc(t.domain)}</span></div>
      <div class="item-actions">
        <button class="btn btn-sm btn-secondary" data-action="edit-localhost" data-index="${i}">编辑</button>
        <button class="btn btn-sm btn-danger" data-action="delete-localhost" data-index="${i}">删除</button>
      </div>
    </div>`).join('');
}

function renderPresets() {
  const container = document.getElementById('presetList');
  if (presets.length === 0) { container.innerHTML = '<div class="empty">暂无组合方案</div>'; return; }
  container.innerHTML = presets.map((p, i) => {
    const env = environments.find(e => e.id === p.envId);
    const account = accounts.find(a => a.id === p.accountId);
    const login = loginConfigs.find(l => l.id === p.loginConfigId);
    return `
    <div class="item-row preset-row">
      <div class="item-info">
        <span class="item-name">${esc(p.name)}</span>
        <span class="item-detail">
          环境: ${esc(env?.name || '未知')} |
          账号: ${esc(account?.name || '无')} |
          登录: ${esc(login?.name || '无')} |
          目标: ${p.localhostTargetIds?.length || 0}个 |
          白名单: ${p.whitelistIds?.length || 0}个 |
          映射: ${p.mappingIds?.length || 0}个
        </span>
      </div>
      <div class="item-actions">
        <button class="btn btn-sm btn-secondary" data-action="edit-preset" data-index="${i}">编辑</button>
        <button class="btn btn-sm btn-danger" data-action="delete-preset" data-index="${i}">删除</button>
      </div>
    </div>`;
  }).join('');
}

// ==================== 环境 CRUD ====================
function openEnvModal(index = -1) {
  const modal = document.getElementById('envModal');
  document.getElementById('envModalTitle').textContent = index >= 0 ? '编辑环境' : '添加环境';
  if (index >= 0) {
    const env = environments[index];
    document.getElementById('envEditId').value = index;
    document.getElementById('envEditName').value = env.name;
    document.getElementById('envEditDomain').value = env.domain;
  } else {
    document.getElementById('envEditId').value = -1;
    document.getElementById('envEditName').value = '';
    document.getElementById('envEditDomain').value = '';
  }
  modal.classList.remove('hidden');
  document.getElementById('envEditName').focus();
}

async function saveEnv() {
  const index = parseInt(document.getElementById('envEditId').value);
  const name = document.getElementById('envEditName').value.trim();
  const domain = document.getElementById('envEditDomain').value.trim();
  if (!name || !domain) { alert('请填写完整信息'); return; }
  const data = { id: generateId(), name, domain };
  if (index >= 0) { data.id = environments[index].id; environments[index] = data; }
  else { environments.push(data); }
  await saveAllToStorage();
  closeAllModals();
  renderEnvironments();
  showSaveStatus('环境已保存', 'success');
}

async function deleteEnv(index) {
  if (!confirm('确定删除该环境吗？')) return;
  environments.splice(index, 1);
  await saveAllToStorage();
  renderEnvironments();
  showSaveStatus('环境已删除', 'info');
}

// ==================== 账号 CRUD ====================
function openAccountModal(index = -1) {
  const modal = document.getElementById('accountModal');
  document.getElementById('accountModalTitle').textContent = index >= 0 ? '编辑账号' : '添加账号';
  if (index >= 0) {
    const a = accounts[index];
    document.getElementById('accountEditId').value = index;
    document.getElementById('accountEditName').value = a.name;
    document.getElementById('accountEditUsername').value = a.username;
    document.getElementById('accountEditPassword').value = a.password;
  } else {
    document.getElementById('accountEditId').value = -1;
    document.getElementById('accountEditName').value = '';
    document.getElementById('accountEditUsername').value = '';
    document.getElementById('accountEditPassword').value = '';
  }
  modal.classList.remove('hidden');
  document.getElementById('accountEditName').focus();
}

async function saveAccount() {
  const index = parseInt(document.getElementById('accountEditId').value);
  const name = document.getElementById('accountEditName').value.trim();
  const username = document.getElementById('accountEditUsername').value.trim();
  const password = document.getElementById('accountEditPassword').value;
  if (!name || !username || !password) { alert('请填写完整信息'); return; }
  const data = { id: generateId(), name, username, password };
  if (index >= 0) { data.id = accounts[index].id; accounts[index] = data; }
  else { accounts.push(data); }
  await saveAllToStorage();
  closeAllModals();
  renderAccounts();
  showSaveStatus('账号已保存', 'success');
}

async function deleteAccount(index) {
  if (!confirm('确定删除该账号吗？')) return;
  accounts.splice(index, 1);
  await saveAllToStorage();
  renderAccounts();
  showSaveStatus('账号已删除', 'info');
}

// ==================== 登录接口 CRUD ====================
function openLoginModal(index = -1) {
  const modal = document.getElementById('loginModal');
  document.getElementById('loginModalTitle').textContent = index >= 0 ? '编辑登录接口' : '添加登录接口';
  if (index >= 0) {
    const l = loginConfigs[index];
    document.getElementById('loginEditId').value = index;
    document.getElementById('loginEditName').value = l.name;
    document.getElementById('loginEditUrl').value = l.url;
    document.getElementById('loginEditMethod').value = l.method || 'POST';
    document.getElementById('loginEditContentType').value = l.contentType || 'json';
    document.getElementById('loginEditBodyTemplate').value = l.bodyTemplate || '';
    document.getElementById('loginEditTokenPath').value = l.tokenPath || '';
    const ts = l.tokenSettings || {};
    document.getElementById('loginEditTokenName').value = ts.name || 'token';
    document.getElementById('loginEditTokenPath2').value = ts.path || '/';
    document.getElementById('loginEditTokenHttpOnly').value = String(ts.httpOnly || false);
  } else {
    document.getElementById('loginEditId').value = -1;
    ['loginEditName','loginEditUrl','loginEditBodyTemplate','loginEditTokenPath'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('loginEditMethod').value = 'POST';
    document.getElementById('loginEditContentType').value = 'json';
    document.getElementById('loginEditTokenName').value = 'token';
    document.getElementById('loginEditTokenPath2').value = '/';
    document.getElementById('loginEditTokenHttpOnly').value = 'false';
  }
  modal.classList.remove('hidden');
  document.getElementById('loginEditName').focus();
}

async function saveLogin() {
  const index = parseInt(document.getElementById('loginEditId').value);
  const data = {
    id: generateId(),
    name: document.getElementById('loginEditName').value.trim(),
    url: document.getElementById('loginEditUrl').value.trim(),
    method: document.getElementById('loginEditMethod').value,
    contentType: document.getElementById('loginEditContentType').value,
    bodyTemplate: document.getElementById('loginEditBodyTemplate').value.trim(),
    tokenPath: document.getElementById('loginEditTokenPath').value.trim(),
    tokenSettings: {
      name: document.getElementById('loginEditTokenName').value.trim() || 'token',
      path: document.getElementById('loginEditTokenPath2').value.trim() || '/',
      httpOnly: document.getElementById('loginEditTokenHttpOnly').value === 'true',
    },
  };
  if (!data.name || !data.url) { alert('请填写完整信息'); return; }
  if (!/^https?:\/\//i.test(data.url)) { alert('登录接口 URL 必须以 http:// 或 https:// 开头'); return; }
  if (index >= 0) { data.id = loginConfigs[index].id; loginConfigs[index] = data; }
  else { loginConfigs.push(data); }
  await saveAllToStorage();
  closeAllModals();
  renderLogins();
  showSaveStatus('登录接口已保存', 'success');
}

async function deleteLogin(index) {
  if (!confirm('确定删除该登录接口吗？')) return;
  loginConfigs.splice(index, 1);
  await saveAllToStorage();
  renderLogins();
  showSaveStatus('登录接口已删除', 'info');
}

// ==================== Cookie 映射集 CRUD ====================
function openMappingSetModal(index = -1) {
  const modal = document.getElementById('mappingSetModal');
  document.getElementById('mappingSetModalTitle').textContent = index >= 0 ? '编辑 Cookie 映射集' : '添加 Cookie 映射集';
  const container = document.getElementById('mappingSetEditRows');
  if (index >= 0) {
    const s = cookieMappingSets[index];
    document.getElementById('mappingSetEditId').value = index;
    document.getElementById('mappingSetEditName').value = s.name;
    container.innerHTML = '';
    (s.mappings || []).forEach(m => addMappingRow(m.sourceName, m.targetName));
  } else {
    document.getElementById('mappingSetEditId').value = -1;
    document.getElementById('mappingSetEditName').value = '';
    container.innerHTML = '';
  }
  modal.classList.remove('hidden');
  document.getElementById('mappingSetEditName').focus();
}

function addMappingRow(source = '', target = '') {
  const container = document.getElementById('mappingSetEditRows');
  const row = document.createElement('div');
  row.className = 'inline-row';
  row.innerHTML = `
    <input type="text" placeholder="源名称" class="inline-input source" value="${esc(source)}">
    <span class="inline-arrow">&rarr;</span>
    <input type="text" placeholder="目标名称" class="inline-input target" value="${esc(target)}">
    <button class="btn btn-sm btn-danger inline-delete" title="删除">&times;</button>
  `;
  row.querySelector('.inline-delete').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

async function saveMappingSet() {
  const index = parseInt(document.getElementById('mappingSetEditId').value);
  const name = document.getElementById('mappingSetEditName').value.trim();
  if (!name) { alert('请填写配置集名称'); return; }
  const mappings = [];
  document.querySelectorAll('#mappingSetEditRows .inline-row').forEach(row => {
    const source = row.querySelector('.source').value.trim();
    const target = row.querySelector('.target').value.trim();
    if (source && target) mappings.push({ sourceName: source, targetName: target });
  });
  const data = { id: generateId(), name, mappings };
  if (index >= 0) { data.id = cookieMappingSets[index].id; cookieMappingSets[index] = data; }
  else { cookieMappingSets.push(data); }
  await saveAllToStorage();
  closeAllModals();
  renderMappingSets();
  showSaveStatus('映射集已保存', 'success');
}

async function deleteMappingSet(index) {
  if (!confirm('确定删除该映射集吗？')) return;
  cookieMappingSets.splice(index, 1);
  await saveAllToStorage();
  renderMappingSets();
  showSaveStatus('映射集已删除', 'info');
}

// ==================== 白名单集 CRUD ====================
function openWhitelistSetModal(index = -1) {
  const modal = document.getElementById('whitelistSetModal');
  document.getElementById('whitelistSetModalTitle').textContent = index >= 0 ? '编辑白名单集' : '添加白名单集';
  const container = document.getElementById('whitelistSetEditRows');
  if (index >= 0) {
    const s = whitelistSets[index];
    document.getElementById('whitelistSetEditId').value = index;
    document.getElementById('whitelistSetEditName').value = s.name;
    container.innerHTML = '';
    (s.items || []).forEach(item => addWhitelistRow(item.name));
  } else {
    document.getElementById('whitelistSetEditId').value = -1;
    document.getElementById('whitelistSetEditName').value = '';
    container.innerHTML = '';
  }
  modal.classList.remove('hidden');
  document.getElementById('whitelistSetEditName').focus();
}

function addWhitelistRow(name = '') {
  const container = document.getElementById('whitelistSetEditRows');
  const row = document.createElement('div');
  row.className = 'inline-row';
  row.innerHTML = `
    <input type="text" placeholder="Cookie 名称" class="inline-input full" value="${esc(name)}">
    <button class="btn btn-sm btn-danger inline-delete" title="删除">&times;</button>
  `;
  row.querySelector('.inline-delete').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

async function saveWhitelistSet() {
  const index = parseInt(document.getElementById('whitelistSetEditId').value);
  const name = document.getElementById('whitelistSetEditName').value.trim();
  if (!name) { alert('请填写配置集名称'); return; }
  const items = [];
  document.querySelectorAll('#whitelistSetEditRows .inline-row').forEach(row => {
    const val = row.querySelector('.full').value.trim();
    if (val) items.push({ name: val });
  });
  const data = { id: generateId(), name, items };
  if (index >= 0) { data.id = whitelistSets[index].id; whitelistSets[index] = data; }
  else { whitelistSets.push(data); }
  await saveAllToStorage();
  closeAllModals();
  renderWhitelistSets();
  showSaveStatus('白名单集已保存', 'success');
}

async function deleteWhitelistSet(index) {
  if (!confirm('确定删除该白名单集吗？')) return;
  whitelistSets.splice(index, 1);
  await saveAllToStorage();
  renderWhitelistSets();
  showSaveStatus('白名单集已删除', 'info');
}

// ==================== 目标 CRUD ====================
function openLocalhostModal(index = -1) {
  const modal = document.getElementById('localhostModal');
  document.getElementById('localhostModalTitle').textContent = index >= 0 ? '编辑 目标' : '添加 目标';
  if (index >= 0) {
    const t = localhostTargets[index];
    document.getElementById('localhostEditId').value = index;
    document.getElementById('localhostEditName').value = t.name;
    document.getElementById('localhostEditDomain').value = t.domain;
  } else {
    document.getElementById('localhostEditId').value = -1;
    document.getElementById('localhostEditName').value = '';
    document.getElementById('localhostEditDomain').value = '';
  }
  modal.classList.remove('hidden');
  document.getElementById('localhostEditName').focus();
}

async function saveLocalhost() {
  const index = parseInt(document.getElementById('localhostEditId').value);
  const name = document.getElementById('localhostEditName').value.trim();
  const domain = document.getElementById('localhostEditDomain').value.trim();
  if (!name || !domain) { alert('请填写完整信息'); return; }
  const data = { id: generateId(), name, domain };
  if (index >= 0) { data.id = localhostTargets[index].id; localhostTargets[index] = data; }
  else { localhostTargets.push(data); }
  await saveAllToStorage();
  closeAllModals();
  renderLocalhosts();
  showSaveStatus('目标已保存', 'success');
}

async function deleteLocalhost(index) {
  if (!confirm('确定删除该 目标吗？')) return;
  localhostTargets.splice(index, 1);
  await saveAllToStorage();
  renderLocalhosts();
  showSaveStatus('目标已删除', 'info');
}

// ==================== 组合方案 CRUD ====================
function openPresetModal(index = -1) {
  const modal = document.getElementById('presetModal');
  document.getElementById('presetModalTitle').textContent = index >= 0 ? '编辑组合方案' : '添加组合方案';

  // 填充下拉框
  const envSelect = document.getElementById('presetEditEnvId');
  envSelect.innerHTML = '<option value="">请选择环境...</option>';
  environments.forEach(e => { const o = document.createElement('option'); o.value = e.id; o.textContent = e.name; envSelect.appendChild(o); });

  const accountSelect = document.getElementById('presetEditAccountId');
  accountSelect.innerHTML = '<option value="">不选择</option>';
  accounts.forEach(a => { const o = document.createElement('option'); o.value = a.id; o.textContent = a.name; accountSelect.appendChild(o); });

  const loginSelect = document.getElementById('presetEditLoginConfigId');
  loginSelect.innerHTML = '<option value="">不选择</option>';
  loginConfigs.forEach(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.name; loginSelect.appendChild(o); });

  // 填充多选框
  fillCheckboxList('presetEditLocalhostTargets', localhostTargets, 'name');
  fillCheckboxList('presetEditWhitelistSets', whitelistSets, 'name');
  fillCheckboxList('presetEditMappingSets', cookieMappingSets, 'name');

  if (index >= 0) {
    const p = presets[index];
    document.getElementById('presetEditId').value = index;
    document.getElementById('presetEditName').value = p.name;
    envSelect.value = p.envId || '';
    accountSelect.value = p.accountId || '';
    loginSelect.value = p.loginConfigId || '';
    setCheckboxValues('presetEditLocalhostTargets', p.localhostTargetIds || []);
    setCheckboxValues('presetEditWhitelistSets', p.whitelistIds || []);
    setCheckboxValues('presetEditMappingSets', p.mappingIds || []);
  } else {
    document.getElementById('presetEditId').value = -1;
    document.getElementById('presetEditName').value = '';
    envSelect.value = '';
    accountSelect.value = '';
    loginSelect.value = '';
    setCheckboxValues('presetEditLocalhostTargets', []);
    setCheckboxValues('presetEditWhitelistSets', []);
    setCheckboxValues('presetEditMappingSets', []);
  }
  modal.classList.remove('hidden');
  document.getElementById('presetEditName').focus();
}

function fillCheckboxList(containerId, items, labelKey) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (items.length === 0) {
    container.innerHTML = '<div class="empty" style="padding:8px;font-size:12px;">暂无配置项</div>';
    return;
  }
  items.forEach(item => {
    const label = document.createElement('label');
    label.className = 'checkbox-item';
    label.innerHTML = `<input type="checkbox" value="${esc(item.id)}"> <span>${esc(item[labelKey])}</span>`;
    container.appendChild(label);
  });
}

function setCheckboxValues(containerId, values) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = values.includes(cb.value);
  });
}

function getCheckboxValues(containerId) {
  const container = document.getElementById(containerId);
  return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

async function savePreset() {
  const index = parseInt(document.getElementById('presetEditId').value);
  const name = document.getElementById('presetEditName').value.trim();
  const envId = document.getElementById('presetEditEnvId').value;
  if (!name) { alert('请填写方案名称'); return; }
  if (!envId) { alert('请选择目标环境'); return; }
  const data = {
    id: generateId(),
    name,
    envId,
    accountId: document.getElementById('presetEditAccountId').value || null,
    loginConfigId: document.getElementById('presetEditLoginConfigId').value || null,
    localhostTargetIds: getCheckboxValues('presetEditLocalhostTargets'),
    whitelistIds: getCheckboxValues('presetEditWhitelistSets'),
    mappingIds: getCheckboxValues('presetEditMappingSets'),
  };
  if (index >= 0) { data.id = presets[index].id; presets[index] = data; }
  else { presets.push(data); }
  await saveAllToStorage();
  closeAllModals();
  renderPresets();
  showSaveStatus('组合方案已保存', 'success');
}

async function deletePreset(index) {
  if (!confirm('确定删除该组合方案吗？')) return;
  presets.splice(index, 1);
  await saveAllToStorage();
  renderPresets();
  showSaveStatus('组合方案已删除', 'info');
}

// ==================== 工具函数 ====================
function closeAllModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

// ==================== 配置导入导出 ====================
async function exportConfig() {
  try {
    const keys = [
      'environments', 'accounts', 'loginConfigs', 'cookieMappingSets',
      'whitelistSets', 'localhostTargets', 'presets', 'proxyPort', 'lastSelection'
    ];
    const result = await chrome.storage.local.get(keys);
    const exportData = {
      version: '2.0',
      exportTime: new Date().toISOString(),
      ...result
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `teapass-config-${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showSaveStatus('配置已导出', 'success');
  } catch (err) {
    showSaveStatus('导出失败: ' + err.message, 'error');
  }
}

async function importConfig(e) {
  const file = e.target.files[0];
  if (!file) return;

  // 重置 input，允许再次选择同一文件
  e.target.value = '';

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // 基础校验
    if (!data || typeof data !== 'object') {
      throw new Error('文件格式不正确');
    }

    const knownKeys = ['environments', 'accounts', 'loginConfigs', 'cookieMappingSets',
      'whitelistSets', 'localhostTargets', 'presets', 'proxyPort', 'lastSelection'];
    const hasAnyKey = knownKeys.some(k => k in data);
    if (!hasAnyKey) {
      throw new Error('文件中未找到有效的 TeaPass 配置数据');
    }

    // 确认覆盖
    const confirmed = confirm(
      `确定要导入配置吗？\n\n这将覆盖当前所有配置（环境、账号、方案等）。\n建议先导出备份当前配置。`
    );
    if (!confirmed) return;

    const importData = {};
    knownKeys.forEach(k => {
      if (k in data) importData[k] = data[k];
    });

    await chrome.storage.local.set(importData);

    // 重新加载数据并渲染
    await loadAllData();
    document.getElementById('proxyPortInput').value = proxyPort;
    renderAll();

    showSaveStatus('配置导入成功', 'success');
  } catch (err) {
    showSaveStatus('导入失败: ' + err.message, 'error');
  }
}

function showSaveStatus(text, type) {
  const status = document.getElementById('saveStatus');
  status.textContent = text;
  status.className = 'save-status ' + (type === 'error' ? 'error' : type === 'info' ? '' : 'success');
  setTimeout(() => { status.textContent = ''; status.className = 'save-status'; }, 6000);
}

function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
