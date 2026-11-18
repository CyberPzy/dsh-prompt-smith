[English](./README.en.md) | **中文**

# dsh-prompt-smith

DeepSeek Harness 插件：在输入框工具行、模型选择器左侧加一个一键按钮，把当前草稿锻造成一条结构清晰、边界完整、可直接发送的提示词。

- 包名：`@cyberpzy/dsh-prompt-smith`
- 版本：`1.0.1`
- 内部标识：`prompt-smith`（配置行 id、模块名、locale 命名空间、槽位 id）
- 仓库：<https://github.com/CyberPzy/dsh-prompt-smith>

## 功能特性

- 一键增强：点击 ✨ 直接替换输入框内容，再点 ↺ 恢复原文，各是一次 Ctrl+Z。
- 需求扩写而非措辞润色：保留草稿中的全部事实、命令、占位符与任务范围，把隐含的合理默认补成明确要求。
- 状态与边界补全：交互类需求会补出状态机（初始 / 进行中 / 完成 / 失败 / 空态）、触发方式、边界情况与验收标准。
- 防注入围栏：草稿包在 `<draft>` 中并声明其内容不是指令。
- 模型自选：可指定供应商、模型、思考强度；未指定时自动选 id 含 `deepseek` 的路由与 id 含 `flash` 的模型。
- 配置持久化：设置写入 profile 的 `cordis.patch.yml` 补丁行，跨插件重装与宿主重启保留。
- 零 npm 依赖、无构建步骤：`index.js`（Host 半）与 `client.js`（Client 半）均为纯 JS。

## 安装

前置要求：

| 项 | 要求 |
|---|---|
| 宿主 | DeepSeek Harness ≥ `0.2.2-rc.3`（清单字段 `dshTarget`） |
| profile | 挂有 `llm` 服务与至少一个模型供应商适配器；带 Web 层的 profile |
| CLI | `dsh` 命令（Harness 自带，GUI 版位于安装目录 `resources\runtime\cli\bin`） |
| 网络 | 无特殊要求，公开仓库直接安装 |

```bash
dsh plugin --profile desktop add github:CyberPzy/dsh-prompt-smith
```

- `desktop` 替换为你实际在跑的 profile 名。
- 装完重启应用（或重启 `dsh web`），浏览器 `Ctrl+R` 刷新页面。

升级（重复执行同一命令即拉到默认分支最新版）：

```bash
dsh plugin --profile desktop add github:CyberPzy/dsh-prompt-smith
```

> **从早期预览版本升到 1.0.0**：内部标识统一为短名 `prompt-smith`（配置行 id、模块名、locale 命名空间、槽位 id），包名与 HTTP 路由保留 `dsh-` 前缀。若 profile 的 `cordis.patch.yml` 中该行仍是旧 id（`prompt-enhancer`、`dsh-prompt-enhancer`、`dsh-prompt-smith`），升级前改成 `- id: prompt-smith`（缩进不变），已存的模型、思考强度、内置提示词才会被新版本接回；不改则该行沦为孤儿，新行按默认值生成。

锁定版本：

```bash
dsh plugin --profile desktop add github:CyberPzy/dsh-prompt-smith#v1.0.1
```

卸载：

```bash
dsh plugin --profile desktop remove @cyberpzy/dsh-prompt-smith
```

离线或网络受限时用本地目录：

```bash
dsh plugin --profile desktop add link:C:\path\to\dsh-prompt-smith
```

## 快速开始

最小可用示例（无需任何配置）：

1. 安装插件并重启应用，`Ctrl+R` 刷新页面。
2. 在输入框输入草稿：

```text
登录很慢
```

3. 点击输入框左下工具行、模型选择器左侧的 ✨ 按钮。
4. 输入框内容被直接替换为结构化提示词，按钮变为 ↺；点击 ↺ 回到 `登录很慢`。

示例输出（实际输出随模型与草稿变化，不保证逐字一致）：

