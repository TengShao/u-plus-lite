# 通过 LLM 导入需求组 — 设计文档

## 1. 概述与目标

用户通过点击首页上传按钮（或需求组展开态中的上传按钮），将外部数据（纯文本、CSV、网页 URL）导入到当前月结周期的需求组中。整个过程由大模型驱动，自动完成解析、分组和相似度匹配，最终由用户确认导入。

**核心价值**：减少手工录入成本，自动识别并匹配合已有需求组，支持灵活的数据来源。

---

## 2. 功能范围

### 2.1 支持的输入类型

| 输入类型 | 检测方式 | 处理流程 |
|---|---|---|
| 网页 URL | 以 `http://` 或 `https://` 开头 | 抓取页面 HTML → 提取正文 → LLM 解析 |
| 纯文本 / CSV 内容 | 非 URL 内容 | 直接 LLM 解析 |
| CSV 文件上传 | 用户点击"上传附件" | 读取文件内容 → LLM 解析 |

**自动判断逻辑**：输入内容以 `http://` 或 `https://` 开头 → URL 模式，否则 → 纯文本/CSV 模式。

### 2.2 LLM 单步处理

一次 LLM 调用，同时完成：
1. **结构化解析**：把原始数据解析成标准 JSON 结构
2. **语义匹配**：判断每条数据应归属到哪个已有需求组，或应新建

**LLM 输出结构**：

```json
{
  "groups": [
    {
      "name": "登录模块优化",
      "matchedRequirementGroup": {
        "id": 42,
        "name": "登录体验优化",
        "similarity": 0.85
      },
      "action": "AUTO_MERGE",
      "items": [
        {
          "originalText": "登录页面UI调整，3人天，张三、李四",
          "parsedData": {
            "manDays": 3,
            "designers": ["张三", "李四"]
          }
        }
      ]
    }
  ]
}
```

**匹配动作策略**：
- `similarity >= 0.8` → `AUTO_MERGE`，直接合并（不弹窗）
- `0.5 <= similarity < 0.8` → `ASK_MERGE`，询问用户
- `similarity < 0.5` 或无匹配 → `ASK_CREATE`，询问用户是否新建

**Prompt 设计要点**：
- 输入数据可能没有需求组名称，LLM 根据语义合并相关条目并生成组名
- 设计师名称需模糊匹配系统已有用户
- 人天数字可能以"3天"、"3人天"、"3d"等不同形式出现，需归一化
- 系统已有需求组列表作为上下文传给 LLM，用于相似度判断

### 2.3 预览与确认

展示 LLM 解析结果，用户可：

- 查看每个分组（组名、条目列表、匹配到的已有需求组）
- **合并两个组**（选中多个 → 合并为一个新组）
- **拆分一个组**（将一个组拆成多个）
- **删除某个条目**
- **确认导入**

确认后：
- `AUTO_MERGE` → 自动追加到已有需求组
- `ASK_MERGE` → 用户确认后追加到已有需求组
- `ASK_CREATE` → 用户确认后创建新需求组

---

## 3. API 设计

### 3.1 `POST /api/import/parse`

解析原始输入，一次完成结构化 + 匹配。

**请求体**：
```json
{
  "content": "string",
  "inputType": "url | text",
  "cycleId": "number"
}
```

**响应**：
```json
{
  "groups": [
    {
      "name": "登录模块优化",
      "matchedRequirementGroup": { "id": 42, "name": "登录体验优化", "similarity": 0.85 },
      "action": "AUTO_MERGE | ASK_MERGE | ASK_CREATE",
      "items": [
        {
          "originalText": "登录页面UI调整，3人天，张三、李四",
          "parsedData": { "manDays": 3, "designers": ["张三"] }
        }
      ]
    }
  ],
  "rawContent": "string"
}
```

### 3.2 `POST /api/import/confirm`

用户确认导入。

**请求体**：
```json
{
  "decisions": [
    {
      "groupName": "登录模块优化",
      "action": "MERGE | CREATE",
      "targetGroupId": 42,
      "items": [
        { "manDays": 3, "designers": ["张三"], "originalText": "..." }
      ]
    }
  ],
  "cycleId": "number"
}
```

**响应**：
```json
{
  "results": [
    { "groupId": 42, "importedCount": 2 },
    { "groupId": 99, "importedCount": 1 }
  ]
}
```

---

## 4. LLM 供应商配置

### 4.1 供应商列表

