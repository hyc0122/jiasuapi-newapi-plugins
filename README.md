# 佳速API · NewAPI 任务插件市场源

面向 **其他 NewAPI 实例** 的 GitHub 市场源：安装本仓库中的 `jiasuapi` 任务插件后，可将 [佳速API](https://ai.jiasuapi.com/) 作为图片 / 视频生成上游。

- 官方地址：https://ai.jiasuapi.com/
- 插件 key：`jiasuapi`
- 当前版本：`1.0.1`
- 描述：佳速API中转平台（图片、视频中转平台）。官方地址：https://ai.jiasuapi.com/
- 市场源 `index.json`（raw）：

```text
https://raw.githubusercontent.com/hyc0122/jiasuapi-newapi-plugins/main/index.json
```

## 下游安装步骤（简要）

### 1. 添加市场源

1. 以管理员登录你的 NewAPI 控制台
2. 打开 **任务插件 → 市场源**
3. 新增源，名称任意（如「佳速API」），URL 填上面的 raw `index.json`
4. 保存后刷新市场列表，应能看到 **佳速API**

### 2. 安装插件

1. 在市场中找到 **佳速API**（`jiasuapi@1.0.1`）
2. 安装并启用
3. 也可手动上传本仓库 `plugins/tasks/jiasuapi/1.0.1/plugin.js`

### 3. 创建 Task Plugin 渠道

1. 新建渠道，类型选择 **任务插件**（Task Plugin）
2. **绑定插件**：`jiasuapi`
3. **Base URL**：`https://ai.jiasuapi.com`（不要末尾斜杠；留空时插件默认也用该地址）
4. **密钥**：填写佳速API 的 Bearer API Key（`sk-…`）
5. **模型**：以渠道侧可见模型为准；权威列表见下方「模型列表」

> 本插件不声明 `channelTypes`，请始终使用「任务插件」渠道绑定。

## 模型列表

**以佳速公开接口 `GET /v1/models` 为准**（需带佳速 Base URL + API Key）。本版额外保证注册：

- `gpt-image-2.5-sunburst-1k`（单连字符；已移除错误的 `gpt-image-2.5--sunburst-1k`）

插件包内的 `meta.models` 只是发布时的快照，便于市场卡片展示与渠道勾选；线上增减模型请以 `GET /v1/models` 结果为准，并可用仓库脚本重新同步后发新版：

```bash
# 优先拉 /v1/models；无 Key 或 401 时回退公开 /api/pricing，并强制写入 sunburst
JIASU_API_KEY=sk-... node scripts/sync-models.mjs --version 1.0.1
```

查询示例：

```bash
curl -sS "https://ai.jiasuapi.com/v1/models" \
  -H "Authorization: Bearer $JIASU_API_KEY"
```

## 三层路径说明

下游 NewAPI 上实际暴露的调用面分三层；插件只声明原生调试路由，**不会**把主机公开路径写进 `meta.routes`（否则会挤占主机路由）。

### 1) 主机 jsapi 公开路径（推荐）

由 **NewAPI 主机** 提供，转发到本插件 Driver（`buildSubmitRequest` / `buildQueryRequest` 等），上游映射到佳速：

| 方法 | 下游路径 | 映射到佳速 |
| --- | --- | --- |
| `GET` | `/v1/models` | `GET https://ai.jiasuapi.com/v1/models`（主机/渠道侧模型发现；请用佳速 Key） |
| `POST` | `/v1/video/generations` | `POST /v1/video/generations` |
| `GET` | `/v1/videos/tasks/:task_id` | `GET /v1/videos/tasks/:task_id` |
| `POST` | `/v1/images/create` | `POST /v1/images/create` |
| `GET` | `/v1/images/tasks/:task_id` | `GET /v1/images/tasks/:task_id` |

### 2) `openai_video` 协议路径

插件在 `meta.protocols` 中声明 `openai_video`（视频模型）。主机 Pin 后可用 OpenAI Videos 形态：

| 方法 | 下游路径 | 说明 / 佳速映射 |
| --- | --- | --- |
| `POST` | `/v1/videos` | create → 插件 decode 后走 `POST /v1/video/generations` |
| `GET` | `/v1/videos/:task_id` | retrieve → 插件 render；查询佳速 `GET /v1/videos/tasks/:id` |
| `GET`/`HEAD` | `/v1/videos/:task_id/content` | content → `listArtifacts` / `buildContentRequest`（公开 CDN URL，credentialless） |

### 3) 原生调试路径 `/jiasuapi/...`

插件 `meta.routes` 声明，便于直接打插件原生编解码（不经主机 jsapi 封装）：

| 方法 | 路径 | 映射到佳速 |
| --- | --- | --- |
| `POST` | `/jiasuapi/v1/videos/generations` | `POST /v1/video/generations` |
| `POST` | `/jiasuapi/v1/images/create` | `POST /v1/images/create` |
| `GET` | `/jiasuapi/v1/videos/tasks/:task_id` | `GET /v1/videos/tasks/:task_id` |
| `GET` | `/jiasuapi/v1/images/tasks/:task_id` | `GET /v1/images/tasks/:task_id` |

## 调用示例

视频（主机 jsapi）：

```bash
curl -sS -X POST "$YOUR_NEW_API/v1/video/generations" \
  -H "Authorization: Bearer $YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "seedance-2.5-101010",
    "prompt": "城市夜景延时",
    "duration": 5,
    "ratio": "16:9",
    "resolution": "720p"
  }'
```

图片：

```bash
curl -sS -X POST "$YOUR_NEW_API/v1/images/create" \
  -H "Authorization: Bearer $YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-image-2.5-sunburst-1k",
    "prompt": "一只柴犬坐在樱花树下"
  }'
```

查询：

- 视频：`GET /v1/videos/tasks/:task_id`
- 图片：`GET /v1/images/tasks/:task_id`

## 仓库结构

```text
index.json
README.md
scripts/sync-models.mjs
plugins/tasks/jiasuapi/1.0.0/plugin.js
plugins/tasks/jiasuapi/1.0.1/plugin.js
```

## 本地校验

```bash
node --check plugins/tasks/jiasuapi/1.0.1/plugin.js
sha256sum plugins/tasks/jiasuapi/1.0.1/plugin.js   # 应与 index.json versions[].sha256 一致
```

若本机有 NewAPI 源码：

```bash
go run . plugin lint /path/to/plugins/tasks/jiasuapi/1.0.1/plugin.js
```
