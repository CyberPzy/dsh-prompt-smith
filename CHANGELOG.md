# Changelog

## 1.0.1 — 2026-11-18

### Fixed

- 自动选路不再命中「没有任何模型」的供应商：此前自动挑「id 含 `deepseek` 的第一个」，若该供应商在当前机器上没有可用模型，首次点 ✨ 会报 `HOST_FAILED 供应商没有可用的模型`。现在按「deepseek 类优先、其余殿后」的顺序逐个尝试，`listModels` 为空或报错的供应商直接跳过，落到第一个真正有模型的供应商（模型仍优先取 id 含 `flash` 的）。
- 显式配置不受影响：设置页选过的 `provider` / `model` 原样使用，不会被动改写。

## 1.0.0 — 2026-11-18

首个稳定版本。

### Added

- 输入框工具行、模型选择器左侧的 ✨ 按钮，一键把草稿锻造成结构化提示词并直接回填；再点 ↺ 恢复原文，各是一次 Ctrl+Z。
- 需求扩写定位：保留草稿全部事实、命令、占位符与任务范围，补出状态机、触发方式、边界情况与验收标准，只输出正文。
- 防注入围栏：草稿包在 `<draft>` 中并声明其内容不是指令。
- 设置页（`settings.section`，位于「内置插件」同组）：功能开关、润色模型、思考强度、内置提示词、`temperature` / `maxTokens` / `maxChars`。
- 「测试当前模型与思考强度」：最小调用验证组合是否可用；成功绿勾、失败红叉约 1 秒后复位，失败原因常驻一条红色说明直到下次成功。
- 本机同源 HTTP 路由 `/dsh-prompt-smith/*`：`enhance`、`GET/POST settings`、`efforts`、`test`。
- 配置持久化：写入 profile 的 `cordis.patch.yml` 补丁行，跨插件重装与宿主重启保留。

### Notes

- 内部标识统一为短名 `prompt-smith`（配置行 id、模块名、locale 命名空间、槽位 id），包名与 HTTP 路由保留 `dsh-` 前缀，与社区插件惯例一致。
- 若 profile 的 `cordis.patch.yml` 中该行仍是旧 id（`prompt-enhancer`、`dsh-prompt-enhancer`、`dsh-prompt-smith`），升级前改成 `- id: prompt-smith`（缩进不变），已存配置才会被接回。
- 零 npm 依赖、无构建步骤；`index.js`（Host 半）与 `client.js`（Client 半）均为纯 JS。
