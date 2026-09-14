/**
 * 佳速API — NewAPI Task Plugin (market install for other NewAPI instances).
 * Official site: https://ai.jiasuapi.com/
 *
 * Calls public endpoints only:
 *   POST /v1/video/generations  +  GET /v1/videos/tasks/:id
 *   POST /v1/images/create      +  GET /v1/images/tasks/:id
 * Base URL and API key come from the Task Plugin channel (ctx.baseUrl / ctx.apiKey).
 */
export const meta = {
  apiVersion: 1,
  key: "jiasuapi",
  name: "佳速API",
  icon: "text:佳速",
  description: {
    en: "JiasuAPI image & video media platform. Official site: https://ai.jiasuapi.com/",
    zh: "佳速API中转平台（图片、视频中转平台）。官方地址：https://ai.jiasuapi.com/",
  },
  version: "1.0.2",
  author: { name: "佳速API", url: "https://ai.jiasuapi.com/" },
  models: [
    "gpt-image-2.5-1k",
    "gpt-image-2.5-sunburst-1k",
    "jimeng-5.0",
    "sd-2.0-720",
    "sd-2.0-720-fast",
    "sd-2.0-933-720-fast-原生真人",
    "sd-2.0-933-720-满血原生真人",
    "seedance-2.0-900",
    "seedance-2.0-933",
    "seedance-2.5-101010",
    "seedance-2.5-301010",
    "seedance-2.5-900",
  ],
  fetchMode: "per_task",
  allowedHosts: [
    "ai.jiasuapi.com",
    "ai1.jiasuapi.com",
    "api.jiasuapi.com",
    "relay.jiasuapi.com",
    "m.jiasuapi.com",
    "media.jiasuapi.com",
  ],
  protocols: [
    {
      name: "openai_video",
      models: [
        "sd-2.0-720",
        "sd-2.0-720-fast",
        "sd-2.0-933-720-fast-原生真人",
        "sd-2.0-933-720-满血原生真人",
        "seedance-2.0-900",
        "seedance-2.0-933",
        "seedance-2.5-101010",
        "seedance-2.5-301010",
        "seedance-2.5-900",
      ],
    },
  ],
  routes: [
    {
      method: "POST",
      path: "/jiasuapi/v1/videos/generations",
      type: "submit",
      action: "video",
      decode: "decodeVideoSubmit",
      render: "taskCreatedJsapi",
      models: [
        "sd-2.0-720",
        "sd-2.0-720-fast",
        "sd-2.0-933-720-fast-原生真人",
        "sd-2.0-933-720-满血原生真人",
        "seedance-2.0-900",
        "seedance-2.0-933",
        "seedance-2.5-101010",
        "seedance-2.5-301010",
        "seedance-2.5-900",
      ],
    },
    {
      method: "POST",
      path: "/jiasuapi/v1/images/create",
      type: "submit",
      action: "image",
      decode: "decodeImageSubmit",
      render: "taskCreatedJsapi",
      models: [
        "gpt-image-2.5-1k",
        "gpt-image-2.5-sunburst-1k",
        "jimeng-5.0",
      ],
    },
    {
      method: "GET",
      path: "/jiasuapi/v1/videos/tasks/:task_id",
      type: "query",
      render: "taskStatusJsapi",
    },
    {
      method: "GET",
      path: "/jiasuapi/v1/images/tasks/:task_id",
      type: "query",
      render: "taskStatusJsapi",
    },
  ],
};

const DEFAULT_BASE_URL = "https://ai.jiasuapi.com";

const VIDEO_MODELS = {
  "sd-2.0-720": true,
  "sd-2.0-720-fast": true,
  "sd-2.0-933-720-fast-原生真人": true,
  "sd-2.0-933-720-满血原生真人": true,
  "seedance-2.0-900": true,
  "seedance-2.0-933": true,
  "seedance-2.5-101010": true,
  "seedance-2.5-301010": true,
  "seedance-2.5-900": true,
};

const IMAGE_MODELS = {
  "gpt-image-2.5-1k": true,
  "gpt-image-2.5-sunburst-1k": true,
  "jimeng-5.0": true,
};

const QUALITIES = { auto: true, low: true, medium: true, high: true };

