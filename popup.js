// ============================================
// TeaPass - Popup 交互逻辑 (v2)
// ============================================

let allConfig = {};
let currentPreset = null;

const els = {
  presetSelect: document.getElementById('presetSelect'),
  presetOverview: document.getElementById('presetOverview'),
  ovEnv: document.getElementById('ovEnv'),
  ovAccount: document.getElementById('ovAccount'),
  ovLogin: document.getElementById('ovLogin'),
  ovLocalhost: document.getElementById('ovLocalhost'),
  ovWhitelist: document.getElementById('ovWhitelist'),
  ovMapping: document.getElementById('ovMapping'),
  btnLogin: document.getElementById('btnLogin'),
  btnSyncCookie: document.getElementById('btnSyncCookie'),
  btnSyncToken: document.getElementById('btnSyncToken'),
  btnRefreshCookies: document.getElementById('btnRefreshCookies'),
  cookieList: document.getElementById('cookieList'),
  statusBar: document.getElementById('statusBar'),
  statusText: document.getElementById('statusText'),
  linkOptions: document.getElementById('linkOptions'),
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
  await restoreLastPreset();
});

// 加载所有配置
async function loadData() {
  try {
    const result = await sendMessage({ action: 'getAllConfig' });
    allConfig = result.data || {};
    populatePresetSelect();
  } catch (err) {
    showStatus('加载配置失败: ' + err.message, 'error');
  }
}

// 填充方案下拉框
function populatePresetSelect() {
  const presets = allConfig.presets || [];
  els.presetSelect.innerHTML = '<option value="">请选择方案...</option>';
  presets.forEach((p) => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    els.presetSelect.appendChild(option);
  });
}

// 恢复上次选择
async function restoreLastPreset() {
  const lastSelection = await getStorageData('lastSelection');
  if (lastSelection?.presetId) {
    const presets = allConfig.presets || [];
    const exists = presets.some(p => p.id === lastSelection.presetId);
    if (exists) {
      els.presetSelect.value = lastSelection.presetId;
      await onPresetChange();
    }
  }
}

