import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".openclaw");

/**
 * Soul Anchor Plugin
 *
 * Reads SOUL-ANCHOR.md from each agent's workspace and injects it
 * via before_prompt_build → prependContext (prepended to user message).
 *
 * prependContext places the anchor right before the latest user message,
 * which is the highest-attention position in the context window.
 * (appendSystemContext only appends to system prompt, which drifts away
 * from attention as conversations grow longer.)
 *
 * File layout:
 *   ~/.openclaw/workspaces/<workspace>/SOUL-ANCHOR.md
 *
 * If the file doesn't exist for an agent, nothing is injected.
 */

// Map agentId → workspace directory name (from openclaw.json agents.list)
// Loaded once at plugin registration time
function loadAgentWorkspaceMap() {
  try {
    const raw = readFileSync(join(CONFIG_DIR, "openclaw.json"), "utf-8");
    const config = JSON.parse(raw);
    const map = {};
    for (const agent of config.agents?.list ?? []) {
      if (agent.id && agent.workspace) {
        map[agent.id] = agent.workspace;
      }
    }
    return map;
  } catch {
    return {};
  }
}

function loadAnchor(workspaceDir) {
  const anchorPath = join(workspaceDir, "SOUL-ANCHOR.md");
  try {
    const raw = readFileSync(anchorPath, "utf-8").trim();
    return raw || null;
  } catch {
    return null;
  }
}

const plugin = {
  id: "soul-anchor",
  name: "Soul Anchor",
  description: "Inject hard constraints into system prompt, immune to context dilution.",

  register(api) {
    const workspaceMap = loadAgentWorkspaceMap();

    api.on("before_prompt_build", (event, ctx) => {
      const agentId = ctx?.agentId;
      if (!agentId) return {};

      const workspaceDir = workspaceMap[agentId];
      if (!workspaceDir) return {};

      const anchor = loadAnchor(workspaceDir);
      if (!anchor) return {};

      return {
        prependContext: anchor,
      };
    }, { priority: 999 });
  },
};

export default plugin;