```text
诊断并修复登录缓慢问题：定位耗时环节（前端请求、后端接口、鉴权、数据库），
给出瓶颈证据与修复方案；说明修复前后各状态（初始 / 进行中 / 成功 / 失败）的预期反馈，
覆盖空输入、重复提交、网络超时与失败恢复；给出验收标准。
```

## 配置项

配置来源两处：设置页（**设置 → 提示词增强**）与 profile 的 `cordis.patch.yml` 补丁行（`id: prompt-smith`）。两处读写同一份状态。

| 名称 | 类型 | 默认值 | 作用 |
|---|---|---|---|
| `enabled` | boolean | `true` | 关闭后隐藏输入框按钮，增强接口返回 `502 DISABLED`。 |
| `prompt` | string | `''` | 内置 system prompt。留空用内置默认提示词；非空整体替换。 |
| `provider` | string | `''` | 润色所用供应商 id。留空自动选 id 含 `deepseek` 的路由，没有则取第一个可用供应商。 |
| `model` | string | `''` | 润色所用模型 id。留空自动选 id 含 `flash` 的模型，否则取该供应商的第一个模型。 |
| `reasoningEffort` | string | `'auto'` | 思考强度。`auto` 取该模型声明的最低档；也可写死档位 id（如 `low`、`high`）。 |
| `temperature` | number | `0.3` | 采样温度，有效区间 `0`–`2`，越界被钳制到边界。 |
| `maxTokens` | number | `1200` | 输出 token 上限，有效区间 `200`–`8192`，取整。 |
| `maxChars` | number | `6000` | 允许润色的草稿字数上限，有效区间 `200`–`20000`，取整；超长拒绝并提示分段。 |

补丁文件写法：

```yaml
- id: prompt-smith
  name: '@cyberpzy/dsh-prompt-smith'
  config:
    enabled: true
    prompt: ''
    provider: ''
    model: ''
    reasoningEffort: auto
    temperature: 0.3
    maxTokens: 1200
    maxChars: 6000
```

## 使用示例

### 按钮状态

| 状态 | 图标 | 悬停提示 | 点击行为 |
|---|---|---|---|
| 输入框为空（含纯空白） | 按钮隐藏 | — | — |
| 待增强 | ✨ | 增强提示词 | 润色并直接替换草稿，缓存原文 |
| 润色中 | ◌ 旋转（禁用） | 正在润色… | 不可点击 |
| 已增强 | ↺ | 恢复原文 | 恢复缓存的原文 |
| 失败 | ✨ 红色 | 错误信息 | 4 秒后自动复位 |

### 指定模型并测试

1. **设置 → 提示词增强** → 「润色模型」选供应商与模型（切模型不改变已选强度）。
2. 「思考强度」选档位；下拉优先列该模型声明的档位，未声明时给 `off` / `minimal` / `low` / `medium` / `high`。
3. 点「测试当前模型与思考强度」：运行中转圈，成功绿勾「成功」、失败红叉「失败」，约 1 秒后回到普通态；失败原因以红色一行常驻按钮下方，直到下一次成功。

### 自定义提示词

在「内置提示词」文本框改写并失焦保存，或直接改补丁行的 `prompt`。清空内容保存即回退内置默认。

## 接口说明

以下为本机同源 HTTP 路由（仅供插件客户端调用）。五条路由均要求请求来自本机页面、同源，请求体上限 64 KiB，否则返回 `403 FORBIDDEN`。

### `POST /dsh-prompt-smith/enhance`

请求：

```json
{ "draft": "登录很慢" }
```

成功响应 `200`：

```json
{
  "ok": true,
  "text": "<改写后的提示词>",
  "provider": "<自动解析到的本机供应商>",
  "model": "<自动解析到的本机模型>",
  "reasoningEffort": "off"
}
```

