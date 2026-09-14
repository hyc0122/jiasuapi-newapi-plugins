# 佳速API · NewAPI 任务插件市场源

面向 **其他 NewAPI 实例** 的 GitHub 市场源：安装本仓库中的 `jiasuapi` 任务插件后，可将 [佳速API](https://ai.jiasuapi.com/) 作为图片 / 视频生成上游。

- 官方地址：https://ai.jiasuapi.com/
- 插件 key：`jiasuapi`
- 当前版本：`1.0.0`
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

1. 在市场中找到 **佳速API**（`jiasuapi@1.0.0`）  
2. 安装并启用  
3. 也可手动上传本仓库 `plugins/tasks/jiasuapi/1.0.0/plugin.js`

### 3. 创建 Task Plugin 渠道

1. 新建渠道，类型选择 **任务插件**（Task Plugin）  
2. **绑定插件**：`jiasuapi`  
3. **Base URL**：`https://ai.jiasuapi.com`（不要末尾斜杠；留空时插件默认也用该地址）  
4. **密钥**：填写佳速API 的 Bearer API Key（`sk-…`）  
5. **模型**：勾选需要开放的模型（见下表）

> 本插件不声明 `channelTypes`，请始终使用「任务插件」渠道绑定。

### 4. 调用示例

视频：

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
    "model": "gpt-image-2.5--sunburst-1k",
    "prompt": "一只柴犬坐在樱花树下"
  }'
```

查询：

- 视频：`GET /v1/videos/tasks/:task_id`
- 图片：`GET /v1/images/tasks/:task_id`

## 模型列表（1.0.0）

| 模型 ID | 类型 |
| --- | --- |
| `seedance-2.0-900` | 视频 |
| `seedance-2.0-933` | 视频 |
| `seedance-2.5-900` | 视频 |
| `seedance-2.5-101010` | 视频 |
| `seedance-2.5-303030` | 视频 |
| `sd-2.0-as` | 视频 |
| `sd-2.0-js` | 视频 |
| `sd-2.5-js` | 视频 |
| `jimeng-5.0` | 图片 |
| `k1-gpt-image-2.5` | 图片 |
| `gpt-image-2.5--sunburst-1k` | 图片 |

后续可在新版本中继续追加公开模型别名。

## 公开路径说明

以下路径由 **NewAPI 主机** 提供，本插件 **不会** 在 `meta.routes` 中声明它们：

| 方法 | 路径 |
| --- | --- |
| `POST` | `/v1/video/generations` |
| `GET` | `/v1/videos/tasks/:task_id` |
| `POST` | `/v1/images/create` |
| `GET` | `/v1/images/tasks/:task_id` |
| `POST` | `/v1/videos`（`openai_video`） |

插件原生调试路径（可选）：

| 方法 | 路径 |
| --- | --- |
| `POST` | `/jiasuapi/v1/videos/generations` |
| `POST` | `/jiasuapi/v1/images/create` |
| `GET` | `/jiasuapi/v1/videos/tasks/:task_id` |
| `GET` | `/jiasuapi/v1/images/tasks/:task_id` |

## 仓库结构

```text
index.json
plugins/tasks/jiasuapi/1.0.0/plugin.js
README.md
```

## 本地校验

若本机有 NewAPI 源码：

```bash
go run . plugin lint /path/to/plugins/tasks/jiasuapi/1.0.0/plugin.js
```

或仅做语法检查：

```bash
node --check plugins/tasks/jiasuapi/1.0.0/plugin.js
```
