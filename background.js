// ============================================
// TeaPass - Background Service Worker (v2)
// ============================================

// ==================== 消息处理中心 ====================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  ;(async () => {
    try {
      switch (request.action) {
        case 'login':
          console.log('[TeaPass] 收到 login 消息，准备调用 handleLogin')
          const loginResult = await handleLogin(
            request.account,
            request.loginConfig,
          )
          console.log('[TeaPass] handleLogin 执行成功')
          sendResponse({ success: true, data: loginResult })
          break
        case 'syncCookies':
          const syncResult = await syncCookiesToLocalhost(
            request.sourceDomain,
            request.targetDomains,
            request.whitelistItems,
            request.mappings,
            request.envId,
            request.excludeNames,
          )
          sendResponse({ success: true, data: syncResult })
          break
        case 'setToken':
          await setTokenToLocalhost(
            request.token,
            request.tokenConfig,
            request.targetDomains,
          )
          sendResponse({ success: true })
          break
        case 'getCookies':
          const cookies = await chrome.cookies.getAll({ url: normalizeDomain(request.domain) })
          sendResponse({ success: true, data: cookies })
          break
        case 'getAllConfig':
          const allConfig = await chrome.storage.local.get([
            'environments',
            'accounts',
            'loginConfigs',
            'cookieMappingSets',
            'whitelistSets',
            'localhostTargets',
            'presets',
          ])
          sendResponse({ success: true, data: allConfig })
          break
        default:
          sendResponse({ success: false, error: 'Unknown action' })
      }
    } catch (error) {
      sendResponse({ success: false, error: error.message })
    }
  })()
  return true
})

// ==================== CORS 动态规则管理 ====================
const CORS_RULE_ID_START = 10000
const CORS_RULE_ID_END = 19999

/**
 * 根据配置的登录接口域名，动态创建 declarativeNetRequest 规则，
 * 自动给响应头注入 Access-Control-Allow-*，解决一键登录 CORS 问题。
 */
async function updateCorsRules() {
  try {
    const result = await chrome.storage.local.get('loginConfigs')
    const loginConfigs = result.loginConfigs || []

    // 扩展自身的 Origin，如 chrome-extension://abc123
    const extensionOrigin = chrome.runtime.getURL('').replace(/\/$/, '')

    const newRules = []
    const seenHosts = new Set()
    let ruleId = CORS_RULE_ID_START

    for (const config of loginConfigs) {
      if (!config.url) continue
      try {
        const urlObj = new URL(config.url)
        const host = urlObj.host // 包含端口，如 example.com:8080

        if (seenHosts.has(host)) continue
        seenHosts.add(host)

        if (ruleId >= CORS_RULE_ID_END) break

        newRules.push({
          id: ruleId++,
          priority: 1,
          action: {
            type: 'modifyHeaders',
            responseHeaders: [
              {
                header: 'Access-Control-Allow-Origin',
                operation: 'set',
                value: extensionOrigin,
              },
              {
                header: 'Access-Control-Allow-Credentials',
                operation: 'set',
                value: 'true',
              },
              {
                header: 'Access-Control-Allow-Methods',
                operation: 'set',
                value: 'GET, POST, OPTIONS, PUT, DELETE, PATCH',
              },
              {
                header: 'Access-Control-Allow-Headers',
                operation: 'set',
                value: 'Content-Type, Authorization, X-Requested-With, Accept',
              },
            ],
          },
          condition: {
            urlFilter: `||${host}`,
            resourceTypes: ['xmlhttprequest'],
          },
        })
      } catch (e) {
        // URL 解析失败，跳过
      }
    }

    // 获取当前动态规则，移除旧的 CORS 规则
    const currentRules = await chrome.declarativeNetRequest.getDynamicRules()
    const oldRuleIds = currentRules
      .filter((r) => r.id >= CORS_RULE_ID_START && r.id <= CORS_RULE_ID_END)
      .map((r) => r.id)

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldRuleIds,
      addRules: newRules,
    })

    console.log(
      '[TeaPass] CORS 规则已更新:',
      newRules.map((r) => r.condition.urlFilter),
    )
  } catch (err) {
    console.error('[TeaPass] 更新 CORS 规则失败:', err)
  }
}

// 登录配置发生变化时自动更新规则
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.loginConfigs) {
    updateCorsRules()
  }
})

// 扩展安装/更新时初始化规则
chrome.runtime.onInstalled.addListener(() => {
  updateCorsRules()
})

// Service Worker 启动时初始化规则
updateCorsRules().then(async () => {
  const rules = await chrome.declarativeNetRequest.getDynamicRules()
  console.log('[TeaPass] 当前动态规则总数:', rules.length, rules)
})

