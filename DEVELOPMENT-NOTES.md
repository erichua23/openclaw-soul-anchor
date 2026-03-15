# Soul Anchor — 抗上下文稀释的硬性约束注入

## 核心问题

SOUL.md 中的约束随对话增长会被稀释（LLM attention 机制中，中间内容权重最低）。长对话后 agent 容易"忘记"边界约束，出现越界行为。

## 解决方案

通过 OpenClaw plugin 的 `before_prompt_build` hook，每轮对话都将硬性约束注入到**用户消息前面**（`prependContext`），利用 recency effect 保持最高注意力权重。

## 关键发现：Hook vs Plugin

**这是最重要的发现：managed hooks 和 plugins 的 `before_prompt_build` 走的是两条完全不同的路径。**

### Managed Hooks（`~/.openclaw/hooks/`）
```
handler.js → registerInternalHook(event, handler) → triggerInternalHook() → fire-and-forget
```
- 返回值被**忽略**
- 无法通过 `prependContext` 注入内容
- 适合：`message:preprocessed`、`command` 等事件型 hook

### Plugins（`~/.openclaw/extensions/`）
```
index.js → api.on(hookName, handler) → registerTypedHook() → registry.typedHooks → hookRunner.runBeforePromptBuild() → 返回值被收集和合并
```
- 返回值 `{ prependContext: "..." }` 会被合并到 system prompt
- 支持 `priority` 参数控制执行顺序
- 适合：`before_prompt_build`、`before_agent_start` 等需要修改 prompt 的 hook

### 源码证据

```javascript
// managed hooks (internal-hooks.ts line 4566)
for (const event of events) registerInternalHook(event, handler);

// plugins (registry.ts line 5313)
on: (hookName, handler, opts) => registerTypedHook(record, hookName, handler, opts, ...)

// hookRunner 只查 typedHooks (line 27854)
function getHooksForName(registry, hookName) {
  return registry.typedHooks.filter(h => h.hookName === hookName)...
}
```

## 文件结构

```
~/.openclaw/
├── extensions/
│   └── soul-anchor/
│       ├── openclaw.plugin.json    # 插件清单（必须有 configSchema）
│       └── index.js                # 插件代码
└── workspaces/
    ├── main/SOUL-ANCHOR.md         # StudioBot 的约束
    ├── mctech_hr/SOUL-ANCHOR.md    # 马伯乐的约束
    ├── mctech_pm_ops/SOUL-ANCHOR.md # 马全能的约束
    ├── mctech_dev_qian/SOUL-ANCHOR.md # 马前蹄的约束
    └── mctech_dev_hou/SOUL-ANCHOR.md  # 马后炮的约束
```

## Plugin 清单要求

**`openclaw.plugin.json` 必须包含 `configSchema`**，否则报错 `plugin manifest requires configSchema`：

```json
{
  "id": "soul-anchor",
  "name": "Soul Anchor",
  "description": "...",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

## Plugin 代码

```javascript
// index.js
export default {
  id: "soul-anchor",
  register(api) {
    const workspaceMap = loadAgentWorkspaceMap(); // 从 openclaw.json 读取

    api.on("before_prompt_build", (event, ctx) => {
      const agentId = ctx?.agentId;
      const workspaceDir = workspaceMap[agentId];
      if (!workspaceDir) return {};

      const anchor = loadAnchor(workspaceDir); // 读取 SOUL-ANCHOR.md
      if (!anchor) return {};

      return { prependContext: anchor };  // 注入到用户消息前面
    }, { priority: 999 });
  },
};
```

## 使用方式

1. 在 agent workspace 中创建 `SOUL-ANCHOR.md`
2. 写入硬性约束（格式自由，Markdown）
3. 重启 gateway
4. 每轮对话该约束都会被注入到用户消息前面，修改后立即生效

## 为什么用 prependContext 而非 appendSystemContext

LLM 的 attention 分布：
```
[system prompt=高→低] ... [对话历史=中间] ... [SOUL-ANCHOR=高] [user message=最高]
```

- `appendSystemContext`：追加到 system prompt 末尾，随对话增长离 user message 越来越远
- `prependContext`：注入到 user message 前面（`effectivePrompt = prependContext + prompt`），始终紧贴用户消息，recency effect 保证最高注意力

## 插件自动发现

Plugin 放在 `~/.openclaw/extensions/` 目录下会被 gateway 自动发现和加载。无需修改 `openclaw.json`（但会有 `plugins.allow is empty` 警告，不影响功能）。
