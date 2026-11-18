**English** | [中文](./README.md)

# dsh-prompt-smith

A DeepSeek Harness plugin: adds a one-click button to the composer tool row, left of the model seat, that forges the current draft into a clear, boundary-aware prompt you can send as-is.

- Package: `@cyberpzy/dsh-prompt-smith`
- Version: `1.0.1`
- Internal identity: `prompt-smith` (config row id, module name, locale namespace, slot ids)
- Repository: <https://github.com/CyberPzy/dsh-prompt-smith>

## Features

- One-click enhance: click ✨ to replace the draft in place, click ↺ to restore the original; each is a single Ctrl+Z.
- Requirement expansion, not wording polish: keeps every fact, command, placeholder and task boundary in the draft, and turns implicit defaults into explicit requirements.
- State and edge-case completion: interactive requests get a state machine (initial / in-progress / done / failed / empty), trigger points, boundary cases and acceptance criteria.
- Injection guard: the draft is wrapped in `<draft>` and declared to be material, not instructions.
- Model of your choice: pick provider, model and reasoning effort; otherwise auto-selects a route whose id contains `deepseek` and a model whose id contains `flash`.
- Persisted config: settings are written to the profile's `cordis.patch.yml` patch row and survive plugin reinstall and host restart.
- Zero npm dependencies, no build step: `index.js` (host half) and `client.js` (client half) are plain JS.

## Installation

Prerequisites:

| Item | Requirement |
|---|---|
| Host | DeepSeek Harness ≥ `0.2.2-rc.3` (manifest field `dshTarget`) |
| Profile | Has the `llm` service and at least one model provider adapter; profile with a web layer |
| CLI | `dsh` command (bundled with Harness; the GUI build ships it at `resources\runtime\cli\bin`) |
| Network | No special requirement; the repository is public and installs directly |

```bash
dsh plugin --profile desktop add github:CyberPzy/dsh-prompt-smith
```

- Replace `desktop` with the profile you actually run.
- Restart the app (or `dsh web`) after installing, then `Ctrl+R` in the browser.

Upgrade (re-running the same command pulls the latest default branch):

```bash
dsh plugin --profile desktop add github:CyberPzy/dsh-prompt-smith
```

> **Upgrading from an early preview build to 1.0.0**: the internal identity is now the short name `prompt-smith` (config row id, module name, locale namespace, slot ids), while the package name and HTTP routes keep the `dsh-` prefix. If that row in the profile's `cordis.patch.yml` still uses an older id (`prompt-enhancer`, `dsh-prompt-enhancer`, `dsh-prompt-smith`), change it to `- id: prompt-smith` (keep the indentation) before upgrading; the new version then re-attaches your saved model, reasoning effort and custom prompt. Skip it and the row is orphaned and a default row is created.

Pin a version:

```bash
dsh plugin --profile desktop add github:CyberPzy/dsh-prompt-smith#v1.0.1
```

Uninstall:

```bash
dsh plugin --profile desktop remove @cyberpzy/dsh-prompt-smith
```

Offline or restricted network, install from a local directory:

```bash
dsh plugin --profile desktop add link:C:\path\to\dsh-prompt-smith
```

## Quick Start

Minimal working example (no configuration needed):

1. Install the plugin, restart the app, press `Ctrl+R`.
2. Type a draft into the composer:

```text
登录很慢
```

3. Click the ✨ button in the composer tool row, left of the model seat.
4. The composer content is replaced with a structured prompt and the button becomes ↺; click ↺ to return to `登录很慢`.

Example output (actual output varies with the model and draft; not guaranteed verbatim):

```text
诊断并修复登录缓慢问题：定位耗时环节（前端请求、后端接口、鉴权、数据库），
给出瓶颈证据与修复方案；说明修复前后各状态（初始 / 进行中 / 成功 / 失败）的预期反馈，
覆盖空输入、重复提交、网络超时与失败恢复；给出验收标准。
```

## Configuration

Two sources, one state: the settings page (**Settings → 提示词增强**) and the profile's `cordis.patch.yml` patch row (`id: prompt-smith`). Both read and write the same values.

| Name | Type | Default | Purpose |
|---|---|---|---|
| `enabled` | boolean | `true` | When off, the composer button is hidden and the enhance route returns `502 DISABLED`. |
| `prompt` | string | `''` | System prompt. Empty uses the built-in default prompt; non-empty replaces it entirely. |
| `provider` | string | `''` | Provider id used for polishing. Empty auto-selects a route whose id contains `deepseek`, falling back to the first available provider. |
| `model` | string | `''` | Model id used for polishing. Empty auto-selects a model whose id contains `flash`, otherwise the provider's first model. |
| `reasoningEffort` | string | `'auto'` | Reasoning effort. `auto` takes the lowest level the model advertises; a concrete level id (e.g. `low`, `high`) is also accepted. |
| `temperature` | number | `0.3` | Sampling temperature, valid range `0`–`2`; out-of-range values are clamped. |
| `maxTokens` | number | `1200` | Output token cap, valid range `200`–`8192`, truncated to an integer. |
| `maxChars` | number | `6000` | Maximum draft length accepted for polishing, valid range `200`–`20000`, truncated to an integer; longer drafts are rejected with a split-into-parts hint. |

Patch file form:

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

## Usage Examples

### Button states