function trimmed(value) {
  return String(value || "").trim();
}

function stripTrailingSlash(url) {
  return String(url || "").replace(/\/+$/, "");
}

function channelBaseUrl(ctx) {
  const base = stripTrailingSlash(ctx && ctx.baseUrl);
  return base || DEFAULT_BASE_URL;
}

function authorizationHeader(apiKey) {
  const key = trimmed(apiKey);
  if (!key) throw new Error("api key is required");
  if (/^Bearer\s+/i.test(key)) return key;
  return "Bearer " + key;
}

function jsonHeaders(apiKey) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: authorizationHeader(apiKey),
  };
}

function authHeaders(apiKey) {
  return {
    Accept: "application/json",
    Authorization: authorizationHeader(apiKey),
  };
}

function isVideoModel(model) {
  const m = trimmed(model);
  return Boolean(VIDEO_MODELS[m]) || /^seedance-/i.test(m) || /^sd-2\./i.test(m);
}

function isImageModel(model) {
  const m = trimmed(model);
  return (
    Boolean(IMAGE_MODELS[m]) ||
    /^jimeng-/i.test(m) ||
    /^k1-gpt-image/i.test(m) ||
    /^gpt-image-/i.test(m)
  );
}

function inferAction(model, action) {
  const a = trimmed(action).toLowerCase();
  if (a === "image" || a === "video") return a;
  if (isImageModel(model)) return "image";
  return "video";
}

function decodeJsonObject(ctx) {
  if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
  const body = ctx.body.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("request body must be an object");
  }
  return body;
}

function clientPrompt(req) {
  if (!req || req.prompt === undefined || req.prompt === null) return "";
  return String(req.prompt).trim();
}

function pickRequestDuration(req) {
  if (!req || typeof req !== "object") return undefined;
  const raw =
    req.duration !== undefined && req.duration !== null && req.duration !== ""
      ? req.duration
      : req.seconds;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return raw;
}

function outboundQuality(req) {
  const metadata = (req && req.metadata) || {};
  const raw = trimmed(req && req.quality) || trimmed(metadata.quality);
  if (!raw) return "";
  const lower = raw.toLowerCase();
  return QUALITIES[lower] ? lower : raw;
}

function mediaUrl(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (value.__fileRef) return null;
    return trimmed(value.url) || trimmed(value.uri);
  }
  return trimmed(value);
}

function normalizeImageType(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return trimmed(value.type).toLowerCase();
}

/** Pass through images as URL strings or {url,name?,type?} objects. */
function normalizeMediaList(values) {
  const out = [];
  const walk = function (value) {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (value.__fileRef) {
        out.push(value);
        return;
      }
      const url = mediaUrl(value);
      if (!url) return;
      const item = { url: url };
      const name = trimmed(value.name);
      if (name) item.name = name;
      const typ = normalizeImageType(value);
      if (typ === "first_frame") item.type = "first_frame";
      else if (typ === "end_frame" || typ === "last_frame") item.type = "end_frame";
      out.push(item);
      return;
    }
    const url = trimmed(value);
    if (url) out.push(url);
  };
  walk(values);
  return out;
}

function normalizeMaterials(values) {
  const out = [];
  const walk = function (value) {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const url = mediaUrl(value);
    if (!url && !value.__fileRef) return;
    const item = {};
    const typ = trimmed(value.type).toLowerCase();
    if (typ) item.type = typ;
    if (url) item.url = url;
    else if (value.__fileRef) item.__fileRef = value.__fileRef;
    const name = trimmed(value.name);
    if (name) item.name = name;
    out.push(item);
  };
  walk(values);
  return out;
}

function normalizeFace(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const out = {};
  if (value.enabled !== undefined) out.enabled = Boolean(value.enabled);
  const mode = trimmed(value.mode).toLowerCase();
  if (mode === "light" || mode === "heavy") out.mode = mode;
  return Object.keys(out).length ? out : null;
}

