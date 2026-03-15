# 快速安装指南

## 前置条件

- OpenClaw 2026.3.x 或更高
- macOS / Linux / Windows（支持 `homedir()` 的系统）
- 命令行访问权限

## 安装步骤

### 1. 复制插件到 extensions 目录

```bash
# 假设 soul-anchor 源码位于当前目录
cp -r openclaw-soul-anchor ~/.openclaw/extensions/soul-anchor

# 验证文件结构
ls -la ~/.openclaw/extensions/soul-anchor/
# 应该看到：
# - index.js
# - openclaw.plugin.json
# - README.md
# - LICENSE
# - examples/
```

### 2. 为每个需要约束的 Agent 创建 SOUL-ANCHOR.md

```bash
# 例如，为 main workspace（StudioBot）创建约束
mkdir -p ~/.openclaw/workspaces/main
cp ~/.openclaw/extensions/soul-anchor/examples/SOUL-ANCHOR.example.md \
   ~/.openclaw/workspaces/main/SOUL-ANCHOR.md

# 编辑约束内容（使用你的编辑器）
vim ~/.openclaw/workspaces/main/SOUL-ANCHOR.md
```

为其他 Agent 重复此步骤：

```bash
# mctech_dev_qian
mkdir -p ~/.openclaw/workspaces/mctech_dev_qian
cp ~/.openclaw/extensions/soul-anchor/examples/SOUL-ANCHOR.example.md \
   ~/.openclaw/workspaces/mctech_dev_qian/SOUL-ANCHOR.md

# mctech_dev_hou
mkdir -p ~/.openclaw/workspaces/mctech_dev_hou
cp ~/.openclaw/extensions/soul-anchor/examples/SOUL-ANCHOR.example.md \
   ~/.openclaw/workspaces/mctech_dev_hou/SOUL-ANCHOR.md

# 以此类推...
```

### 3. 检查 openclaw.json 配置（可选）

如果需要自定义缓存 TTL 或约束文件名，编辑 `~/.openclaw/openclaw.json`：

```bash
# 解锁文件
chflags nouchg ~/.openclaw/openclaw.json

# 编辑配置
vim ~/.openclaw/openclaw.json

# 添加或修改以下部分：
# {
#   "plugins": {
#     "soul-anchor": {
#       "enabled": true,
#       "config": {
#         "anchorFilename": "SOUL-ANCHOR.md",
#         "cacheTtlMs": 60000
#       }
#     }
#   }
# }

# 重新锁定文件
chflags uchg ~/.openclaw/openclaw.json
```

### 4. 重启 gateway

```bash
openclaw gateway restart
```

或者在 macOS GUI 中：

```bash
# 使用活动监视器（Activity Monitor）找到 gateway 进程并强制退出
# 或使用以下命令
pkill -f "openclaw-gateway"
# 然后重新启动 OpenClaw 应用
```

### 5. 验证安装

```bash
# 检查 gateway 日志是否有 soul-anchor 初始化信息
tail -50 ~/.openclaw/logs/gateway.log | grep soul-anchor

# 应该看到类似输出：
# [soul-anchor] Initialized with anchorFilename="SOUL-ANCHOR.md", cacheTtlMs=60000ms
# [soul-anchor] Plugin registered and ready
```

在对话中向 Agent 发送消息，观察是否遵守约束。

## 故障排查

### 插件未加载

1. 检查文件位置
   ```bash
   ls -la ~/.openclaw/extensions/soul-anchor/
   ```

2. 检查 openclaw.json 中是否启用了 soul-anchor（如有自定义配置）

3. 查看 gateway 日志
   ```bash
   tail -100f ~/.openclaw/logs/gateway.log | grep -i soul-anchor
   ```

### 约束未生效

1. 检查 SOUL-ANCHOR.md 是否存在
   ```bash
   ls -la ~/.openclaw/workspaces/{agentId}/SOUL-ANCHOR.md
   ```

2. 确认 Agent ID 正确
   ```bash
   cat ~/.openclaw/openclaw.json | jq '.agents[] | {id, workspace}'
   ```

3. 等待缓存过期（默认 60 秒）

4. 查看约束文件是否有读权限
   ```bash
   chmod 644 ~/.openclaw/workspaces/{agentId}/SOUL-ANCHOR.md
   ```

### 约束文件编码问题

确保 SOUL-ANCHOR.md 使用 UTF-8 编码：

```bash
file ~/.openclaw/workspaces/{agentId}/SOUL-ANCHOR.md
# 应该显示：UTF-8 Unicode text

# 如果编码错误，转换：
iconv -f ISO-8859-1 -t UTF-8 input.md > output.md
mv output.md ~/.openclaw/workspaces/{agentId}/SOUL-ANCHOR.md
```

## 卸载

```bash
# 删除插件
rm -rf ~/.openclaw/extensions/soul-anchor

# 可选：删除各 Agent 的约束文件
rm ~/.openclaw/workspaces/*/SOUL-ANCHOR.md

# 重启 gateway
openclaw gateway restart
```

## 更新

```bash
# 拉取最新代码
cd /path/to/soul-anchor-repo
git pull

# 覆盖安装（保留现有约束文件）
cp -r . ~/.openclaw/extensions/soul-anchor/
cp README.md ~/.openclaw/extensions/soul-anchor/

# 重启 gateway
openclaw gateway restart
```

## 获取帮助

- 查看 [README.md](README.md) 了解详细文档
- 查看 [examples/SOUL-ANCHOR.example.md](examples/SOUL-ANCHOR.example.md) 获取约束编写示例
- 提交 Issue：https://github.com/openclaw/soul-anchor/issues
