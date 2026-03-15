# OpenClaw Soul Anchor

一个 OpenClaw 插件——每轮对话将硬性约束注入 system prompt 末尾，对抗长对话中的上下文稀释。

## 问题背景

在长对话场景中，LLM 的 attention 呈典型的 U 型分布（Needle-in-Haystack）：
- 句子开头和结尾注意力最高
- 中间部分注意力最低（信息遗忘率最高）

传统做法是在 system prompt 的开头写入约束和身份定义。但在 50+ 轮对话后，这些初始约束被推向注意力低谷，Agent 逐渐遗忘约束条件，导致：
- 越权操作（越过身份边界）
- 忽视安全规则
- 不遵循工作流程

Soul Anchor 通过每轮对话动态注入约束到 system prompt 的末尾，利用 **recency effect**（近期效应），确保 Agent 在长对话中始终保持约束意识。

## 核心原理

OpenClaw 提供的 `before_prompt_build` hook 允许在构建 prompt 之前修改 system context。Soul Anchor 在这个阶段：

1. 根据 Agent ID 找到其 workspace 目录
2. 从 `SOUL-ANCHOR.md` 读取约束文本
3. 通过 `appendSystemContext` 注入到 system prompt 末尾
4. 利用 LLM 的 recency bias，确保约束在每轮对话中都被强调

## 关键发现：Plugin vs Managed Hook

OpenClaw 中 `before_prompt_build` 有两种注册方式，但走完全不同的代码路径：

### Managed Hook（`~/.openclaw/hooks/`）
```
registerInternalHook() → triggerInternalHook() → FIRE-AND-FORGET（void 返回）
```
- Hook 的返回值被忽略
- `appendSystemContext` 无法生效

### Plugin（`~/.openclaw/extensions/`）
```
api.on() → registerTypedHook() → registry.typedHooks → hookRunner.runBeforePromptBuild()（收集返回值）
```
- Plugin 的返回值被收集并合并到 system prompt
- `appendSystemContext` 正常工作
- 支持 `priority` 参数控制注入顺序

**源码证据：** 这是通过阅读 OpenClaw 源代码发现的。Managed hooks 走内部事件路径（`triggerInternalHook` 声明为 `void`），Plugin 走类型化 hook 路径（`hookRunner.runBeforePromptBuild` 收集和合并所有返回值）。

因此，Soul Anchor **必须实现为 Plugin，不能是 Hook**。

## 安装

### 前置条件
- OpenClaw 2026.3.x 或更高版本
- Node.js 18+ 环境

### 步骤

1. **克隆或复制到 extensions 目录**
   ```bash
   cp -r openclaw-soul-anchor ~/.openclaw/extensions/soul-anchor
   ```

2. **在每个 Agent 的 workspace 创建约束文件**

   对于每个需要约束的 Agent，在其 workspace 目录创建 `SOUL-ANCHOR.md`：
   ```bash
   mkdir -p ~/.openclaw/workspaces/your_agent_id
   cp examples/SOUL-ANCHOR.example.md ~/.openclaw/workspaces/your_agent_id/SOUL-ANCHOR.md
   ```

3. **编辑约束内容**

   根据该 Agent 的身份和职责，定制约束内容。参考下面的"编写约束"章节。

4. **重启 gateway**
   ```bash
   openclaw gateway restart
   ```

5. **验证**

   观察 Agent 在长对话中的行为，确认约束被遵循。检查 gateway 日志查看 Soul Anchor 的加载情况。

## 使用方式

### 约束文件位置

Soul Anchor 会自动在以下位置查找约束文件（默认文件名为 `SOUL-ANCHOR.md`）：

```
~/.openclaw/workspaces/{agentId}/SOUL-ANCHOR.md
```

### 约束生效时间

- 修改 `SOUL-ANCHOR.md` → 约 60 秒后自动生效（Plugin 有可配置的缓存 TTL）
- 不需要重启 gateway
- 约束立即应用于新的对话轮次

### 编写约束

约束文件使用 Markdown 格式，典型结构如下：

#### 1. 身份边界（顶部）
```markdown
## 身份与职责

你是 [Agent 名称]，职责：[描述]

### 禁止的操作
- 不得修改 openclaw.json 配置文件
- 不得写入 `skills/` 目录
- 不得越过身份边界进行 [具体操作]
```

#### 2. 工作流约束（中部）
```markdown
## 工作流

在执行以下操作时必须遵循流程：
- 技能开发：[流程描述]
- 长任务：[流程描述]
```

#### 3. 协议约束（底部）
```markdown
## 最终确认

重申：禁止修改配置文件、禁止越权操作。若违反，后果由你承担。
```

参考 `examples/SOUL-ANCHOR.example.md` 获取完整示例。

## 最佳实践

### 关键约束需要首尾呼应

如果约束在文件中只出现一次，即使在末尾，长对话中仍有被遗忘的可能性。建议：

