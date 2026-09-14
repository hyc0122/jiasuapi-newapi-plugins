#!/usr/bin/env node
/**
 * Sync model IDs into plugins/tasks/jiasuapi/<ver>/plugin.js and index.json.
 *
 * Sources (in order):
 *   1. GET {BASE}/v1/models  (Authorization: Bearer $JIASU_API_KEY when set)
 *   2. Fallback: GET {BASE}/api/pricing  (public card list)
 *
 * Always force-includes: gpt-image-2.5-sunburst-1k
 * Always strips wrong id: gpt-image-2.5--sunburst-1k
 *
 * Usage:
 *   JIASU_API_KEY=sk-... node scripts/sync-models.mjs
 *   node scripts/sync-models.mjs --base https://ai.jiasuapi.com --version 1.0.1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FORCE_INCLUDE = ["gpt-image-2.5-sunburst-1k"];
const FORCE_EXCLUDE = ["gpt-image-2.5--sunburst-1k"];

function parseArgs(argv) {
  const out = { base: "https://ai.jiasuapi.com", version: "1.0.1" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") out.base = String(argv[++i] || "").replace(/\/+$/, "");
    else if (a === "--version") out.version = String(argv[++i] || "1.0.1");
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function classifyModel(id, hint = {}) {
  const m = String(id || "").trim();
  const lower = m.toLowerCase();
  const endpoints = []
    .concat(hint.supported_endpoint_types || [])
    .concat(hint.endpoints || [])
    .map((x) => String(x).toLowerCase());
  const tags = String(hint.tags || "").toLowerCase();
  const owned = String(hint.owned_by || hint.owner_by || "").toLowerCase();

  if (FORCE_INCLUDE.includes(m) || /sunburst/.test(lower)) return "image";
  if (endpoints.includes("openai-video") || endpoints.includes("video")) return "video";
  if (
    /(^|[^a-z])image([^a-z]|$)/.test(tags) ||
    endpoints.includes("openai-image") ||
    endpoints.includes("image")
  ) {
    return "image";
  }
  if (
    /^gpt-image-/i.test(m) ||
    /^k1-gpt-image/i.test(m) ||
    /^jimeng-/i.test(m) ||
    /^dall-e/i.test(m) ||
    /^flux-/i.test(m) ||
    /image/i.test(m)
  ) {
    return "image";
  }
  // Platform aliases: sd-2* are Seedance video models (not Stable Diffusion).
  if (
    /^seedance/i.test(m) ||
    /^sd-/i.test(m) ||
    /^sora/i.test(m) ||
    /^veo/i.test(m) ||
    /^kling/i.test(m) ||
    /^hailuo/i.test(m) ||
    /^wan-/i.test(m) ||
    /^luma/i.test(m) ||
    /video/i.test(m)
  ) {
    return "video";
  }
  if (/video/i.test(owned) || /image/i.test(owned)) {
    return /image/i.test(owned) ? "image" : "video";
  }
  return "unknown";
}

async function fetchJson(url, headers = {}) {
  const resp = await fetch(url, { headers });
  const text = await resp.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: resp.ok, status: resp.status, body, text };
}

async function fetchFromV1Models(base, apiKey) {
  const headers = { Accept: "application/json" };
  if (apiKey) {
    headers.Authorization = /^Bearer\s+/i.test(apiKey) ? apiKey : "Bearer " + apiKey;
  }
  const { ok, status, body } = await fetchJson(base + "/v1/models", headers);
  if (!ok) {
    return { ok: false, status, models: [], error: body };
  }
  const data = (body && body.data) || [];
  const models = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id || item.model || "").trim();
    if (!id) continue;
    models.push({
      id,
      kind: classifyModel(id, item),
      source: "v1/models",
      hint: item,
    });
  }
  return { ok: true, status, models, source: "v1/models" };
}

async function fetchFromPricing(base) {
  const { ok, status, body } = await fetchJson(base + "/api/pricing", {
    Accept: "application/json",
  });
  if (!ok) {
    return { ok: false, status, models: [], error: body };
  }
  const data = (body && body.data) || [];
  const models = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.model_name || item.model || item.id || "").trim();
    if (!id) continue;
    models.push({
      id,
      kind: classifyModel(id, item),
      source: "api/pricing",
      hint: item,
    });
  }
  return { ok: true, status, models, source: "api/pricing" };
}

function mergeModels(fetched) {
  const byId = new Map();
  for (const row of fetched) {
    if (FORCE_EXCLUDE.includes(row.id)) continue;
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  for (const id of FORCE_INCLUDE) {
    if (FORCE_EXCLUDE.includes(id)) continue;
    if (!byId.has(id)) {
      byId.set(id, { id, kind: "image", source: "force-include" });
    } else {
      const cur = byId.get(id);
      cur.kind = "image";
    }
  }
  // Drop wrong double-dash if somehow present under another key
  byId.delete("gpt-image-2.5--sunburst-1k");

  const all = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  const video = all.filter((m) => m.kind === "video").map((m) => m.id);
  const image = all.filter((m) => m.kind === "image").map((m) => m.id);
  const unknown = all.filter((m) => m.kind === "unknown").map((m) => m.id);
  const meta = all.map((m) => m.id);
  return { all, video, image, unknown, meta };
}

function jsStringArray(ids, indent = 4) {
  const pad = " ".repeat(indent);
  if (!ids.length) return "[]";
  return "[\n" + ids.map((id) => pad + JSON.stringify(id) + ",").join("\n") + "\n" + " ".repeat(indent - 2) + "]";
}

function jsBoolMap(ids, indent = 2) {
  const pad = " ".repeat(indent);
  const lines = ids.map((id) => pad + JSON.stringify(id) + ": true,");
  return "{\n" + lines.join("\n") + "\n}";
}

function replaceMetaModels(src, metaIds) {
  return src.replace(
    /(export const meta = \{[\s\S]*?\n  models: )(\[[\s\S]*?\])(,\n  fetchMode:)/,
    (_, a, _old, c) => a + jsStringArray(metaIds, 4) + c
  );
}

function replaceProtocolModels(src, videoIds) {
  return src.replace(
    /(protocols: \[\s*\{\s*name: "openai_video",\s*models: )(\[[\s\S]*?\])(,\s*\},?\s*\],)/,
    (_, a, _old, c) => a + jsStringArray(videoIds, 8) + c
  );
}

function replaceRouteModels(src, action, ids) {
  // Match the submit route block for video or image by action field nearby
  const re =
    action === "video"
      ? /(path: "\/jiasuapi\/v1\/videos\/generations",[\s\S]*?models: )(\[[\s\S]*?\])(,\s*\},)/
      : /(path: "\/jiasuapi\/v1\/images\/create",[\s\S]*?models: )(\[[\s\S]*?\])(,\s*\},)/;
  if (!re.test(src)) throw new Error("route models block not found for " + action);
  return src.replace(re, (_, a, _old, c) => a + jsStringArray(ids, 8) + c);
}

function replaceConstMap(src, name, ids) {
  const re = new RegExp("const " + name + " = \\{[\\s\\S]*?\\n\\};");
  if (!re.test(src)) throw new Error("const map not found: " + name);
  return src.replace(re, "const " + name + " = " + jsBoolMap(ids, 2) + ";");
}

function updatePluginJs(pluginPath, groups) {
  let src = fs.readFileSync(pluginPath, "utf8");
  src = replaceMetaModels(src, groups.meta);
  src = replaceProtocolModels(src, groups.video);
  src = replaceRouteModels(src, "video", groups.video);
  src = replaceRouteModels(src, "image", groups.image);
  src = replaceConstMap(src, "VIDEO_MODELS", groups.video);
  src = replaceConstMap(src, "IMAGE_MODELS", groups.image);
  if (src.includes("gpt-image-2.5--sunburst-1k")) {
    throw new Error("double-dash sunburst still present in plugin.js");
  }
  if (!src.includes("gpt-image-2.5-sunburst-1k")) {
    throw new Error("force-include sunburst missing from plugin.js");
  }
  fs.writeFileSync(pluginPath, src);
}

function updateIndexJson(indexPath, version, groups, pluginRelPath, sha256) {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const plugin = (index.plugins || []).find((p) => p.key === "jiasuapi");
  if (!plugin) throw new Error("jiasuapi entry missing in index.json");

  plugin.models = groups.meta.slice();
  plugin.latest = version;

  // Update route model lists on the card
  for (const route of plugin.routes || []) {
    if (route.path === "/jiasuapi/v1/videos/generations") route.models = groups.video.slice();
    if (route.path === "/jiasuapi/v1/images/create") route.models = groups.image.slice();
  }
  for (const proto of plugin.protocols || []) {
    if (proto.name === "openai_video") proto.models = groups.video.slice();
  }

  const versions = plugin.versions || [];
  const existing = versions.find((v) => v.version === version);
  const entry = {
    version,
    path: pluginRelPath,
    sha256,
    minApiVersion: 1,
    kind: "task",
    baseUrl: "https://ai.jiasuapi.com",
  };
  if (existing) Object.assign(existing, entry);
  else versions.push(entry);
  plugin.versions = versions;

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
}

async function sha256File(filePath) {
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/sync-models.mjs [--base URL] [--version X.Y.Z]
Env: JIASU_API_KEY (optional; required for authenticated /v1/models)`);
    process.exit(0);
  }

  const apiKey = (process.env.JIASU_API_KEY || "").trim();
  let fetched = [];
  let sourceNote = "";

  const v1 = await fetchFromV1Models(args.base, apiKey);
  if (v1.ok && v1.models.length) {
    fetched = v1.models;
    sourceNote = `synced ${fetched.length} from GET ${args.base}/v1/models`;
  } else {
    const reason =
      v1.status === 401
        ? "401 Unauthorized (set JIASU_API_KEY for full /v1/models)"
        : `HTTP ${v1.status}`;
    console.warn(`[sync-models] /v1/models failed: ${reason}; falling back to /api/pricing`);
    const pricing = await fetchFromPricing(args.base);
    if (!pricing.ok) {
      console.error("[sync-models] /api/pricing also failed:", pricing.status, pricing.error);
      process.exit(1);
    }
    fetched = pricing.models;
    sourceNote = `synced ${fetched.length} from GET ${args.base}/api/pricing (fallback; /v1/models: ${reason})`;
  }

  const groups = mergeModels(fetched);
  console.log("[sync-models]", sourceNote);
  console.log(
    `[sync-models] meta=${groups.meta.length} video=${groups.video.length} image=${groups.image.length} unknown=${groups.unknown.length}`
  );
  console.log("[sync-models] force-include ok:", groups.meta.includes("gpt-image-2.5-sunburst-1k"));
  if (groups.unknown.length) {
    console.log("[sync-models] unknown (meta only):", groups.unknown.join(", "));
  }

  const pluginRel = `plugins/tasks/jiasuapi/${args.version}/plugin.js`;
  const pluginPath = path.join(ROOT, pluginRel);
  if (!fs.existsSync(pluginPath)) {
    console.error("[sync-models] missing plugin:", pluginRel);
    process.exit(1);
  }

  updatePluginJs(pluginPath, groups);
  const digest = await sha256File(pluginPath);
  updateIndexJson(path.join(ROOT, "index.json"), args.version, groups, pluginRel, digest);

  // Write a small manifest for release notes / CI
  const manifest = {
    syncedAt: new Date().toISOString(),
    base: args.base,
    version: args.version,
    source: sourceNote,
    counts: {
      meta: groups.meta.length,
      video: groups.video.length,
      image: groups.image.length,
      unknown: groups.unknown.length,
    },
    models: groups.meta,
    video: groups.video,
    image: groups.image,
    unknown: groups.unknown,
    sha256: digest,
    sunburst: groups.meta.includes("gpt-image-2.5-sunburst-1k"),
  };
  fs.writeFileSync(
    path.join(ROOT, "scripts", "last-sync.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );
  console.log("[sync-models] wrote", pluginRel, "sha256=", digest);
  console.log("[sync-models] updated index.json latest ->", args.version);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