function decodeNativeVideoSubmit(ctx) {
  const body = decodeJsonObject(ctx);
  const model = trimmed(body.model);
  if (!model) throw new Error("model is required");
  const prompt = clientPrompt(body);
  if (!prompt) throw new Error("prompt is required");
  const requestBody = Object.assign({}, body, { model: model, prompt: prompt });
  const picked = pickRequestDuration(body);
  if (picked !== undefined) requestBody.duration = Number(picked);
  return { kind: "submit", model: model, action: "video", requestBody: requestBody };
}

function decodeNativeImageSubmit(ctx) {
  const body = decodeJsonObject(ctx);
  const model = trimmed(body.model);
  if (!model) throw new Error("model is required");
  const prompt = clientPrompt(body);
  if (!prompt) throw new Error("prompt is required");
  const requestBody = Object.assign({}, body, { model: model, prompt: prompt });
  const quality = outboundQuality(body);
  if (quality) requestBody.quality = quality;
  return { kind: "submit", model: model, action: "image", requestBody: requestBody };
}

function taskCreatedJsapi(_ctx, task) {
  return {
    id: task.task_id,
    task_id: task.task_id,
    status: "queued",
    model: (task.properties && task.properties.origin_model_name) || "",
  };
}

function taskStatusJsapi(_ctx, task) {
  const statusMap = {
    NOT_START: "queued",
    SUBMITTED: "queued",
    QUEUED: "queued",
    IN_PROGRESS: "running",
    SUCCESS: "succeeded",
    FAILURE: "failed",
  };
  const data = task.data && typeof task.data === "object" ? task.data : {};
  const out = {
    id: task.task_id,
    task_id: task.task_id,
    status: statusMap[task.status] || "queued",
    progress_pct: Number(String(task.progress || "0").replace("%", "")) || 0,
    fail_reason: task.fail_reason || data.fail_reason || "",
  };
  const urls = collectResultUrls(data);
  if (urls.length) out.result_urls = urls;
  if (data.model) out.model = data.model;
  return out;
}

export const native = {
  decodeVideoSubmit: decodeNativeVideoSubmit,
  decodeImageSubmit: decodeNativeImageSubmit,
  taskCreatedJsapi: taskCreatedJsapi,
  taskStatusJsapi: taskStatusJsapi,
  taskCreated: taskCreatedJsapi,
  taskStatus: taskStatusJsapi,
  error: function (_ctx, error) {
    return { error: error.message || "request failed", code: error.code || "" };
  },
};

function buildVideoBody(ctx, req) {
  const model = ctx.upstreamModel || ctx.model || req.model || "";
  if (!trimmed(model)) throw new Error("model is required");
  const prompt = clientPrompt(req);
  if (!prompt) throw new Error("prompt is required");

  const body = {
    model: model,
    prompt: prompt,
  };

  const picked = pickRequestDuration(req);
  if (picked !== undefined) body.duration = Number(picked);

  const metadata = (req && req.metadata) || {};
  const ratio =
    trimmed(req.ratio) ||
    trimmed(metadata.ratio) ||
    trimmed(req.aspect_ratio) ||
    trimmed(metadata.aspect_ratio);
  if (ratio) body.ratio = ratio;

  const resolution =
    trimmed(req.resolution) ||
    trimmed(metadata.resolution) ||
    trimmed(req.video_resolution) ||
    trimmed(metadata.video_resolution);
  if (resolution) body.resolution = resolution;

  const images = normalizeMediaList([req.images, metadata.images, req.image_urls, metadata.image_urls]);
  const singleImage = mediaUrl(req.image) || mediaUrl(req.input_reference) || mediaUrl(metadata.image);
  if (singleImage) {
    let dup = false;
    for (let i = 0; i < images.length; i++) {
      const item = images[i];
      const u = typeof item === "string" ? item : item && item.url;
      if (u === singleImage) {
        dup = true;
        break;
      }
    }
    if (!dup) images.push(singleImage);
  }
  if (images.length) body.images = images;

  const videos = normalizeMediaList([req.videos, metadata.videos]);
  if (videos.length) body.videos = videos;

  const audios = normalizeMediaList([req.audios, metadata.audios]);
  if (audios.length) body.audios = audios;

  const materials = normalizeMaterials([req.materials, metadata.materials]);
  if (materials.length) body.materials = materials;

  const face = normalizeFace(req.face) || normalizeFace(metadata.face);
  if (face) body.face = face;

  return body;
}

