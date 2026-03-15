# OpenClaw Soul Anchor

每轮对话将硬性约束注入 system prompt 末尾，防止 Agent 在长对话中遗忘规则。

## 解决什么问题

LLM 在长对话中对 system prompt 的注意力呈 **U 型分布**——开头和末尾关注度高，中间是"死区"。当约束只写在 system prompt 开头时，50+ 轮对话后它会滑入死区：

```
注意力
  ^
  |  *                              *
  |   *                           *
  |    *                        *
  |     *  ← 初始约束在这里   *  ← 用户最新消息在这里
  |       *      （逐渐被遗忘）  *
  |         * * * * * * * * * *
  |              死 区
  +───────────────────────────────→ 上下文位置
```

结果就是 Agent 开始越权、忽视安全规则、跳过工作流。

Soul Anchor 的做法很简单——**每轮对话把约束追加到 system prompt 末尾**，让它始终待在注意力高的位置：

```
注意力
  ^
  |  *                              *
  |   *                           *
  |    *                        *
  |     *                     *
  |       *                 *  ← Soul Anchor 注入约束
  |         * * * * * * * *    ← 紧接着就是用户消息
  +───────────────────────────────→ 上下文位置
```

## 快速开始

### 1. 安装插件

```bash
git clone https://github.com/erichua23/openclaw-soul-anchor.git ~/.openclaw/extensions/soul-anchor
```

> **注意：** 必须装到 `extensions/` 目录，不能装到 `hooks/`。只有 Plugin 的 `before_prompt_build` 返回值才会被 OpenClaw 采纳。

### 2. 为 Agent 创建约束文件

```bash
# 把 your_agent_id 换成实际的 Agent ID
cp ~/.openclaw/extensions/soul-anchor/examples/SOUL-ANCHOR.example.md \
   ~/.openclaw/workspaces/your_agent_id/SOUL-ANCHOR.md
```

然后编辑这个文件，写入你要的约束。推荐结构见 `examples/SOUL-ANCHOR.example.md`。

### 3. 重启 gateway

```bash
openclaw gateway restart
```

之后修改 `SOUL-ANCHOR.md` **不需要重启**，约 60 秒自动生效。

## 编写约束的建议

**关键约束首尾呼应** — 在文件顶部的身份边界和底部的重申中都写明核心禁令，即使中间内容被 LLM 部分遗忘，首尾也能覆盖。

**具体、可验证** — 避免"不要做危险的事"这种模糊表述，写清楚具体文件名、目录、操作。

**控制篇幅** — 单个 SOUL-ANCHOR.md 保持 500-1000 字，核心约束 3-5 条。过多约束反而降低效果。

## 配置

在 `openclaw.json` 中配置：

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

| 配置项 | 默认值 | 说明 |
|-------|-------|------|
| `anchorFilename` | `SOUL-ANCHOR.md` | 约束文件名，位于各 Agent 的 workspace 目录 |
| `cacheTtlMs` | `60000` | 缓存时间（毫秒），设为 `0` 禁用缓存 |

## 故障排查

**约束未生效？**

1. 确认文件存在：`ls ~/.openclaw/workspaces/{agentId}/SOUL-ANCHOR.md`
2. 确认文件权限：`chmod 644 ~/.openclaw/workspaces/{agentId}/SOUL-ANCHOR.md`
3. 确认 Agent workspace 路径正确：`cat ~/.openclaw/openclaw.json | jq '.agents'`
4. 等待缓存过期（默认 60 秒）或将 `cacheTtlMs` 设为 `0` 测试
5. 查看日志：`tail -100f ~/.openclaw/logs/gateway.log | grep soul-anchor`

**约束文件读取失败？**

- 确保 UTF-8 编码
- 确保 gateway 进程有读权限

## 兼容性

- OpenClaw >= 2026.3.0
- Node.js >= 18

## 许可证

MIT — 详见 [LICENSE](LICENSE)。
