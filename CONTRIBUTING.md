# 贡献指南

感谢你对 Soul Anchor 的关注！本文档说明如何参与项目开发。

## 报告问题

如遇到 bug 或有改进建议，请提交 Issue：

1. 检查是否已有相同的 Issue（避免重复）
2. 清晰描述问题：
   - 你的 OpenClaw 版本
   - 重现步骤
   - 实际行为 vs 预期行为
   - 相关日志（如有）

**示例：**

```markdown
# SOUL-ANCHOR.md 未生效

## 环境
- OpenClaw: 2026.3.12
- Node.js: 20.11.0
- OS: macOS 14.2

## 步骤
1. 复制 soul-anchor 到 ~/.openclaw/extensions/
2. 为 main workspace 创建 SOUL-ANCHOR.md
3. 重启 gateway
4. 向 Agent 提问

## 实际行为
Agent 忽视了约束条件

## 预期行为
Agent 应该遵守约束

## 日志
[gateway.log 内容...]
```

## 改进建议

有想法改进 Soul Anchor？欢迎讨论：

1. 创建 Discussion（如果是概念性改进）
2. 或直接创建 Issue（如果已有明确方向）

**改进方向示例：**
- 支持约束文件的版本控制
- 支持约束继承（通用 + 特殊）
- 支持多个约束文件（priority 加权）
- 性能优化

## 代码贡献

### 开发环境配置

```bash
# 1. Fork & Clone
git clone https://github.com/YOUR_USERNAME/soul-anchor.git
cd soul-anchor

# 2. 创建功能分支
git checkout -b feature/your-feature-name

# 3. 做更改
# 编辑 index.js、文档等

# 4. 验证修改
# - 检查代码风格
# - 测试插件加载
# - 验证约束生效

# 5. 提交 PR
git push origin feature/your-feature-name
# 在 GitHub 上创建 Pull Request
```

### 代码风格

- **JavaScript:** 遵循 ES2020 标准，使用 ESM 格式
- **注释:** 关键逻辑要有详细注释（参考 index.js）
- **错误处理:** 使用 try-catch，静默失败（不影响 gateway）

**示例：**

```javascript
// 好
function loadAnchor(workspaceDir, filename) {
  const anchorPath = join(workspaceDir, filename);
  if (!existsSync(anchorPath)) {
    return null;
  }
  try {
    return readFileSync(anchorPath, "utf-8").trim();
  } catch (err) {
    console.warn(`[soul-anchor] Failed to read ${anchorPath}:`, err.message);
    return null;
  }
}

// 不好
function loadAnchor(ws, f) {
  const p = join(ws, f);
  return fs.readFileSync(p, 'utf8');  // 不处理错误
}
```

### 文档更新

修改功能时，也要更新文档：

- **README.md** — 功能/配置改变时更新
- **ARCHITECTURE.md** — 设计变更时更新
- **INSTALLATION.md** — 安装流程改变时更新
- **代码注释** — 复杂逻辑要有行内注释

### 测试

Soul Anchor 没有自动化测试套件（因为它依赖 OpenClaw runtime），但应该：

1. **本地验证**
   ```bash
   # 在你的 OpenClaw 环境中安装修改后的版本
   cp -r . ~/.openclaw/extensions/soul-anchor/

   # 重启 gateway
   openclaw gateway restart

   # 与 Agent 对话，验证约束生效
   ```

2. **长对话测试**
   - 与 Agent 进行 50+ 轮对话
   - 在不同轮次中测试约束边界
   - 确保约束始终被遵守

3. **配置测试**
   - 修改 `cacheTtlMs`，验证缓存更新
   - 修改 `anchorFilename`，验证文件查询
   - 删除约束文件，验证静默处理

### PR 检查清单

提交 PR 前，确保：

- [ ] 代码遵循风格指南
- [ ] 注释清晰、完整
- [ ] 错误处理完善（try-catch）
- [ ] 文档已更新
- [ ] 本地验证通过
- [ ] Commit 信息清晰（见下面的规范）

### Commit 信息规范

使用简洁、明确的 commit 信息：

```
<type>: <subject>

<body>

<footer>
```

**Type:**
- `feat` — 新功能
- `fix` — 修复 bug
- `docs` — 文档更新
- `refactor` — 代码重构（不改变行为）
- `perf` — 性能优化
- `test` — 测试相关

**Subject:**
- 命令式语气（"add" 而非 "added"）
- 首字母小写
- 不超过 50 个字符

**示例：**

```
feat: add support for custom anchor filename

Allow users to configure the anchor filename through openclaw.plugin.json
instead of hardcoding SOUL-ANCHOR.md. This enables flexibility for teams
with different naming conventions.

Closes #12
```

## 设计讨论

有重大特性想法？先开 Discussion 征集意见：

**讨论要点：**
1. 你的想法解决什么问题？
2. 实现方案是什么？
3. 有什么权衡？
4. 对现有 API 的影响？

**示例：**

```markdown
# 讨论：支持约束继承机制

## 问题
目前每个 Agent 的约束文件是独立的，导致通用约束（如"禁止修改 openclaw.json"）
在每个文件中重复定义。

## 提议
支持约束继承：
- 全局约束：~/.openclaw/SOUL-ANCHOR-global.md
- Agent 特殊约束：~/.openclaw/workspaces/{id}/SOUL-ANCHOR.md
- 加载时合并两个文件

## 权衡
- 优点：减少重复、便于维护
- 缺点：加载逻辑复杂，合并顺序有讲究

## 问题
1. 全局约束应该在 Agent 约束前还是后？
2. 支持多个全局文件吗？
```

## 审查流程

所有 PR 需要：

1. **代码审查** — 至少一人审查，检查逻辑、风格、文档
2. **功能验证** — 在实际 OpenClaw 环境中测试
3. **文档审查** — 确保文档与代码一致

## 许可证

贡献代码即同意在 MIT License 下发布。

## 行为准则

参与本项目时，请：

- 尊重他人观点和时间
- 给出建设性反馈
- 避免人身攻击或骚扰
- 遵守开源社区规范

## 获取帮助

不确定如何开始？

- 查看 [ARCHITECTURE.md](ARCHITECTURE.md) 了解设计原理
- 查看 [README.md](README.md) 了解使用方式
- 在 Issue 中提问（标记为 question）
- 联系项目维护者

## 项目维护者

- **创意和架构：** Soul Anchor Team
- **当前维护者：** OpenClaw Community

---

感谢你的贡献！