function buildImageBody(ctx, req) {
  const model = ctx.upstreamModel || ctx.model || req.model || "";
  if (!trimmed(model)) throw new Error("model is required");
  const prompt = clientPrompt(req);
  if (!prompt) throw new Error("prompt is required");

  const body = {
    model: model,
    prompt: prompt,
  };

  const metadata = (req && req.metadata) || {};
  const nRaw = req.n !== undefined ? req.n : metadata.n;
  if (nRaw !== undefined && nRaw !== null && nRaw !== "") {
    const n = Number(nRaw);
    if (Number.isInteger(n) && n >= 1) body.n = n;
  }

  const quality = outboundQuality(req);
  if (quality) body.quality = quality;

  const ratio =
    trimmed(req.ratio) ||
    trimmed(metadata.ratio) ||
    trimmed(req.aspect_ratio) ||
    trimmed(metadata.aspect_ratio);
  if (ratio) body.ratio = ratio;

  const size = trimmed(req.size) || trimmed(metadata.size);
  if (size) body.size = size;

  const resolution = trimmed(req.resolution) || trimmed(metadata.resolution);
  if (resolution) body.resolution = resolution;

  const images = normalizeMediaList([req.images, metadata.images, req.image_urls, metadata.image_urls]);
  const singleImage = mediaUrl(req.image) || mediaUrl(req.input_reference) || mediaUrl(metadata.image);
  if (singleImage) {
    let dup = false;
    for (let i = 0; i < images.length; i++) {
      const item = images[i];
      const u = typeof item === "string" ? item : item && item.url;
      if (u === singleImage) {
        dup = true;
        break;
      }
    }
    if (!dup) images.push(singleImage);
  }
  if (images.length) body.images = images;

  return body;
}

export function buildSubmitRequest(ctx) {
  const req = ctx.requestBody || {};
  const model = ctx.upstreamModel || ctx.model || req.model || "";
  const action = inferAction(model, ctx.action);
  const base = channelBaseUrl(ctx);

  if (action === "image") {
    return {
      url: base + "/v1/images/create",
      method: "POST",
      headers: jsonHeaders(ctx.apiKey),
      body: buildImageBody(ctx, req),
      action: "image",
    };
  }

  return {
    url: base + "/v1/video/generations",
    method: "POST",
    headers: jsonHeaders(ctx.apiKey),
    body: buildVideoBody(ctx, req),
    action: "video",
  };
}

export function parseSubmitResponse(ctx, resp) {
  const result = resp.body || {};
  if (result.error) {
    const msg =
      typeof result.error === "string"
        ? result.error
        : trimmed(result.error.message) || "submit failed";
    throw new Error(msg);
  }
  const taskId = trimmed(result.task_id) || trimmed(result.id);
  if (!taskId) throw new Error("missing task_id");
  return { taskId: taskId, taskData: result };
}

export function buildQueryRequest(ctx) {
  const base = channelBaseUrl(ctx);
  const action = inferAction(ctx.upstreamModel || ctx.model, ctx.action);
  const path = action === "image" ? "/v1/images/tasks/" : "/v1/videos/tasks/";
  return {
    url: base + path + encodeURIComponent(ctx.taskId),
    method: "GET",
    headers: authHeaders(ctx.apiKey),
  };
}

/** Unwrap TaskDto {code,data} or flat OpenAI-style poll payloads. */
function unwrapPollBody(body) {
  if (!body || typeof body !== "object") return {};
  if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) {
    if (
      body.data.task_id ||
      body.data.status ||
      body.data.result_url ||
      body.data.result_urls ||
      (body.code !== undefined && body.data)
    ) {
      return body.data;
    }
  }
  return body;
}

function collectResultUrls(data) {
  const urls = [];
  const seen = {};
  const push = function (value) {
    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }
    const url = trimmed(value);
    if (!url || !/^https?:\/\//i.test(url)) return;
    if (seen[url]) return;
    seen[url] = true;
    urls.push(url);
  };

  if (!data || typeof data !== "object") return urls;
  push(data.result_urls);
  push(data.result_url);
  push(data.url);
  push(data.video_url);
  if (data.data && typeof data.data === "object") {
    push(data.data.result_urls);
    push(data.data.result_url);
    push(data.data.url);
  }
  return urls;
}