// 设置事件监听
function setupEventListeners() {
  els.presetSelect.addEventListener('change', onPresetChange);
  els.btnLogin.addEventListener('click', onLoginClick);
  els.btnSyncCookie.addEventListener('click', onSyncCookieClick);
  els.btnSyncToken.addEventListener('click', onSyncTokenClick);
  els.btnRefreshCookies.addEventListener('click', refreshCookies);
  els.linkOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

// 方案切换
async function onPresetChange() {
  const presetId = els.presetSelect.value;
  const presets = allConfig.presets || [];
  currentPreset = presetId ? presets.find(p => p.id === presetId) : null;

  const lastSelection = (await getStorageData('lastSelection')) || {};
  lastSelection.presetId = currentPreset ? currentPreset.id : null;
  await chrome.storage.local.set({ lastSelection });

  updateOverview();
  updateUIState();

  if (currentPreset) {
    await refreshCookies();
  } else {
    els.cookieList.innerHTML = '<div class="empty">选择一个方案后查看 Cookie</div>';
  }
}

// 更新配置概览
function updateOverview() {
  if (!currentPreset) {
    els.presetOverview.style.display = 'none';
    return;
  }
  els.presetOverview.style.display = 'block';

  const env = (allConfig.environments || []).find(e => e.id === currentPreset.envId);
  const account = (allConfig.accounts || []).find(a => a.id === currentPreset.accountId);
  const login = (allConfig.loginConfigs || []).find(l => l.id === currentPreset.loginConfigId);
  const localhostCount = (currentPreset.localhostTargetIds || []).length;
  const whitelistCount = (currentPreset.whitelistIds || []).length;
  const mappingCount = (currentPreset.mappingIds || []).length;

  els.ovEnv.textContent = env ? `${env.name} (${env.domain})` : '未知';
  els.ovAccount.textContent = account ? account.name : '未配置';
  els.ovLogin.textContent = login ? login.name : '未配置';
  els.ovLocalhost.textContent = localhostCount > 0 ? `${localhostCount} 个目标` : 'localhost（默认）';
  els.ovWhitelist.textContent = whitelistCount > 0 ? `${whitelistCount} 个集合` : '未配置';
  els.ovMapping.textContent = mappingCount > 0 ? `${mappingCount} 个集合` : '未配置';
}

// 更新 UI 状态
function updateUIState() {
  const hasPreset = !!currentPreset;
  const hasAccount = hasPreset && !!currentPreset.accountId;
  const hasLogin = hasPreset && !!currentPreset.loginConfigId;
  const hasEnv = hasPreset && !!currentPreset.envId;

  els.btnLogin.disabled = !(hasAccount && hasLogin && hasEnv);
  els.btnSyncCookie.disabled = !hasEnv;
  els.btnSyncToken.disabled = !(hasAccount && hasLogin);
}

// 显示状态
function showStatus(text, type = 'info') {
  els.statusText.textContent = text;
  els.statusBar.className = `status-bar ${type}`;
  els.statusBar.classList.remove('hidden');
  setTimeout(() => { els.statusBar.classList.add('hidden'); }, 10000);
}

// 获取合并后的配置
function getMergedConfig() {
  if (!currentPreset) return null;

  const whitelistItems = [];
  for (const set of (allConfig.whitelistSets || [])) {
    if ((currentPreset.whitelistIds || []).includes(set.id)) {
      for (const item of (set.items || [])) {
        if (!whitelistItems.includes(item.name)) whitelistItems.push(item.name);
      }
    }
  }

  const mappings = [];
  const map = new Map();
  for (const set of (allConfig.cookieMappingSets || [])) {
    if ((currentPreset.mappingIds || []).includes(set.id)) {
      for (const m of (set.mappings || [])) {
        map.set(m.sourceName, m);
      }
    }
  }
  mappings.push(...map.values());

  let targetDomains = (allConfig.localhostTargets || [])
    .filter(t => (currentPreset.localhostTargetIds || []).includes(t.id))
    .map(t => t.domain);
  if (targetDomains.length === 0) {
    targetDomains = ['localhost'];
  }

  const env = (allConfig.environments || []).find(e => e.id === currentPreset.envId);
  const account = (allConfig.accounts || []).find(a => a.id === currentPreset.accountId);
  const loginConfig = (allConfig.loginConfigs || []).find(l => l.id === currentPreset.loginConfigId);

  return { env, account, loginConfig, whitelistItems, mappings, targetDomains };
}

// 刷新 Cookie 列表
async function refreshCookies() {
  if (!currentPreset) return;
  const env = (allConfig.environments || []).find(e => e.id === currentPreset.envId);
  if (!env) {
    els.cookieList.innerHTML = '<div class="empty">环境配置不存在</div>';
    return;
  }

  els.cookieList.innerHTML = '<div class="empty"><span class="loading"></span> 加载中...</div>';

  try {
    const result = await sendMessage({ action: 'getCookies', domain: env.domain });
    const cookies = result.data || [];
    if (cookies.length === 0) {
      els.cookieList.innerHTML = '<div class="empty">该环境下没有 Cookie</div>';
      return;
    }

    // 获取白名单用于标注
    const merged = getMergedConfig();
    const whitelistSet = new Set(merged?.whitelistItems || []);

    els.cookieList.innerHTML = cookies.map(c => {
      const isInWhitelist = whitelistSet.size === 0 || whitelistSet.has(c.name);
      const expired = c.expirationDate && c.expirationDate < (Date.now() / 1000);
      const badge = expired ? '<span class="badge expired">已过期</span>' : (!isInWhitelist ? '<span class="badge excluded">不在白名单</span>' : '');
      return `
        <div class="cookie-item ${expired ? 'expired' : ''} ${!isInWhitelist ? 'excluded' : ''}">
          <span class="cookie-name">${esc(c.name)} ${badge}</span>
          <span class="cookie-value" title="${esc(c.value)}">${esc(truncate(c.value, 20))}</span>
        </div>
      `;
    }).join('');
  } catch (err) {
    els.cookieList.innerHTML = `<div class="empty" style="color:#c00">加载失败: ${esc(err.message)}</div>`;
  }
}

// 一键登录并同步
async function onLoginClick() {
  const merged = getMergedConfig();
  if (!merged || !merged.account || !merged.loginConfig || !merged.env) {
    showStatus('方案配置不完整', 'error');
    return;
  }

  setButtonLoading(els.btnLogin, true);

  try {
    // 1. 检查 Cookie 是否过期
    const cookies = await sendMessage({ action: 'getCookies', domain: merged.env.domain });
    const now = Date.now() / 1000;
    const hasExpired = (cookies.data || []).some(c => c.expirationDate && c.expirationDate < now);

    if (hasExpired) {
      showStatus('检测到 Cookie 已过期，正在自动重新登录...', 'info');
    } else {
      showStatus('正在登录...', 'info');
    }

    // 2. 登录获取 token
    const loginResult = await sendMessage({
      action: 'login',
      account: merged.account,
      loginConfig: merged.loginConfig,
    });

    showStatus('登录成功，正在同步...', 'success');

    // 3. 同步 Cookie（排除 Token 同名项，确保 Token 优先）
    const tokenName = (merged.loginConfig.tokenSettings || {}).name || 'token';
    await sendMessage({
      action: 'syncCookies',
      sourceDomain: merged.env.domain,
      targetDomains: merged.targetDomains,
      whitelistItems: merged.whitelistItems,
      mappings: merged.mappings,
      envId: merged.env.id,
      excludeNames: [tokenName],
    });

    // 4. 同步 Token
    await sendMessage({
      action: 'setToken',
      token: loginResult.data.token,
      tokenConfig: merged.loginConfig.tokenSettings,
      targetDomains: merged.targetDomains,
    });

    showStatus('登录并同步完成', 'success');
    await refreshCookies();
  } catch (err) {
    showStatus(`操作失败: ${err.error || err.message}`, 'error');
  } finally {
    setButtonLoading(els.btnLogin, false);
  }
}

// 同步 Cookie
async function onSyncCookieClick() {
  const merged = getMergedConfig();
  if (!merged || !merged.env) {
    showStatus('方案未配置环境', 'error');
    return;
  }
  setButtonLoading(els.btnSyncCookie, true);
  showStatus('正在同步 Cookie...', 'info');

  try {
    const result = await sendMessage({
      action: 'syncCookies',
      sourceDomain: merged.env.domain,
      targetDomains: merged.targetDomains,
      whitelistItems: merged.whitelistItems,
      mappings: merged.mappings,
      envId: merged.env.id,
    });

    let total = 0, success = 0;
    for (const target of (result.data?.targets || [])) {
      total += target.cookies.length;
      success += target.cookies.filter(c => c.status === 'success').length;
    }
    showStatus(`Cookie 同步完成: ${success}/${total} 成功`, 'success');
    await refreshCookies();
  } catch (err) {
    showStatus(`同步失败: ${err.error || err.message}`, 'error');
  } finally {
    setButtonLoading(els.btnSyncCookie, false);
  }
}

// 同步 Token
async function onSyncTokenClick() {
  const merged = getMergedConfig();
  if (!merged || !merged.account || !merged.loginConfig) {
    showStatus('方案未配置账号或登录接口', 'error');
    return;
  }
  setButtonLoading(els.btnSyncToken, true);
  showStatus('正在获取 Token...', 'info');

  try {
    const loginResult = await sendMessage({
      action: 'login',
      account: merged.account,
      loginConfig: merged.loginConfig,
    });

    await sendMessage({
      action: 'setToken',
      token: loginResult.data.token,
      tokenConfig: merged.loginConfig.tokenSettings,
      targetDomains: merged.targetDomains,
    });

    showStatus('Token 已同步', 'success');
  } catch (err) {
    showStatus(`同步失败: ${err.error || err.message}`, 'error');
  } finally {
    setButtonLoading(els.btnSyncToken, false);
  }
}

// 工具函数
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response || !response.success) {
        reject(new Error(response?.error || '未知错误'));
      } else {
        resolve(response);
      }
    });
  });
}

function getStorageData(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => { resolve(result[key]); });
  });
}

function setButtonLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> 处理中...';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText;
    btn.disabled = false;
    updateUIState();
  }
}

function esc(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}
