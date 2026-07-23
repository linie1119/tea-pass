# TeaPass - Chrome 扩展

一键切换环境、自动登录并同步 Cookie/Token 到 localhost 的开发者工具。

## 功能特性

- 🌐 **多环境预设** - 预配置开发/测试/生产等多个环境地址，一键切换
- 👤 **多账号管理** - 保存多套账号密码，无需每次手动输入
- 🔑 **一键登录** - 自动调用登录接口获取 Token 并同步到 localhost
- 🍪 **Cookie 同步** - 将远程环境的 Cookie 完整同步到 localhost
- 🔄 **名称映射** - 支持 Cookie 名称映射（如将远程 `session_id` 映射为本地 `sid`）
- 🎫 **Token 独立同步** - 仅同步 Token 而不影响其他 Cookie

## 安装步骤

### 1. 加载扩展

1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本目录（`chrome-extension` 文件夹）
5. 扩展图标将出现在浏览器工具栏

## 使用指南

### 第一步：配置环境

1. 点击扩展图标 → 点击「打开配置页面」
2. 在「环境配置」板块添加你的环境：
   - **环境名称**：如「开发环境」、「测试环境」
   - **域名**：如 `dev.example.com`（不需要 http/https 前缀）

### 第二步：配置账号

1. 在「账号配置」板块添加账号：
   - **用户名/邮箱**
   - **密码**
   - **绑定环境**（可选，用于筛选）

### 第三步：配置登录接口

1. 在「登录接口配置」板块填写：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| 登录接口 URL | 你的登录 API 地址 | `https://api.example.com/auth/login` |
| 请求方法 | POST 或 GET | `POST` |
| Content-Type | 请求体格式 | `application/json` |
| 请求体模板 | 使用 `{{username}}` 和 `{{password}}` 作为占位符 | `{"username":"{{username}}","password":"{{password}}"}` |
| Token 提取路径 | 从响应 JSON 中提取 token 的字段路径 | `data.token` 或 `access_token` |
| Cookie 名称 | 设置到 localhost 的 cookie 名称 | `token` |
| Path | Cookie 路径 | `/` |
| HttpOnly | 是否开启 HttpOnly | 否 |

### 第四步：使用扩展

配置完成后，点击扩展图标打开弹出面板：

1. **选择环境** - 从下拉框选择目标环境
2. **选择账号** - 从下拉框选择要登录的账号
3. **一键登录并同步** - 自动登录 → 获取 Token → 设置到 localhost → 同步 Cookie
4. 或单独使用「同步 Cookie」、「同步 Token」按钮

## 配置示例

### 场景：NestJS + JWT 项目

假设你的 NestJS 后端提供以下登录接口：

```
POST https://api.myapp.com/auth/login
Content-Type: application/json

{"username":"admin","password":"123456"}
```

响应：
```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": { "id": 1, "name": "admin" }
  }
}
```

对应配置：
- 登录接口 URL: `https://api.myapp.com/auth/login`
- 请求方法: `POST`
- Content-Type: `application/json`
- 请求体模板: `{"username":"{{username}}","password":"{{password}}"}`
- Token 提取路径: `data.token`
- Cookie 名称: `token`

### 场景：需要将 session_id 映射为 sid

如果你的远程环境使用 `session_id` 作为会话标识，但本地开发环境期望 `sid`：

在「Cookie 名称映射」中添加：
- 源 Cookie 名称: `session_id`
- 目标 Cookie 名称: `sid`

同步时，`session_id` 的值会被设置为 `sid`。

## 文件结构

```
chrome-extension/
├── manifest.json          # 扩展配置（Manifest V3）
├── background.js          # Service Worker - 登录、Cookie 操作核心逻辑
├── popup.html             # 弹出面板 HTML
├── popup.css              # 弹出面板样式
├── popup.js               # 弹出面板交互逻辑
├── options.html           # 配置页面 HTML
├── options.css            # 配置页面样式
├── options.js             # 配置页面逻辑
├── icons/                 # 图标目录
│   ├── icon.svg           # 图标源文件
│   └── README.txt         # 图标生成说明
└── README.md              # 本文件
```

## 技术说明

- 基于 Chrome Extension Manifest V3
- 使用 `chrome.cookies` API 操作 Cookie
- 使用 `chrome.storage.local` 本地存储配置（数据不会上传到任何服务器）
- 支持跨域 Cookie 同步（通过 `<all_urls>` host 权限）

## 常见问题

**Q: 为什么同步后 localhost 还是未登录状态？**
A: 请检查：
1. Token 提取路径是否正确（可以通过浏览器 DevTools 查看登录接口响应）
2. Cookie 名称是否与你的前端代码读取的一致
3. localhost 域名配置是否正确（默认是 `localhost`，如果你使用 `127.0.0.1` 或自定义域名需要修改）

**Q: 密码是否安全？**
A: 账号密码使用 `chrome.storage.local` 存储在本地，不会上传到任何服务器。但请注意，这是明文存储，建议仅在开发环境使用。

**Q: 支持哪些登录方式？**
A: 目前支持表单登录（JSON 或 form-data 格式）。OAuth、扫码登录等需要额外适配。