function mapPublicStatus(rawStatus) {
  const raw = trimmed(rawStatus);
  if (!raw) return { status: "UNKNOWN", reason: "missing task status" };

  const upper = raw.toUpperCase();
  if (upper === "NOT_START" || upper === "SUBMITTED") return { status: "SUBMITTED", reason: "" };
  if (upper === "QUEUED" || upper === "PENDING") return { status: "QUEUED", reason: "" };
  if (upper === "IN_PROGRESS" || upper === "RUNNING" || upper === "PROCESSING") {
    return { status: "IN_PROGRESS", reason: "" };
  }
  if (upper === "SUCCESS" || upper === "SUCCEEDED" || upper === "COMPLETED") {
    return { status: "SUCCESS", reason: "" };
  }
  if (upper === "FAILURE" || upper === "FAILED" || upper === "ERROR" || upper === "CANCELLED" || upper === "CANCELED") {
    return { status: "FAILURE", reason: "" };
  }
  if (upper === "EXPIRED") return { status: "FAILURE", reason: "task expired" };
  if (upper === "UNKNOWN") return { status: "UNKNOWN", reason: "unknown task status" };

  const lower = raw.toLowerCase();
  if (lower === "queued" || lower === "pending" || lower === "created") return { status: "QUEUED", reason: "" };
  if (lower === "in_progress" || lower === "running" || lower === "processing") {
    return { status: "IN_PROGRESS", reason: "" };
  }
  if (lower === "completed" || lower === "succeeded" || lower === "success") {
    return { status: "SUCCESS", reason: "" };
  }
  if (lower === "failed" || lower === "failure" || lower === "error") {
    return { status: "FAILURE", reason: "" };
  }

  return { status: "UNKNOWN", reason: "unknown task status: " + raw };
}

export function parseTaskResult(ctx, body) {
  const root = body && typeof body === "object" ? body : {};
  if (root.error && !root.status && !root.task_id && !root.id && !root.data) {
    const msg =
      typeof root.error === "string" ? root.error : trimmed(root.error.message) || "upstream error";
    return { status: "FAILURE", reason: msg };
  }

  const data = unwrapPollBody(root);
  if (data.error && !data.status && !data.task_id && !data.id) {
    const msg =
      typeof data.error === "string" ? data.error : trimmed(data.error.message) || "upstream error";
    return { status: "FAILURE", reason: msg };
  }

  const mapped = mapPublicStatus(data.status);
  if (mapped.status === "UNKNOWN") return mapped;

  const result = {
    status: mapped.status,
    reason:
      mapped.status === "FAILURE"
        ? mapped.reason ||
          trimmed(data.fail_reason) ||
          trimmed(data.error_msg) ||
          trimmed(data.error && data.error.message) ||
          ""
        : "",
  };

  const pct = Number(
    data.progress_pct !== undefined
      ? data.progress_pct
      : String(data.progress || "").replace("%", "")
  );
  if (Number.isFinite(pct) && pct >= 0) {
    const rawProgress = data.progress_pct !== undefined ? data.progress_pct : data.progress;
    const n =
      pct <= 1 && String(rawProgress || "").indexOf("%") < 0 ? Math.round(pct * 100) : Math.round(pct);
    result.progress = String(Math.min(100, n)) + "%";
  }

  if (mapped.status === "SUCCESS") {
    const urls = collectResultUrls(data);
    if (urls.length) result.url = urls[0];
  }
  return result;
}

function artifactData(ctx) {
  const data = (ctx && ctx.data) || {};
  if (
    data.data &&
    typeof data.data === "object" &&
    data.data.task_id &&
    Object.prototype.hasOwnProperty.call(data.data, "data")
  ) {
    return data.data.data || {};
  }
  return unwrapPollBody(data);
}

function artifactUrls(ctx) {
  return collectResultUrls(artifactData(ctx));
}

function artifactIsImage(task, data) {
  if (task && inferAction(task.model || (data && data.model), task.action) === "image") return true;
  if (trimmed(data.task_type) === "image" || trimmed(data.object) === "image") return true;
  if (isImageModel(data.model)) return true;
  const urls = artifactUrls(task || { data: data });
  if (urls.length && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(urls[0])) return true;
  return false;
}