// ==================== 登录处理 ====================
async function handleLogin(account, loginConfig) {
  console.log('[TeaPass] handleLogin 开始执行，URL:', loginConfig?.url)
  if (!loginConfig || !loginConfig.url) {
    throw new Error('登录接口未配置，请先在配置页面设置')
  }

  const {
    url,
    method = 'POST',
    contentType = 'json',
    bodyTemplate,
    tokenPath,
  } = loginConfig

  let body
  const bodyData = bodyTemplate
    .replace(/\{\{username\}\}/g, account.username)
    .replace(/\{\{password\}\}/g, account.password)

  const headers = {}

  if (contentType === 'json') {
    headers['Content-Type'] = 'application/json'
    try {
      body = JSON.parse(bodyData)
    } catch {
      body = bodyData
    }
  } else if (contentType === 'form') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = bodyData
  } else {
    body = bodyData
  }

  const fetchOptions = {
    method,
    headers,
    credentials: 'include',
  }

  if (method.toUpperCase() !== 'GET') {
    fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body
  }

  // 通过本地代理发请求，彻底绕过 CORS
  const proxyPortResult = await chrome.storage.local.get('proxyPort')
  const proxyPort = proxyPortResult.proxyPort || 9793
  const proxyUrl = `http://localhost:${proxyPort}`
  console.log('[TeaPass] handleLogin: 通过本地代理请求:', proxyUrl)

  let proxyRes
  try {
    proxyRes = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method,
        headers,
        body: fetchOptions.body || null,
      }),
    })
  } catch (proxyErr) {
    console.error('[TeaPass] handleLogin: 代理请求失败:', proxyErr.message)
    throw new Error(
      `本地代理未运行，请双击 proxy\\start-proxy.bat 启动代理后再试。` +
        `如果未安装 Node.js，请先安装：https://nodejs.org/`,
    )
  }

  const proxyData = await proxyRes.json().catch(() => ({}))
  if (proxyData.error) {
    throw new Error(`登录接口错误: ${proxyData.error}`)
  }

  // 构造一个类似 Response 的对象
  const response = {
    ok: proxyRes.ok,
    status: proxyRes.status,
    json: async () => proxyData,
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.message || data.error || `登录失败: HTTP ${response.status}`,
    )
  }

  const token = extractValueByPath(data, tokenPath || 'token')
  if (!token) {
    throw new Error('未能从响应中提取到 token，请检查 Token 提取路径配置')
  }

  return { token, rawResponse: data }
}

// ==================== Cookie 同步 ====================
async function syncCookiesToLocalhost(
  sourceDomain,
  targetDomains,
  whitelistItems,
  mappings,
  envId,
  excludeNames = [],
) {
  const sourceUrl = normalizeDomain(sourceDomain)

  if (!targetDomains || targetDomains.length === 0) {
    throw new Error('未配置 同步目标')
  }

  let cookies = await chrome.cookies.getAll({ url: sourceUrl })

  if (cookies.length === 0) {
    throw new Error(`未在 ${sourceDomain} 找到任何 cookie`)
  }

  // 白名单过滤
  if (whitelistItems && whitelistItems.length > 0) {
    cookies = cookies.filter((c) => whitelistItems.includes(c.name))
    if (cookies.length === 0) {
      throw new Error('白名单中指定的 Cookie 未在当前环境找到')
    }
  }

  // 排除与 Token 同名的 Cookie，确保 Token 设置优先
  if (excludeNames && excludeNames.length > 0) {
    cookies = cookies.filter((c) => !excludeNames.includes(c.name))
  }

  const results = []

  for (const targetDomain of targetDomains) {
    const targetUrl = normalizeDomain(targetDomain)
    const targetResults = []

    for (const cookie of cookies) {
      let targetName = cookie.name
      if (mappings && mappings.length > 0) {
        const mapping = mappings.find((m) => m.sourceName === cookie.name)
        if (mapping) {
          targetName = mapping.targetName
        }
      }

      try {
        const isSameSiteNone = cookie.sameSite === 'no_restriction'
        const setResult = await chrome.cookies.set({
          url: targetUrl,
          name: targetName,
          value: cookie.value,
          domain: getCookieDomain(targetDomain),
          path: cookie.path || '/',
          secure: isSameSiteNone,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite || 'unspecified',
          expirationDate: cookie.expirationDate,
        })
        if (!setResult) {
          throw new Error('浏览器拒绝设置该 Cookie，请检查属性是否冲突')
        }
        targetResults.push({ name: targetName, status: 'success' })
      } catch (err) {
        targetResults.push({
          name: targetName,
          status: 'error',
          error: err.message,
        })
      }
    }

    results.push({ domain: targetDomain, cookies: targetResults })
  }

  return { targets: results }
}

// ==================== Token 设置 ====================
async function setTokenToLocalhost(token, tokenConfig, targetDomains) {
  if (!targetDomains || targetDomains.length === 0) {
    throw new Error('未配置 目标')
  }

  const { name = 'token', path = '/', httpOnly = false } = tokenConfig || {}

  for (const targetDomain of targetDomains) {
    const targetUrl = normalizeDomain(targetDomain)
    await chrome.cookies.set({
      url: targetUrl,
      name,
      value: token,
      domain: getCookieDomain(targetDomain),
      path,
      secure: true,
      httpOnly,
      sameSite: 'no_restriction',
      expirationDate: Date.now() / 1000 + 86400 * 7,
    })
  }
}

// ==================== 工具函数 ====================
function normalizeDomain(domain) {
  if (domain.startsWith('http')) return domain
  return `http://${domain}`
}

function getCookieDomain(domain) {
  if (!domain) return 'localhost'
  return domain.replace(/^https?:\/\//, '').split(':')[0]
}

function extractValueByPath(obj, path) {
  if (!path) return obj
  const keys = path.split('.')
  let value = obj
  for (const key of keys) {
    if (value === null || value === undefined) return undefined
    value = value[key]
  }
  return value
}

