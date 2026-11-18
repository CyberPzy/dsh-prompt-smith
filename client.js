/**
 * Client half of the prompt-polish bundle.
 *
 * Two surfaces sharing one module-level enabled store:
 *  - the composer button (conversation.input.right, in front of the model
 *    seat) with its hide / polish / restore state machine;
 *  - a Settings page (settings.section 「提示词增强」) editing the feature
 *    switch, the model route, the reasoning effort, the built-in prompt, and
 *    the numeric options.
 *
 * Model and reasoning effort are two independent controls: switching the
 * model never touches the stored effort. The effort dropdown lists the
 * selected model's advertised levels (via the Host efforts endpoint) and
 * falls back to a common vocabulary when a model advertises none.
 *
 * Feedback rules (as specified):
 *  - the settings page has no top status bar; save outcomes apply silently
 *    (runtime + persisted config), failures roll back silently;
 *  - the test button carries its own inline state: spinner while running,
 *    green check「成功」on pass (lingers about a second, then back to
 *    idle), red cross「失败」on fail, with the failure reason on a
 *    persistent line below the button until the next pass.
 *
 * The composer button's standard `useInput` hook requires a selector:
 * `useInput(snapshot => snapshot)`.
 */

window.__ModuleLoader__.load({
  id: '@cyberpzy/dsh-prompt-smith',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const ENDPOINT = '/dsh-prompt-smith/enhance'
    const SETTINGS_PATH = '/dsh-prompt-smith/settings'
    const EFFORTS_PATH = '/dsh-prompt-smith/efforts'
    const TEST_PATH = '/dsh-prompt-smith/test'
    const NS = 'prompt-smith'
    const ERROR_RESET_MS = 4000
    const PROMPT_DEBOUNCE_MS = 800
    const NUMBER_DEBOUNCE_MS = 600
    const TEST_RESULT_RESET_MS = 1000

    const DICT = {
      zh: {
        nav: '提示词增强',
        enhance: '增强提示词',
        restore: '恢复原文',
        busy: '正在润色…',
        failed: '润色失败',
        offline: '当前窗口无法访问宿主服务',
        'page.title': '提示词增强',
        'page.desc': '润色输入框中的草稿；设置保存到当前 Harness 配置，对本机所有会话生效。',
        'switch.label': '启用提示词增强',
        'switch.hint': '关闭后输入框旁不再显示增强按钮。',
        'model.label': '润色所用模型',
        'model.auto': '自动（默认路由，优先 DeepSeek Flash）',
        'model.empty': '本机未配置可用模型，增强不可用',
        'effort.label': '思考强度',
        'effort.hint': '模型不支持所选档位时润色会自动不指定。',
        'effort.auto': '自动（取模型最低档）',
        'effort.common': '常用档位',
        'effort.current': '当前值，保留',
        'test.label': '测试当前模型与思考强度',
        'test.running': '测试中…',
        'test.passShort': '成功',
        'test.failShort': '失败',
        'prompt.label': '内置提示词',
        'prompt.hint': '展示当前生效的提示词；留空保存即回退插件默认，修改即时生效。',
        'prompt.defaultBadge': '默认内置提示词',
        'prompt.customBadge': '已自定义',
        'prompt.reset': '恢复默认',
        'prompt.emptyFallback': '内容为空，已回退为默认内置提示词',
        'nums.label': '其他参数',
        'nums.temperature': '随机性 temperature',
        'nums.maxTokens': '输出上限 maxTokens',
        'nums.maxChars': '草稿长度上限 maxChars',
        'nums.default': '默认',
        'actions.resetAll': '全部恢复默认',
        'actions.undo': '撤销更改',
        saved: '已保存',
        saveFailed: '保存失败，已回滚',
        undone: '已撤销未保存的更改',
        loading: '加载中…',
        loadFailed: '设置读取失败',
      },
      en: {
        nav: 'Prompt enhancer',
        enhance: 'Enhance prompt',
        restore: 'Restore original',
        busy: 'Polishing…',
        failed: 'Polish failed',
        offline: 'This window cannot reach the host service',
        'page.title': 'Prompt enhancer',
        'page.desc': 'Polishes the composer draft; settings persist in the current Harness profile for every session on this machine.',
        'switch.label': 'Enable prompt enhancement',
        'switch.hint': 'When off, the composer button is hidden.',
        'model.label': 'Polish model',
        'model.auto': 'Automatic (default route, prefers DeepSeek Flash)',
        'model.empty': 'No models configured on this machine; enhancement unavailable',
        'effort.label': 'Reasoning effort',
        'effort.hint': 'If the model rejects the chosen level, polishing retries without it.',
        'effort.auto': 'Automatic (lowest level of the model)',
        'effort.common': 'common levels',
        'effort.current': 'kept as-is',
        'test.label': 'Test current model and effort',
        'test.running': 'Testing…',
        'test.passShort': 'Passed',
        'test.failShort': 'Failed',
        'prompt.label': 'Built-in prompt',
        'prompt.hint': 'Shows the prompt in effect; saving an empty value restores the plugin default. Edits apply immediately.',
        'prompt.defaultBadge': 'Built-in default',
        'prompt.customBadge': 'Customized',
        'prompt.reset': 'Restore default',
        'prompt.emptyFallback': 'Content was empty; fell back to the built-in default prompt',
        'nums.label': 'Other options',
        'nums.temperature': 'Randomness temperature',
        'nums.maxTokens': 'Output cap maxTokens',
        'nums.maxChars': 'Draft length cap maxChars',
        'nums.default': 'Default',
        'actions.resetAll': 'Restore all defaults',
        'actions.undo': 'Undo changes',
        saved: 'Saved',
        saveFailed: 'Save failed, rolled back',
        undone: 'Unsaved changes reverted',
        loading: 'Loading…',
        loadFailed: 'Failed to load settings',
      },
    }

    let readLocale = () => 'zh'

    function makeText() {
      const locale = /^en/i.test(String(readLocale() || 'zh')) ? 'en' : 'zh'
      return key => {
        const table = DICT[locale] || DICT.zh
        return table[key] || DICT.zh[key] || key
      }
    }

    // ── enabled store: shared by the composer button and the settings page ──

    const enabledStore = {
      enabled: true,
      loaded: false,
      listeners: new Set(),
      set(value) {
        this.enabled = value === true
        this.loaded = true
        this.listeners.forEach(fn => {
          try { fn() } catch (error) { /* a failing listener must not sink the rest */ }
        })
      },
      subscribe(fn) {
        this.listeners.add(fn)
        return () => this.listeners.delete(fn)
      },
      get() {
        return this.enabled
      },
    }

    /** GET the settings document once, with a single retry (entry restarts). */
    async function fetchSettings() {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(SETTINGS_PATH, { credentials: 'same-origin' })
          const data = await response.json().catch(() => null)
          if (data && data.ok) return data
        } catch (error) {
          /* the route re-registers while the entry reloads after a save */
        }
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 400))
      }
      return null
    }

    async function refreshEnabled() {
      const doc = await fetchSettings()
      if (doc && doc.config) enabledStore.set(doc.config.enabled === true)
    }

    // ── composer button ────────────────────────────────────────────────────

    const CSS = `
.pe-btn{display:inline-flex;align-items:center;justify-content:center;height:24px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font-family:inherit;cursor:pointer;transition:background-color .12s ease,color .12s ease}
.pe-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.pe-btn:disabled{cursor:default}
.pe-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.pe-btn[data-phase="busy"]{color:var(--dsw-alias-label-secondary)}
.pe-btn[data-phase="error"]{color:var(--dsw-alias-state-error-primary)}
.pe-ico{display:block}
.pe-btn[data-phase="busy"] .pe-ico{animation:pe-spin .9s linear infinite}
@keyframes pe-spin{to{transform:rotate(360deg)}}
`

    function SparkleIcon() {
      return h(
        'svg',
        {
          className: 'pe-ico',
          viewBox: '0 0 16 16',
          width: 16,
          height: 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('path', { d: 'M8 2.2l1.5 3.2 3.2 1.5-3.2 1.5L8 11.6 6.5 8.4 3.3 6.9l3.2-1.5z' }),
        h('path', { d: 'M12.4 10.6l.7 1.4 1.4.7-1.4.7-.7 1.4-.7-1.4-1.4-.7 1.4-.7z' }),
      )
    }

    function SpinnerIcon() {
      return h(
        'svg',
        {
          className: 'pe-ico',
          viewBox: '0 0 16 16',
          width: 16,
          height: 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('circle', { cx: 8, cy: 8, r: 5.6, strokeDasharray: '27 8' }),
      )
    }

    function RestoreIcon() {
      return h(
        'svg',
        {
          className: 'pe-ico',
          viewBox: '0 0 16 16',
          width: 16,
          height: 16,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
        },
        h('polyline', { points: '2.6 3.2 2.6 7 6.4 7' }),
        h('path', { d: 'M3.4 6.1a5.4 5.4 0 1 1-0.5 3.4' }),
      )
    }

    /** Current draft text: snapshot store first, hook value as fallback. */
    function readDraft(input, actions) {
      const store = actions && actions.state
      try {
        if (store && typeof store.getSnapshot === 'function') {
          const snapshot = store.getSnapshot()
          if (snapshot && typeof snapshot.draft === 'string') return snapshot.draft
        }
        if (store && typeof store.get === 'function') {
          const snapshot = store.get()
          if (snapshot && typeof snapshot.draft === 'string') return snapshot.draft
        }
      } catch (error) {
        /* fall through to the hook value */
      }
      if (input && typeof input.draft === 'string') return input.draft
      return ''
    }

    function Enhancer(props) {
      const enabled = React.useSyncExternalStore(
        fn => enabledStore.subscribe(fn),
        () => enabledStore.enabled,
      )
      const input = typeof props.useInput === 'function' ? props.useInput(snapshot => snapshot) : undefined
      const actions = props.inputActions || {}
      const text = makeText()

      const draft = input && typeof input.draft === 'string' ? input.draft : ''
      const hasText = draft.trim().length > 0

      const [phase, setPhase] = React.useState('idle')
      const [original, setOriginal] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const ticket = React.useRef(0)

      React.useEffect(() => {
        if (!hasText && phase !== 'busy') {
          setPhase('idle')
          setOriginal('')
          setNotice('')
        }
      }, [hasText, phase])

      React.useEffect(() => {
        if (phase !== 'error') return undefined
        const timer = setTimeout(() => {
          setPhase('idle')
          setNotice('')
        }, ERROR_RESET_MS)
        return () => clearTimeout(timer)
      }, [phase])

      const run = React.useCallback(async () => {
        const current = readDraft(input, actions)
        if (!current.trim()) return
        const mine = ++ticket.current
        setPhase('busy')
        setNotice('')

        try {
          const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ draft: current }),
          })
          const data = await response.json().catch(() => null)
          if (mine !== ticket.current) return

          if (!data || !data.ok) {
            const error = (data && data.error) || {}
            setNotice(String(error.message || text('failed')))
            setPhase('error')
            return
          }

          const polished = String(data.text || '')
          if (!polished) {
            setNotice(text('failed'))
            setPhase('error')
            return
          }

          setOriginal(current)
          if (typeof actions.setDraft === 'function') {
            actions.setDraft(polished)
          }
          setPhase('enhanced')
        } catch (error) {
          if (mine !== ticket.current) return
          setNotice(text('offline'))
          setPhase('error')
        }
      }, [input, actions, text])

      const restore = React.useCallback(() => {
        ticket.current += 1
        if (original && typeof actions.setDraft === 'function') {
          actions.setDraft(original)
        }
        setOriginal('')
        setNotice('')
        setPhase('idle')
      }, [original, actions])

      if (!enabled || !hasText) return null

      const phaseIcon = phase === 'busy'
        ? h(SpinnerIcon, {})
        : phase === 'enhanced'
          ? h(RestoreIcon, {})
          : h(SparkleIcon, {})

      const title = phase === 'busy'
        ? text('busy')
        : phase === 'enhanced'
          ? text('restore')
          : phase === 'error'
            ? notice || text('failed')
            : text('enhance')

      const onPrimary = phase === 'enhanced' ? restore : run

      return h(
        'button',
        {
          type: 'button',
          className: 'pe-btn',
          'data-phase': phase,
          title,
          'aria-label': title,
          'aria-live': phase === 'error' ? 'assertive' : undefined,
          disabled: phase === 'busy',
          onClick: onPrimary,
        },
        phaseIcon,
      )
    }

    // ── settings page ──────────────────────────────────────────────────────

    // Layout follows the Built-in plugins page conventions: token-only colors,
    // 12px card radius, 16px card padding, 16px block gap, 13px/600 card
    // titles, 12px secondary descriptions, 32px controls.
    const SETTINGS_CSS = `
.pes-page{display:flex;flex-direction:column;gap:16px;max-width:720px;padding:4px 2px 32px;font-family:inherit;color:var(--dsw-alias-label-primary)}
.pes-head{display:flex;flex-direction:column;gap:6px}
.pes-title{font-size:16px;font-weight:600}
.pes-desc{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6}
.pes-card{display:flex;flex-direction:column;gap:14px;padding:16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-1)}
.pes-row{display:flex;align-items:center;gap:10px;min-height:32px}
.pes-rowHead{display:flex;align-items:center;justify-content:space-between;gap:10px}
.pes-name{font-size:13px;font-weight:600}
.pes-current{font-size:11px;color:var(--dsw-alias-label-secondary)}
.pes-hint{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.6}
.pes-badge{font-size:11px;color:var(--dsw-alias-brand-primary);white-space:nowrap}
.pes-field{display:flex;flex-direction:column;gap:6px}
.pes-divider{height:1px;background:var(--dsw-alias-border-l1);margin:2px 0}
.pes-textarea{width:100%;min-height:180px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:1.6;resize:vertical}
.pes-textarea:focus{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-1px}
.pes-select,.pes-num{height:32px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px}
.pes-select:focus-visible,.pes-num:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.pes-select:disabled,.pes-num:disabled{opacity:.55;cursor:default}
.pes-num{width:120px}
.pes-act{height:28px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.pes-act:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.pes-act:disabled{opacity:.5;cursor:default}
.pes-act:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.pes-act[data-state="pass"]{color:var(--dsw-alias-state-success-primary)}
.pes-act[data-state="fail"]{color:var(--dsw-alias-state-error-primary)}
.pes-act .pes-spin{display:block;animation:pe-spin .9s linear infinite}
.pes-testError{display:flex;align-items:flex-start;gap:6px;font-size:12px;color:var(--dsw-alias-state-error-primary);line-height:1.5;word-break:break-word}
.pes-switch{position:relative;width:36px;height:20px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);cursor:pointer;padding:0;transition:background-color .15s ease}
.pes-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.pes-switch[data-on="true"]{background:var(--dsw-alias-brand-primary);border-color:transparent}
.pes-switch[data-on="true"]::after{transform:translateX(16px)}
.pes-switch::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s ease}
.pes-switch:disabled{opacity:.5;cursor:default}
`

    /** Small inline glyphs for the test button's result states. */
    function TestSpinner() {
      return h('svg', {
        className: 'pes-spin', viewBox: '0 0 16 16', width: 12, height: 12,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round',
        'aria-hidden': true, focusable: false,
      }, h('circle', { cx: 8, cy: 8, r: 5.6, strokeDasharray: '25 10' }))
    }

    function TestCheck() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 12, height: 12,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
        strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, focusable: false,
      }, h('polyline', { points: '3 8.5 6.5 12 13 4.5' }))
    }

    function TestCross() {
      return h('svg', {
        viewBox: '0 0 16 16', width: 12, height: 12,
        fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
        strokeLinecap: 'round',
        'aria-hidden': true, focusable: false,
      }, h('path', { d: 'M4 4l8 8M12 4l-8 8' }))
    }

    /** Number row: label, debounced input, single-item default reset. */
    function NumberRow({ label, value, min, max, step, disabled, onChange, onReset, defaultHit }) {
      const [text, setText] = React.useState(() => String(value))
      const timer = React.useRef(null)

      React.useEffect(() => {
        setText(String(value))
      }, [value])

      React.useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current)
      }, [])

      const commit = raw => {
        const num = Number(raw)
        if (Number.isFinite(num)) onChange(num)
      }

      const handleChange = raw => {
        setText(raw)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => commit(raw), NUMBER_DEBOUNCE_MS)
      }

      return h('div', { className: 'pes-row', style: { justifyContent: 'space-between' } },
        h('div', { className: 'pes-name' }, label),
        h('div', { className: 'pes-row' },
          h('input', {
            className: 'pes-num',
            type: 'number',
            min,
            max,
            step: step || 1,
            value: text,
            disabled,
            onChange: event => handleChange(event.target.value),
            onBlur: () => {
              if (timer.current) clearTimeout(timer.current)
              commit(text)
            },
            'aria-label': label,
          }),
          h('button', {
            type: 'button',
            className: 'pes-act',
            disabled: disabled || defaultHit,
            onClick: onReset,
          }, makeText()('nums.default'))),
      )
    }

    const effortsCache = new Map()

    /** Advertised efforts for one provider/model pair (or the common list). */
    async function fetchEfforts(provider, model) {
      const key = `${provider || ''}|${model || ''}`
      if (effortsCache.has(key)) return effortsCache.get(key)
      try {
        const query = new URLSearchParams({ provider: provider || '', model: model || '' })
        const response = await fetch(`${EFFORTS_PATH}?${query}`, { credentials: 'same-origin' })
        const data = await response.json().catch(() => null)
        if (data && data.ok) {
          effortsCache.set(key, data)
          return data
        }
      } catch (error) {
        /* fall through to the common list below */
      }
      return null
    }

    function SettingsView({ t }) {
      const [doc, setDoc] = React.useState(null)
      const [saving, setSaving] = React.useState(false)
      const [testState, setTestState] = React.useState('idle')
      const [testError, setTestError] = React.useState('')
      const [efforts, setEfforts] = React.useState(null)
      const [effortsAdvertised, setEffortsAdvertised] = React.useState(true)
      const [promptDraft, setPromptDraft] = React.useState('')
      const committedRef = React.useRef(null)
      const defaultsRef = React.useRef(null)
      const queueRef = React.useRef(Promise.resolve())
      const promptTimer = React.useRef(null)
      const testTimer = React.useRef(null)
      const lastPromptSent = React.useRef(null)

      const applyDocument = React.useCallback(document => {
        committedRef.current = document.config
        defaultsRef.current = document.defaults || null
        lastPromptSent.current = String(document.config.prompt || '')
        setDoc(document)
        setPromptDraft(document.config.prompt || document.defaults.prompt || '')
        enabledStore.set(document.config.enabled === true)
      }, [])

      React.useEffect(() => {
        let alive = true
        fetchSettings().then(document => {
          if (!alive) return
          if (document) applyDocument(document)
        })
        return () => { alive = false }
      }, [applyDocument, t])

      React.useEffect(() => () => {
        if (promptTimer.current) clearTimeout(promptTimer.current)
        if (testTimer.current) clearTimeout(testTimer.current)
      }, [])

      const config = doc ? doc.config : null
      const models = (doc && doc.models) || []
      const hasModels = models.some(group => group.models && group.models.length > 0)
      const modelKey = config ? `${config.provider || ''}|${config.model || ''}` : ''

      // Effort options follow the selected model; switching the model never
      // rewrites the stored effort value.
      React.useEffect(() => {
        if (!config) return undefined
        let alive = true
        fetchEfforts(config.provider, config.model).then(data => {
          if (!alive) return
          if (data) {
            setEfforts(data.efforts || [])
            setEffortsAdvertised(data.advertised === true)
          } else {
            setEfforts(null)
            setEffortsAdvertised(false)
          }
        })
        return () => { alive = false }
      }, [modelKey])

      const save = React.useCallback(patch => {
        const step = queueRef.current.then(async () => {
          setSaving(true)
          const before = committedRef.current
          try {
            const response = await fetch(SETTINGS_PATH, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ patch }),
            })
            const data = await response.json().catch(() => null)

            if (data && data.ok) {
              const next = { ...(before || {}), ...data.config }
              committedRef.current = next
              setDoc(prev => ({ ...(prev || { defaults: defaultsRef.current || {} }), config: next }))
              enabledStore.set(next.enabled === true)
              return
            }

            const error = (data && data.error) || {}
            if (before) {
              committedRef.current = before
              setDoc(prev => ({ ...(prev || { defaults: defaultsRef.current || {} }), config: before }))
              setPromptDraft(
                before.prompt
                || (defaultsRef.current && defaultsRef.current.prompt)
                || '',
              )
              enabledStore.set(before.enabled === true)
            }
          } catch (rollback) {
            if (before) {
              committedRef.current = before
              setDoc(prev => ({ ...(prev || { defaults: defaultsRef.current || {} }), config: before }))
              setPromptDraft(
                before.prompt
                || (defaultsRef.current && defaultsRef.current.prompt)
                || '',
              )
              enabledStore.set(before.enabled === true)
            }
          } finally {
            setSaving(false)
          }
        })
        queueRef.current = step
        return step
      }, [t])

      const promptIsDefault = !config || !String(config.prompt || '').trim()

      const sendPrompt = React.useCallback(value => {
        const normalized = String(value)
        if (normalized === lastPromptSent.current) return
        lastPromptSent.current = normalized
        save({ prompt: normalized })
      }, [save])

      const onPromptChange = React.useCallback(value => {
        setPromptDraft(value)
        if (promptTimer.current) clearTimeout(promptTimer.current)
        promptTimer.current = setTimeout(() => sendPrompt(value), PROMPT_DEBOUNCE_MS)
      }, [sendPrompt])

      const onPromptBlur = React.useCallback(() => {
        if (promptTimer.current) clearTimeout(promptTimer.current)
        sendPrompt(promptDraft)
      }, [promptDraft, sendPrompt])

      /**
       * Inline test: the top status bar stays untouched while a test runs.
       * The button carries spinner / green-check / red-cross states; the
       * failure reason persists below the button until the next pass.
       */
      const runTest = React.useCallback(async () => {
        if (!config || testState === 'running') return
        if (testTimer.current) clearTimeout(testTimer.current)
        setTestState('running')
        try {
          const response = await fetch(TEST_PATH, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              provider: config.provider,
              model: config.model,
              reasoningEffort: config.reasoningEffort,
            }),
          })
          const data = await response.json().catch(() => null)
          if (data && data.ok) {
            setTestState('pass')
            setTestError('')
          } else {
            const error = (data && data.error) || {}
            setTestState('fail')
            // The failure reason line below the button persists until the
            // next pass; only the button glyph auto-clears.
            setTestError(String(error.message || t('test.failShort')))
          }
          // Both button states linger about a second, then return to idle.
          testTimer.current = setTimeout(() => setTestState('idle'), TEST_RESULT_RESET_MS)
        } catch (error) {
          setTestState('fail')
          setTestError(t('offline'))
          testTimer.current = setTimeout(() => setTestState('idle'), TEST_RESULT_RESET_MS)
        }
      }, [config, testState, t])

      const undo = React.useCallback(() => {
        fetchSettings().then(document => {
          if (document) applyDocument(document)
        })
      }, [applyDocument])

      const resetAll = React.useCallback(() => {
        const defaults = (doc && doc.defaults) || {}
        setPromptDraft(defaults.prompt || '')
        save({
          enabled: true,
          prompt: '',
          provider: '',
          model: '',
          reasoningEffort: 'auto',
          temperature: defaults.temperature,
          maxTokens: defaults.maxTokens,
          maxChars: defaults.maxChars,
        })
      }, [doc, save])

      const switchDisabled = !config || saving || !hasModels
      const effortList = Array.isArray(efforts) ? efforts : []
      const effortValue = config ? String(config.reasoningEffort || 'auto') : 'auto'
      const effortKnown = effortValue === 'auto' || effortList.some(entry => entry.id === effortValue)

      const testGlyph = testState === 'running'
        ? h(TestSpinner, {})
        : testState === 'pass'
          ? h(TestCheck, {})
          : testState === 'fail'
            ? h(TestCross, {})
            : null
      const testLabel = testState === 'running'
        ? t('test.running')
        : testState === 'pass'
          ? t('test.passShort')
          : testState === 'fail'
            ? t('test.failShort')
            : t('test.label')

      return h('div', { className: 'pes-page' },
        h('style', null, SETTINGS_CSS),
        h('div', { className: 'pes-head' },
          h('div', { className: 'pes-title' }, t('page.title'))),

        // ① 功能开关
        h('div', { className: 'pes-card' },
          h('div', { className: 'pes-row', style: { justifyContent: 'space-between' } },
            h('div', null,
              h('div', { className: 'pes-name' }, t('switch.label')),
              doc && !hasModels ? h('div', { className: 'pes-hint' }, t('model.empty')) : null),
            h('button', {
              type: 'button',
              className: 'pes-switch',
              'data-on': config ? config.enabled === true : false,
              role: 'switch',
              'aria-checked': config ? config.enabled === true : false,
              'aria-label': t('switch.label'),
              disabled: switchDisabled,
              onClick: () => save({ enabled: !(config && config.enabled === true) }),
            }))),

        // ② 模型 + 思考强度（两个独立控件，测试结果内联在按钮上）
        h('div', { className: 'pes-card' },
          h('div', { className: 'pes-field' },
            h('div', { className: 'pes-rowHead' },
              h('div', { className: 'pes-name' }, t('model.label')),
              config ? h('div', { className: 'pes-current' },
                config.provider
                  ? `${config.provider} / ${config.model}`
                  : 'auto') : null),
            h('select', {
              className: 'pes-select',
              style: { width: '100%' },
              value: config && config.provider ? `${config.provider}|${config.model}` : 'auto',
              disabled: !config || saving || !hasModels,
              onChange: event => {
                const value = event.target.value
                if (value === 'auto') {
                  save({ provider: '', model: '' })
                  return
                }
                const sep = value.indexOf('|')
                save({ provider: value.slice(0, sep), model: value.slice(sep + 1) })
              },
              'aria-label': t('model.label'),
            },

              h('option', { value: 'auto' }, t('model.auto')),
              !hasModels && doc
                ? h('option', { value: 'empty', disabled: true }, t('model.empty'))
                : models
                  .filter(group => group.models && group.models.length > 0)
                  .map(group => h('optgroup', { key: group.provider, label: group.name },
                    group.models.map(model => h('option', {
                      key: `${group.provider}|${model.id}`,
                      value: `${group.provider}|${model.id}`,
                    }, model.name || model.id)))))),

          h('div', { className: 'pes-divider' }),

          h('div', { className: 'pes-field' },
            h('div', { className: 'pes-rowHead' },
              h('div', { className: 'pes-name' }, t('effort.label')),
              config ? h('div', { className: 'pes-current' },
                `${effortValue}${effortsAdvertised ? '' : ` · ${t('effort.common')}`.trim()}`) : null),
            h('div', { className: 'pes-row' },
              h('select', {
                className: 'pes-select',
                style: { flex: 1 },
                value: effortValue,
                disabled: !config || saving,
                onChange: event => save({ reasoningEffort: event.target.value }),
                'aria-label': t('effort.label'),
              },
                h('option', { value: 'auto' }, t('effort.auto')),
                effortList.map(entry => h('option', {
                  key: entry.id,
                  value: entry.id,
                }, entry.name || entry.id)),
                !effortKnown && effortValue
                  ? h('option', { value: effortValue }, `${effortValue}（${t('effort.current')}）`)
                  : null),
              h('button', {
                type: 'button',
                className: 'pes-act',
                'data-state': testState === 'pass' || testState === 'fail' ? testState : undefined,
                disabled: !config || saving || testState === 'running',
                onClick: runTest,
                'aria-label': t('test.label'),
              },
                testGlyph,
                h('span', null, testLabel))),
            testError
              ? h('div', { className: 'pes-testError', role: 'alert' },
                h(TestCross, {}),
                h('span', null, testError))
              : null)),

        // ③ 内置提示词
        h('div', { className: 'pes-card' },
          h('div', { className: 'pes-rowHead' },
            h('div', { className: 'pes-name' }, t('prompt.label')),
            h('span', { className: 'pes-badge' },
              promptIsDefault ? t('prompt.defaultBadge') : t('prompt.customBadge'))),
          h('div', { className: 'pes-hint' }, t('prompt.hint')),
          h('textarea', {
            className: 'pes-textarea',
            value: promptDraft,
            disabled: !config,
            spellCheck: false,
            onChange: event => onPromptChange(event.target.value),
            onBlur: onPromptBlur,
            'aria-label': t('prompt.label'),
          }),
          h('div', { className: 'pes-row', style: { justifyContent: 'flex-end' } },
            h('button', {
              type: 'button',
              className: 'pes-act',
              disabled: !config || saving || promptIsDefault,
              onClick: () => {
                setPromptDraft((doc && doc.defaults && doc.defaults.prompt) || '')
                sendPrompt('')
              },
            }, t('prompt.reset')))),

        // ④ 其他参数
        h('div', { className: 'pes-card' },
          h('div', { className: 'pes-name' }, t('nums.label')),
          config ? h(React.Fragment, null,
            h(NumberRow, {
              label: t('nums.temperature'),
              value: config.temperature,
              min: 0,
              max: 2,
              step: 0.1,
              disabled: saving,
              defaultHit: config.temperature === (doc && doc.defaults && doc.defaults.temperature),
              onChange: num => save({ temperature: num }),
              onReset: () => save({ temperature: doc && doc.defaults ? doc.defaults.temperature : 0.3 }),
            }),
            h(NumberRow, {
              label: t('nums.maxTokens'),
              value: config.maxTokens,
              min: 200,
              max: 8192,
              step: 100,
              disabled: saving,
              defaultHit: config.maxTokens === (doc && doc.defaults && doc.defaults.maxTokens),
              onChange: num => save({ maxTokens: num }),
              onReset: () => save({ maxTokens: doc && doc.defaults ? doc.defaults.maxTokens : 1200 }),
            }),
            h(NumberRow, {
              label: t('nums.maxChars'),
              value: config.maxChars,
              min: 200,
              max: 20000,
              step: 100,
              disabled: saving,
              defaultHit: config.maxChars === (doc && doc.defaults && doc.defaults.maxChars),
              onChange: num => save({ maxChars: num }),
              onReset: () => save({ maxChars: doc && doc.defaults ? doc.defaults.maxChars : 6000 }),
            })) : null),

        h('div', { className: 'pes-row', style: { justifyContent: 'flex-end', gap: 8 } },
          h('button', {
            type: 'button',
            className: 'pes-act',
            disabled: !config || saving,
            onClick: undo,
          }, t('actions.undo')),
          h('button', {
            type: 'button',
            className: 'pes-act',
            disabled: !config || saving,
            onClick: resetAll,
          }, t('actions.resetAll'))))
    }

    return {
      name: NS,
      inject: ['slots', 'locale'],
      apply(ctx) {
        // Component-independent styles: the button unmounts while the draft is
        // empty, so the stylesheet cannot live inside its render output.
        try {
          if (typeof document !== 'undefined' && document.head) {
            const style = document.createElement('style')
            style.textContent = CSS
            document.head.appendChild(style)
            ctx.effect(() => () => style.remove())
          }
        } catch (error) {
          /* without a head nothing depends on the stylesheet being present */
        }

        let boundT = null
        try {
          if (ctx.locale && typeof ctx.locale.register === 'function') {
            ctx.effect(() => ctx.locale.register(NS, DICT))
          }
          readLocale = () => {
            try {
              const snapshot = ctx.locale.getLocale()
              return String(
                (snapshot && (snapshot.active || snapshot.id || snapshot.locale || snapshot.language)) || 'zh',
              )
            } catch (error) {
              return 'zh'
            }
          }
          if (ctx.locale && typeof ctx.locale.bind === 'function') {
            boundT = ctx.locale.bind(NS)
          }
        } catch (error) {
          readLocale = () => 'zh'
        }

        // Seed the shared enabled flag once per page load.
        refreshEnabled()

        ctx.slots.inject('conversation.input.right', () => {
          return ctx.slots.register(
            {
              name: 'conversation.input.right',
              id: 'prompt-smith',
              order: 0,
              locale: NS,
            },
            Enhancer,
          )
        })

        // Settings → 提示词增强 (same pattern dsh-notify-me uses).
        try {
          ctx.slots.inject('settings.section', () => ctx.slots.register(
            {
              name: 'settings.section',
              id: 'prompt-smith',
              order: 46,
              label: () => (boundT ? boundT('nav') : makeText()('nav')),
              locale: NS,
              inject: boundT ? () => ({ t: boundT }) : undefined,
            },
            () => h(SettingsView, { t: boundT || makeText() }),
          ))
        } catch (error) {
          /* hosts without the settings shell simply get no page */
        }
      },
    }
  },
})