| State | Icon | Tooltip | Click behavior |
|---|---|---|---|
| Composer empty (including whitespace only) | Button hidden | — | — |
| Ready | ✨ | 增强提示词 | Polish and replace the draft in place; cache the original |
| Polishing | ◌ spinning (disabled) | 正在润色… | Not clickable |
| Enhanced | ↺ | 恢复原文 | Restore the cached original |
| Failed | ✨ red | Error message | Auto-resets after 4 seconds |

### Pick a model and test it

1. **Settings → 提示词增强** → under "润色模型" choose a provider and model (switching models never changes the stored effort).
2. Under "思考强度" pick a level; the dropdown lists levels the model advertises, otherwise `off` / `minimal` / `low` / `medium` / `high`.
3. Click "测试当前模型与思考强度": it spins while running, then shows a green check "成功" or a red cross "失败", returning to the normal state after about one second; the failure reason stays as a red line under the button until the next success.

### Custom prompt

Edit the "内置提示词" textarea and blur to save, or edit `prompt` in the patch row directly. Saving empty content falls back to the built-in default.

## API Reference

These are loopback, same-origin HTTP routes used only by the plugin's client half. All five require a request from a local page with the same origin and a body of at most 64 KiB; otherwise they answer `403 FORBIDDEN`.

### `POST /dsh-prompt-smith/enhance`

Request:

```json
{ "draft": "登录很慢" }
```

Success `200`:

```json
{
  "ok": true,
  "text": "<rewritten prompt>",
  "provider": "<provider auto-resolved on this machine>",
  "model": "<model auto-resolved on this machine>",
  "reasoningEffort": "off"
}
```

Failures: `400 EMPTY_DRAFT` (empty draft), `400 TOO_LONG` (exceeds `maxChars`), `502 <model error code>` (includes `provider` / `model`), `502 EMPTY_RESULT` (model returned nothing), `500 HOST_FAILED`.

### `GET /dsh-prompt-smith/settings`

Returns `{ ok, config, defaults, models }`: the effective config, the defaults (`defaults.prompt` is the full built-in prompt), and the model catalog grouped by provider (60-second cache). `models` is enumerated live from the host's `ctx.llm.listProviders()` / `listModels()` on **the current machine** — every machine sees its own local providers; the plugin ships no provider list of any kind.

### `POST /dsh-prompt-smith/settings`

Request `{ "patch": { ... } }`, with fields as listed in Configuration. Success returns `{ ok, config }`; validation failure returns `400 INVALID` (e.g. `temperature 必须是数字`); persistence failure returns `500 SAVE_FAILED` after rolling the in-memory values back.

### `GET /dsh-prompt-smith/efforts?provider=&model=`

Returns `{ ok, provider, model, advertised, efforts }`. When `advertised` is `true`, `efforts` holds the levels the model declares; otherwise it is the common fallback list.

### `POST /dsh-prompt-smith/test`

Request `{ "provider": "", "model": "", "reasoningEffort": "auto" }`, which makes one minimal call (16 tokens, temperature 0, no retry). Success returns `200 { ok, provider, model, effort }`; an unsupported effort returns `422 EFFORT_UNSUPPORTED`.

## FAQ

**The button does not appear after installing.**
Confirm `--profile` names the profile you actually run; check install state with `dsh plugin --profile <p> why @cyberpzy/dsh-prompt-smith`; confirm the profile `package.json` `dsh.profile.bundles` contains this package (the host writes it automatically for packages declaring `dsh.bundle.patch`); restart `dsh web` and press `Ctrl+R`.

**The test reports "该模型不支持所选思考强度（xxx）".**
The provider rejects that combination. Pick another level or model; polishing itself retries once without the effort field when it hits the same rejection.

**Install returns 404 / permission denied.**
Confirm the repository and tag spelling (`github:CyberPzy/dsh-prompt-smith`, pin with `#v1.0.1`); the repository is public and needs no credentials.

**Does enhancing pollute the session?**
No. It is an isolated one-shot call: nothing is written to the session log and no model-visible message is produced.

**What does it cost?**
About 200–500 output tokens per click, billed by your chosen provider; lower `maxTokens` to cap it.

**Does it conflict with other plugins?**
It occupies only the `conversation.input.right` and `settings.section` slots: no tools, no request interception, no changes to the session loop.

**Is anything left after uninstalling?**
`remove` deletes the dependency entry, the `node_modules` package and the bundle registration; user configuration in the profile patch row is kept and re-attaches on reinstall. For a full wipe, delete the `id: prompt-smith` row from `cordis.patch.yml` manually.

**How do I roll back a failed install?**
A failed `dsh plugin add` does not persist to `package.json`, so no rollback is needed; if an interruption leaves a partial `node_modules`, re-run `add` to overwrite or `remove` first and install again. To return to an older release, install with an explicit tag: `add ...#v<version>`.

**The host is below `dshTarget`.**
It warns at load time and registers neither the button nor the settings page. Upgrade Harness to `0.2.2-rc.3` or newer.

## License

MIT, Copyright (c) 2026 pzy. See [LICENSE](./LICENSE).

## Contributing

1. Fork the repository and create a feature branch.
2. After changing `index.js` / `client.js`, run the syntax check: `node --check index.js && node --check client.js`.
3. Update `CHANGELOG.md` and the `package.json` version together, then run `npm run pack:plugin` to verify packaging (a version mismatch fails immediately).
4. Open a PR describing the change and how you verified it.