失败响应：`400 EMPTY_DRAFT`（草稿为空）、`400 TOO_LONG`（超过 `maxChars`）、`502 <模型错误码>`（含 `provider` / `model`）、`502 EMPTY_RESULT`（模型未返回内容）、`500 HOST_FAILED`。

### `GET /dsh-prompt-smith/settings`

返回 `{ ok, config, defaults, models }`：当前生效配置、默认值（`defaults.prompt` 为内置提示词全文）、模型目录（按供应商分组，60 秒缓存）。`models` 通过宿主 `ctx.llm.listProviders()` / `listModels()` 实时枚举**当前机器**的供应商与模型——每台电脑看到各自本机的供应商，插件不分发、不内置任何供应商名单。

### `POST /dsh-prompt-smith/settings`

请求 `{ "patch": { ... } }`，字段同配置项。成功返回 `{ ok, config }`；校验失败 `400 INVALID`（如 `temperature 必须是数字`）；持久化失败 `500 SAVE_FAILED`（内存值已回滚）。

### `GET /dsh-prompt-smith/efforts?provider=&model=`

返回 `{ ok, provider, model, advertised, efforts }`。`advertised` 为 `true` 时 `efforts` 是模型声明的档位，否则为常用档位回退列表。

### `POST /dsh-prompt-smith/test`

请求 `{ "provider": "", "model": "", "reasoningEffort": "auto" }`，发起一次最小调用（16 token、温度 0、无重试）。成功 `200 { ok, provider, model, effort }`；档位不被支持时 `422 EFFORT_UNSUPPORTED`。

## 常见问题

**装完看不到按钮？**
确认 `--profile` 写的是实际在跑的 profile；`dsh plugin --profile <p> why @cyberpzy/dsh-prompt-smith` 查安装状态；确认 profile `package.json` 的 `dsh.profile.bundles` 含本包名（带 `dsh.bundle.patch` 的包由宿主自动写入）；改完重启 `dsh web` 并 `Ctrl+R`。

**测试报「该模型不支持所选思考强度（xxx）」？**
该组合不被供应商接受。换档位或换模型；润色本身遇到同类拒绝会自动去掉强度字段重试一次。

**安装报 404 / 无权限？**
确认仓库名、tag 拼写无误（`github:CyberPzy/dsh-prompt-smith`，锁版加 `#v1.0.1`）；本仓库为公开仓库，无需凭据。

**点击增强会不会污染会话？**
不会。这是一次独立的一次性调用，不写入会话日志、不产生模型可见消息。

**成本多少？**
每次约 200–500 输出 token，按你所选供应商计费；`maxTokens` 可压低上限。

**会不会和其他插件冲突？**
只占用 `conversation.input.right` 与 `settings.section` 两个槽位，不注册工具、不拦截请求、不修改会话循环。

**卸载后有残留吗？**
`remove` 移除依赖条目、`node_modules` 包体与 bundle 注册；profile 补丁行中的用户配置会保留，重装后自动接回。彻底清除需手动删除 `cordis.patch.yml` 中 `id: prompt-smith` 的行。

**安装失败怎么回滚？**
`dsh plugin add` 失败时不落盘 `package.json`，无需回滚；中断留下半截 `node_modules` 时重新 `add` 覆盖，或先 `remove` 再装。旧版本回退用 `add ...#v<version>` 指定标签。

**宿主版本低于 `dshTarget`？**
加载时告警，按钮与设置页不注册。升级 Harness 到 `0.2.2-rc.3` 或更高。

## 许可证

MIT，Copyright (c) 2026 pzy。见 [LICENSE](./LICENSE)。

## 贡献指南

1. Fork 仓库，开功能分支。
2. 改动 `index.js` / `client.js` 后先做语法检查：`node --check index.js && node --check client.js`。
3. 同步更新 `CHANGELOG.md` 与 `package.json` 版本号，然后执行 `npm run pack:plugin` 验证打包（版本不一致会直接失败）。
4. 提 PR，说明改动点与验证方式。
