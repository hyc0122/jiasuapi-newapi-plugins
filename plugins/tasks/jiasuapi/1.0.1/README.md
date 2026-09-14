# jiasuapi@1.0.1

佳速API 任务插件。详见仓库根目录 [README.md](../../../../README.md)。

- Base URL 默认：`https://ai.jiasuapi.com`
- 鉴权：Bearer API Key
- 模型：以 `GET /v1/models` 为准；本版额外保证 `gpt-image-2.5-sunburst-1k`
- 公开调用：主机 jsapi（`/v1/video/generations`、`/v1/images/create`、tasks 查询）、`openai_video`（`/v1/videos*`）、原生调试 `/jiasuapi/...`
- 同步脚本：`node scripts/sync-models.mjs`（可选 `JIASU_API_KEY`）