| 供应商 | 名称 | Base URL | 默认模型 | API Key 环境变量 |
|---|---|---|---|---|
| openai | OpenAI | `https://api.openai.com/v1` | gpt-4 | `OPENAI_API_KEY` |
| anthropic | Anthropic | `https://api.anthropic.com/v1` | claude-3-opus | `ANTHROPIC_API_KEY` |
| google | Google | `https://generativelanguage.googleapis.com/v1beta` | gemini-pro | `GOOGLE_API_KEY` |
| openrouter | OpenRouter | `https://openrouter.ai/api/v1` | openai/gpt-4 | `OPENROUTER_API_KEY` |
| kimi | Kimi | `https://api.moonshot.cn/v1` | moonshot-v1-8k | `MOONSHOT_API_KEY` |
| minimax | MiniMax | `https://api.minimax.chat/v1` | abab6.5-chat | `MINIMAX_API_KEY` |
| zai | Z.ai | `https://api.z.ai/v1` | glm-4 | `ZAI_API_KEY` |
| aliyun | Aliyun | `https://dashscope.aliyuncs.com/api/v1` | qwen-turbo | `DASHSCOPE_API_KEY` |
| deepseek | DeepSeek | `https://api.deepseek.com/v1` | deepseek-chat | `DEEPSEEK_API_KEY` |
| ollama | 本地/Ollama | `http://localhost:11434/api` | llama2 | 无需 |

### 4.2 供应商配置存储

新增 `LLMConfig` 数据库模型（Prisma），管理员通过设置界面配置：

```prisma
model LLMConfig {
  id                    String   @id @default("default")
  provider              String   // 供应商标识，如 "anthropic"
  name                  String   // 显示名称，如 "Anthropic Claude"
  baseUrl               String   // API Base URL
  model                 String   // 默认模型
  apiKey                String?  // API Key（可选，未填写时用环境变量）
  similarityThresholdHigh Float   @default(0.8)  // 高阈值 >= 此值直接合并
  similarityThresholdLow  Float   @default(0.5)  // 低阈值 < 此值建议新建
  isActive              Boolean  @default(true)
  updatedAt             DateTime @updatedAt
}
```

管理员可通过 `AdminSettingsModal` 的新 Tab 配置供应商切换和参数。

### 4.3 供应商切换

系统根据活跃配置（`isActive = true`）的供应商，加载对应的 LLM Provider。

---

## 5. 组件结构

### 5.1 `ImportModal`

主 Modal，两个状态：
- **输入态**：文本框 + 上传附件按钮 + 提交按钮
- **预览态**：分组卡片列表 + 操作按钮 + 确认/取消

### 5.2 `ImportPreview`

预览视图，包含分组卡片列表，支持用户合并/拆分/删除操作。

### 5.3 后端 `LLMService`

```typescript
interface LLMProvider {
  parseAndMatch(rawContent: string, existingGroups: RequirementGroup[], systemUsers: string[]): Promise<ParseAndMatchResult>
}

const providers: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(config),
  anthropic: new AnthropicProvider(config),
  google: new GoogleProvider(config),
  // ...
}

export function getActiveLLMProvider(): LLMProvider {
  // 从数据库读取活跃配置，加载对应 provider
}
```

---

## 6. 技术实现要点

### 6.1 URL 抓取

使用 `fetch` 抓取页面 HTML，通过 `turndown`（或类似工具）将 HTML 转为纯文本，再交给 LLM 解析。

### 6.2 文件上传

使用 `<input type="file" accept=".csv">` 接收 CSV 文件，读取为文本后交给 LLM 解析。

### 6.3 状态管理

Modal 内部状态：
- `step: 'input' | 'preview'`
- `rawContent: string`
- `groups: ParsedGroup[]`（用户可编辑）
- `isLoading: boolean`
- `error: string | null`

### 6.4 错误处理

- URL 抓取失败 → 提示用户并降级为纯文本解析
- LLM 调用失败 → 展示错误信息，允许用户重试
- 文件格式不支持 → 提示支持 CSV

---

## 7. 设置界面变更

在 `AdminSettingsModal` 中新增 Tab：**"AI 设置"**

- 供应商下拉选择（显示所有支持的供应商）
- Base URL（可编辑）
- 默认模型（可编辑）
- API Key（可填写，留空则使用环境变量）
- 相似度阈值（高/低，可调整，默认 0.8 / 0.5）
- 当前活跃供应商高亮显示
- 保存后切换活跃供应商

---