- **顶部（身份边界）**：明确身份和明显的禁令
  ```markdown
  ## 身份边界

  你是 Agent X。**禁止修改 skills/ 目录。**
  ```

- **底部（详细规则）**：详述具体约束及后果
  ```markdown
  ## 技能管理约束

  任何创建、修改、删除技能的请求都必须：
  1. 检查 `~/.openclaw/shared/skill-requests.md`
  2. 提交申请，填写需求描述
  3. 等待管理员审批后才能开发

  **重申：禁止直接写入 skills/ 目录。违反此约束后果自负。**
  ```

这样即使中间部分被 LLM 部分遗忘，顶部的明确身份和底部的强调也能确保约束不被完全忽视。

### 约束的粒度

- **太粗糙**：容易被泛化忽视
  ```markdown
  # 不要做危险的事
  ```

- **适中**：明确、具体、可验证
  ```markdown
  # 禁止修改 openclaw.json

  openclaw.json 文件受 `chflags uchg` 保护。你没有权限修改它。
  如果任务要求修改 openclaw.json，请拒绝并说明原因。
  ```

### 约束的量级

- 单个 SOUL-ANCHOR.md 保持在 500-1000 字范围内
- 核心约束 3-5 条
- 过多约束会降低效果（LLM 难以全部遵循）

## 配置

Soul Anchor 支持通过 `openclaw.json` 配置：

```json
{
  "plugins": {
    "soul-anchor": {
      "enabled": true,
      "config": {
        "anchorFilename": "SOUL-ANCHOR.md",
        "cacheTtlMs": 60000
      }
    }
  }
}
```

### 配置项

| 配置项 | 默认值 | 说明 |
|-------|-------|------|
| `anchorFilename` | `SOUL-ANCHOR.md` | 约束文件的名称，存放于各 Agent 的 workspace 目录 |
| `cacheTtlMs` | `60000` | 约束文件内容的缓存时间（毫秒），避免频繁读取磁盘 |

## 原理与代码

### 工作流程

```
对话轮次 N
  ↓
OpenClaw 构建 prompt 前触发 before_prompt_build 事件
  ↓
Soul Anchor 拦截事件
  ↓
根据 agentId 查询 workspace 目录
  ↓
从 SOUL-ANCHOR.md 读取约束（有缓存）
  ↓
返回 { appendSystemContext: content }
  ↓
OpenClaw 将约束文本追加到 system prompt 末尾
  ↓
LLM 在末尾看到约束，recency effect 提高关注度
  ↓
对话继续，约束被遵循
```

### 为什么 Plugin 而不是 Hook

详见上面的"关键发现"部分。简短总结：

- Managed Hook 的返回值被 OpenClaw 的内部事件系统忽略（fire-and-forget）
- 只有 Plugin 通过 `api.on()` 注册的 hook 才能返回 `appendSystemContext` 并被合并
- 这是 OpenClaw 架构的结果，源码级别确认

## 兼容性

- **OpenClaw 版本**：2026.3.x 及以上
- **Node.js 版本**：18 LTS 或更高
- **操作系统**：macOS、Linux、Windows（仅限支持 `homedir()` 的系统）

已在以下环境测试：
- OpenClaw 2026.3.12
- Node.js 20.x

## 故障排查

### 约束未生效

1. **检查文件位置**
   ```bash
   ls -la ~/.openclaw/workspaces/{agentId}/SOUL-ANCHOR.md
   ```

2. **检查文件权限**
   ```bash
   chmod 644 ~/.openclaw/workspaces/{agentId}/SOUL-ANCHOR.md
   ```

3. **检查 openclaw.json 中的 agents 配置**
   ```bash
   cat ~/.openclaw/openclaw.json | jq '.agents'
   ```
   确保 Agent 的 `workspace` 路径正确。

4. **检查缓存**
   - 修改文件后等待 60+ 秒（默认缓存 TTL）
   - 或调整 `cacheTtlMs` 为更小的值进行测试

5. **查看 gateway 日志**
   ```bash
   tail -100f ~/.openclaw/logs/gateway.log | grep -i soul-anchor
   ```

### 约束文件读取失败

Soul Anchor 静默处理读取错误（为了避免影响对话）。检查以下项：

- 文件编码：确保使用 UTF-8
- 文件权限：确保 gateway 进程有读权限
- 文件大小：避免超过 1MB（实际不会，但理论上）

## 许可证

MIT License — 详见 LICENSE 文件。

## 致谢

Soul Anchor 的设计灵感来自对 LLM attention 机制的研究（Needle-in-Haystack），以及在 OpenClaw 多 Agent 系统中实际遇到的上下文稀释问题。

感谢 OpenClaw 社区对 hook 和 plugin 系统的支持。

## 更新日志

### v1.0.0（2026-03-15）

- 初版发布
- 实现 Plugin 版 Soul Anchor
- 支持每轮对话动态注入约束
- 缓存机制，避免频繁 I/O
- 详细文档和示例
