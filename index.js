import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const OC_HOME = join(homedir(), ".openclaw");
const OC_CONFIG = join(OC_HOME, "openclaw.json");

/**
 * Load OpenClaw configuration from ~/.openclaw/openclaw.json
 * @returns {object|null} Parsed config object or null if load fails
 */
function loadConfig() {
  try {
    return JSON.parse(readFileSync(OC_CONFIG, "utf-8"));
  } catch (err) {
    console.error(
      `[soul-anchor] Failed to load openclaw.json from ${OC_CONFIG}:`,
      err.message
    );
    return null;
  }
}

/**
 * Build a mapping from agentId to workspace directory
 * @param {object} config - OpenClaw configuration object
 * @returns {object} Map of agentId -> workspaceDir
 */
function buildWorkspaceMap(config) {
  const map = {};
  const agents = config?.agents || [];
  for (const agent of agents) {
    if (agent.id && agent.workspace) {
      map[agent.id] = agent.workspace;
    }
  }
  return map;
}

/**
 * Load anchor constraints from a workspace directory
 * @param {string} workspaceDir - Path to agent workspace
 * @param {string} filename - Name of the anchor file (default: SOUL-ANCHOR.md)
 * @returns {string|null} File content or null if not found/readable
 */
function loadAnchor(workspaceDir, filename) {
  const anchorPath = join(workspaceDir, filename);
  if (!existsSync(anchorPath)) {
    return null;
  }
  try {
    const content = readFileSync(anchorPath, "utf-8").trim();
    return content.length > 0 ? content : null;
  } catch (err) {
    console.warn(
      `[soul-anchor] Failed to read anchor file ${anchorPath}:`,
      err.message
    );
    return null;
  }
}

/**
 * Soul Anchor Plugin
 *
 * Injects per-agent constraints into the system prompt tail on every turn.
 *
 * CRITICAL ARCHITECTURE NOTE:
 * ============================
 * This MUST be implemented as a Plugin (in ~/.openclaw/extensions/), NOT a Managed Hook
 * (in ~/.openclaw/hooks/). The two have completely different code paths:
 *
 * 1. Managed Hook (~/.openclaw/hooks/):
 *    registerInternalHook() → triggerInternalHook() → FIRE-AND-FORGET (void return)
 *    - Return values are IGNORED
 *    - appendSystemContext has NO EFFECT
 *
 * 2. Plugin (~/.openclaw/extensions/):
 *    api.on() → registerTypedHook() → registry.typedHooks → hookRunner.runBeforePromptBuild()
 *    - Return values are COLLECTED
 *    - appendSystemContext is MERGED into the system prompt
 *
 * This architectural difference is not documented in OpenClaw but is evident from source code.
 * Only Plugins can successfully inject system context on every turn.
 */
export default {
  id: "soul-anchor",
  name: "Soul Anchor",

  /**
   * Plugin registration entry point
   * @param {object} api - OpenClaw Plugin API
   */
  register(api) {
    // Load OpenClaw configuration
    const config = loadConfig();
    if (!config) {
      console.error(
        "[soul-anchor] Failed to load openclaw.json, plugin disabled"
      );
      return;
    }

    // Build agentId -> workspace mapping
    const workspaceMap = buildWorkspaceMap(config);
    if (Object.keys(workspaceMap).length === 0) {
      console.warn(
        "[soul-anchor] No agents found in openclaw.json, plugin loaded but no constraints will be injected"
      );
    }

    // Load plugin configuration
    const pluginConfig = config?.plugins?.["soul-anchor"]?.config || {};
    const anchorFilename = pluginConfig.anchorFilename || "SOUL-ANCHOR.md";

    console.log(
      `[soul-anchor] Initialized with anchorFilename="${anchorFilename}"`
    );

    /**
     * Hook: before_prompt_build
     *
     * Triggered just before OpenClaw constructs the LLM prompt.
     * Returns { appendSystemContext } which is merged into the system prompt's tail.
     * High priority (999) ensures constraints are appended last, closest to user message.
     *
     * @param {object} event - Hook event object
     * @param {object} ctx - Hook context, includes agentId
     * @returns {object} { appendSystemContext?: string } or {}
     */
    api.on(
      "before_prompt_build",
      (event, ctx) => {
        const agentId = ctx?.agentId;

        // No agentId = not in agent context, skip
        if (!agentId) {
          return {};
        }

        // Agent not in workspace map, skip silently
        const workspaceDir = workspaceMap[agentId];
        if (!workspaceDir) {
          return {};
        }

        // Load anchor file (direct read every turn, ~1ms for a small file)
        const content = loadAnchor(workspaceDir, anchorFilename);

        return content ? { appendSystemContext: content } : {};
      },
      { priority: 999 } // Highest priority: injected last (closest to user message)
    );

    console.log("[soul-anchor] Plugin registered and ready");
  },
};