export function listArtifacts(task) {
  if (task.status !== "SUCCESS") return [];
  const data = artifactData(task);
  const urls = artifactUrls(task);
  if (!urls.length) return [];
  if (artifactIsImage(task, data)) {
    return urls.map(function (_url, index) {
      return { key: index === 0 ? "image" : "image_" + (index + 1), type: "image" };
    });
  }
  return [{ key: "video", type: "video" }];
}

export function buildContentRequest(ctx) {
  const urls = artifactUrls(ctx);
  if (!urls.length) throw new Error("artifact_not_found");
  let index = 0;
  const key = trimmed(ctx.artifactKey);
  if (key === "video" || key === "image" || !key) index = 0;
  else {
    const match = /^image_(\d+)$/.exec(key);
    if (!match) throw new Error("artifact_not_found");
    index = Number(match[1]) - 1;
  }
  const url = urls[index];
  if (!url) throw new Error("artifact_not_found");
  return {
    url: url,
    method: (ctx.clientRequest && ctx.clientRequest.method) || "GET",
    credentialless: true,
  };
}

export const protocols = {
  openai_video: {
    decodeRequest: function (ctx) {
      if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart")) {
        throw new Error("JSON or multipart body required");
      }
      let req;
      let hasInputReferenceFile = false;
      if (ctx.body.kind === "json") {
        if (!ctx.body.value || Array.isArray(ctx.body.value)) throw new Error("JSON object required");
        req = Object.assign({}, ctx.body.value);
      } else {
        const first = function (name) {
          const values = (ctx.body.fields || {})[name] || [];
          if (values.length > 1) throw new Error(name + " must be provided once");
          return values[0];
        };
        req = {};
        const fields = ctx.body.fields || {};
        for (const name of Object.keys(fields)) {
          req[name] = first(name);
        }
        for (const file of ctx.body.files || []) {
          if (file.field !== "input_reference") throw new Error("unexpected file field: " + file.field);
          if (hasInputReferenceFile) throw new Error("input_reference must be provided once");
          hasInputReferenceFile = true;
        }
        if (req.metadata !== undefined) {
          let parsed;
          try {
            parsed = JSON.parse(req.metadata);
          } catch (e) {
            throw new Error("metadata must be a JSON object string");
          }
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("metadata must be a JSON object string");
          }
          req.metadata = parsed;
        }
        if (req.seconds !== undefined) req.seconds = Number(req.seconds);
        else if (req.duration !== undefined) req.seconds = Number(req.duration);
      }

      const model = ctx.model;
      if (!trimmed(model)) throw new Error("model is required");
      if (isImageModel(model)) throw new Error("image models must use POST /v1/images/create");

      const prompt = clientPrompt(req);
      if (!prompt) throw new Error("prompt is required");
      req.prompt = prompt;

      const picked = pickRequestDuration(req);
      if (picked !== undefined) req.duration = Number(picked);

      if (!hasInputReferenceFile) {
        const image = trimmed(req.input_reference || req.image);
        if (image) req.image = image;
      }

      return {
        kind: "submit",
        model: ctx.model,
        action: "video",
        requestBody: Object.assign({}, req, { model: ctx.model, prompt: prompt }),
      };
    },
    render: function (_ctx, task) {
      const statusMap = {
        NOT_START: "queued",
        SUBMITTED: "queued",
        QUEUED: "queued",
        IN_PROGRESS: "in_progress",
        SUCCESS: "completed",
        FAILURE: "failed",
      };
      const data = task.data && typeof task.data === "object" ? task.data : {};
      const output = {
        id: task.task_id,
        object: "video",
        model: "",
        status: statusMap[task.status] || "unknown",
        progress: Number(String(task.progress || "0").replace("%", "")),
        created_at: task.created_at || 0,
      };
      if (task.updated_at) output.completed_at = task.updated_at;
      if (task.status === "FAILURE") {
        output.error = { message: task.fail_reason || data.fail_reason || "task failed", code: "" };
      }
      return output;
    },
  },
};
