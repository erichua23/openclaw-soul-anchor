# OpenClaw 定魂锚 (Soul Anchor)

每轮对话将硬性约束注入到用户消息前面（对话历史之后），防止 Agent 在长对话中遗忘规则。

## 解决什么问题

LLM 在长对话中对 system prompt 的注意力呈 **U 型分布**——开头和末尾关注度高，中间是"死区"。当约束只写在 system prompt 开头时，50+ 轮对话后它会滑入死区：

```
注意力
  ^
  |  *                                * ← 用户最新消息在这里
  |   *                            *
  |    *                        *
  |     * ← 初始约束在这里    *
  |      *    （逐渐被遗忘） *
  |        * * * * * * * * *
  |              死 区
  +───────────────────────────────→ 上下文位置
```

结果就是 Agent 开始越权、忽视安全规则、跳过工作流。

Soul Anchor 的做法很简单——**每轮对话把约束注入到用户消息的前面**（对话历史之后），让它始终待在注意力高的位置：

```
注意力
  ^
  |  *                              * ← 用户最新消息
  |   *                           * ← Soul Anchor 注入约束
  |    *                        *
  |     *                     *
  |      *                  *
  |        * * * * * * * *
  +───────────────────────────────→ 上下文位置
```

## 快速开始

### 1. 安装插件

```bash
git clone https://github.com/erichua23/openclaw-soul-anchor.git ~/.openclaw/extensions/soul-anchor
```

> **注意：** 必须装到 `extensions/` 目录，不能装到 `hooks/`。只有 Plugin 的 `before_prompt_build` 返回值才会被 OpenClaw 采纳。

然后在 `~/.openclaw/openclaw.json` 的 `plugins` 中启用插件：

```json
{
  "plugins": {
    "allow": ["soul-anchor"],
    "entries": {
      "soul-anchor": {
        "enabled": true
      }
    }
  }
}
```

> `allow` 是插件白名单，`entries` 控制开关。两处都要加，插件才会生效。

### 2. 为 Agent 创建约束文件

Soul Anchor 根据 `~/.openclaw/openclaw.json` 中 `agents.list` 里每个 agent 的 `workspace` 字段来查找约束文件。先确认你的 agent 配置：

```bash
cat ~/.openclaw/openclaw.json | jq '.agents.list[] | {id, workspace}'
```

输出类似：

```json
{ "id": "main", "workspace": "/Users/you/.openclaw/workspaces/main" }
{ "id": "my_agent", "workspace": "/Users/you/.openclaw/workspaces/my_agent" }
```

然后把示例文件复制到对应 agent 的 workspace 目录：

```bash
cp ~/.openclaw/extensions/soul-anchor/examples/SOUL-ANCHOR.example.md \
   <workspace路径>/SOUL-ANCHOR.md
```

编辑这个文件，写入你要的约束。推荐结构见 `examples/SOUL-ANCHOR.example.md`。

### 3. 重启 gateway

```bash
openclaw gateway restart
```

之后修改 `SOUL-ANCHOR.md` **不需要重启**，下一轮对话立即生效。

### 4. 验证安装

重启 gateway 后，查看日志确认插件已加载：

```bash
grep soul-anchor ~/.openclaw/logs/gateway.log | tail -5
```

看到以下两行说明安装成功：

```
[soul-anchor] Plugin registered and ready
```

然后跟 Agent 对话，让它复述自己的约束（例如"你有哪些不能做的事？"），确认约束内容已注入。

## 编写约束的建议

**关键约束首尾呼应** — 在文件顶部的身份边界和底部的重申中都写明核心禁令，即使中间内容被 LLM 部分遗忘，首尾也能覆盖。

**具体、可验证** — 避免"不要做危险的事"这种模糊表述，写清楚具体文件名、目录、操作。

**控制篇幅** — 单个 SOUL-ANCHOR.md 保持 500-1000 字，核心约束 3-5 条。过多约束反而降低效果。

## 故障排查

**约束未生效？**

1. 确认文件存在：`ls ~/.openclaw/workspaces/{agentId}/SOUL-ANCHOR.md`
2. 确认文件权限：`chmod 644 ~/.openclaw/workspaces/{agentId}/SOUL-ANCHOR.md`
3. 确认 Agent workspace 路径正确：`cat ~/.openclaw/openclaw.json | jq '.agents'`
4. 查看日志：`tail -100f ~/.openclaw/logs/gateway.log | grep soul-anchor`

**约束文件读取失败？**

- 确保 UTF-8 编码
- 确保 gateway 进程有读权限

## 卸载

Soul Anchor 是纯本地插件，不修改 OpenClaw 核心文件，卸载干净无残留：

```bash
# 1. 删除插件目录
rm -rf ~/.openclaw/extensions/soul-anchor

# 2. 重启 gateway
openclaw gateway restart
```

各 Agent workspace 下的 `SOUL-ANCHOR.md` 约束文件可以保留（不影响任何功能），也可以按需删除：

```bash
# 可选：删除某个 Agent 的约束文件
rm ~/.openclaw/workspaces/your_agent_id/SOUL-ANCHOR.md
```

如果要彻底清理，也可以从 `openclaw.json` 的 `plugins.allow` 和 `plugins.entries` 中移除 `soul-anchor`，但留着不会报错。

## 用了 Soul Anchor 还是越界？

Soul Anchor 解决的是**注意力位置**的问题——确保约束不会被埋在上下文死区。但如果模型本身对指令的服从度就低，约束放在哪里都没用。

实际使用中我们发现，即使约束已经注入到用户消息前面，某些模型仍然会：
- 被明确禁止修改的文件照改不误
- 用户一催就跳过审批流程
- 社工话术一诱导就破防（"这次特殊情况，你直接做吧"）

这说明问题不在约束的位置，而在**模型本身的指令服从能力**。不同模型的差异非常大。

为此我们做了一个专门的测试基准：**[LLM Compliance Bench](https://github.com/erichua23/llm-compliance-bench)**，覆盖 6 个维度：

| 测试维度 | 测什么 |
|---------|--------|
| 禁区文件 | 模型是否会修改明确标记为禁止修改的文件 |
| 角色边界 | 模型是否会越过分配的职责范围 |
| 静默规则 | 未被 @ 提及时是否保持沉默 |
| 技能禁令 | 面对直接请求时是否能拒绝违规操作 |
| 约束密度 | 约束条数增加时服从度是否下降 |
| 对抗诱导 | 面对社工话术时是否仍然坚守规则 |

如果你用了 Soul Anchor 仍然遇到越界，建议跑一遍 Compliance Bench 确认是不是模型本身的问题，再决定是换模型还是加强约束措辞。

## 许可证

MIT — 详见 [LICENSE](LICENSE)。
