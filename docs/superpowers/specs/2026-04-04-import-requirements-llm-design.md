# 通过 LLM 导入需求组 — 设计文档（MVP）

## 1. 概述与目标

用户通过点击首页上传按钮，将外部数据（纯文本、CSV）导入到当前月结周期的需求组中。整个过程由大模型驱动，自动完成解析、分组和相似度匹配，最终由用户确认导入。

**核心价值**：减少手工录入成本，自动识别并匹配合已有需求组。

**MVP 范围**：
- ImportModal（输入态 + 预览态，含修改/合并/删除）
- POST /api/import/parse（LLM 解析 + 匹配）
- POST /api/import/confirm（批量创建/追加 Workload）
- 固定 MiniMax 供应商（环境变量配置）
- 不做 URL 抓取
- 不做 Admin 配置页

---

## 2. 功能范围

### 2.1 支持的输入类型

| 输入类型 | 检测方式 | 处理流程 |
|---|---|---|
| 纯文本 / CSV 内容 | 非 URL 内容 | 直接 LLM 解析 |
| CSV 文件上传 | 用户点击上传 | 读取文件内容 → 填充到文本框 → LLM 解析 |

### 2.2 LLM 单步处理

一次 LLM 调用，同时完成：
1. **结构化解析**：把原始数据解析成标准 JSON 结构
2. **语义匹配**：判断每条数据应归属到哪个已有需求组，或应新建

**LLM 输出结构**：

```json
{
  "groups": [
    {
      "name": "设计统筹",
      "action": "MATCH | CREATE_NEW",
      "matchedGroup": { "id": 42, "name": "设计统筹" },
      "matchReason": "语义高度相关，均涉及设计统筹工作",
      "items": [
        {
          "originalText": "设计 (4人天)",
          "manDays": 4,
          "designers": ["邵腾"]
        }
      ]
    }
  ]
}
```

**匹配逻辑**：
- LLM 直接判断 `MATCH`（匹配已有）/ `CREATE_NEW`（新建），并给出理由
- 阈值逻辑在后端简化处理

### 2.3 预览与确认

展示 LLM 解析结果，每张分组卡片显示：
- 组名（**可编辑**）
- 匹配动作标签：`MATCH → 已有「xxx」` / `CREATE_NEW`
- 条目列表（原始文本 + 解析出的人天）
- 删除按钮（删除单个条目）

**批量操作**：
- 多选卡片 → 合并为新组（重新生成需求组名称）
- 单卡删除按钮 → 整组不导入

确认后：
- `MATCH` → 追加 Workload 到已有需求组
- `CREATE_NEW` → 创建新需求组（其他字段留空）+ 创建 Workload

---

## 3. API 设计

### 3.1 `POST /api/import/parse`

解析原始输入，一次完成结构化 + 匹配。

**请求体**：
```json
{
  "content": "string",
  "cycleId": 1
}
```

**响应**：
```json
{
  "groups": [
    {
      "name": "设计统筹",
      "action": "MATCH | CREATE_NEW",
      "matchedGroup": { "id": 42, "name": "设计统筹" },
      "matchReason": "语义高度相关",
      "items": [
        {
          "originalText": "设计 (4人天)",
          "manDays": 4,
          "designers": ["邵腾"]
        }
      ]
    }
  ]
}
```

### 3.2 `POST /api/import/confirm`

用户确认导入。

**请求体**：
```json
{
  "cycleId": 1,
  "decisions": [
    {
      "name": "设计统筹",
      "action": "MERGE | CREATE",
      "targetGroupId": 42,
      "items": [{ "manDays": 4, "designers": ["邵腾"], "originalText": "设计 (4人天)" }]
    }
  ]
}
```

**响应**：
```json
{
  "results": [
    { "groupId": 42, "importedCount": 1 }
  ]
}
```

---

## 4. LLM Prompt（MVP 初版）

### System Prompt

```
你是一个设计师工作日志解析助手。你的任务是将用户输入的原始文本解析成结构化的需求组列表。

## 输入格式（每条记录结构）
avatarUI | 设计师姓名
calendar日期
项目/模块名称
sun总人天
#需求ID 【mm.dd】需求名称
工作类型 (数字人天)

## 解析规则
1. 每组 avatarUI... 到下一个 avatarUI 之前的内容视为一条完整记录
2. 从需求相关行中提取需求名称（灵活识别：可能包含 #需求ID、【日期】等前缀后缀，需去掉无关前缀后缀，保留核心需求名称）
3. "工作类型 (数字人天)" 中的数字为投入人天，归归属于前一条需求名称
4. 设计师名称为 avatarUI | 后面的姓名
5. 以下字段忽略：calendar日期、项目/模块名称（如"U5国内版"）、sun总人天

## 匹配逻辑
将每条记录的需求名称与以下已有需求组列表进行语义匹配：
- 如果语义高度相关 → action: "MATCH"，返回 matchedGroup
- 如果无相关已有需求组 → action: "CREATE_NEW"

已有需求组列表：
[这里动态传入]

## 输出要求
必须输出有效的 JSON，格式如下：
{
  "groups": [
    {
      "name": "需求组名称（从 #行提取）",
      "action": "MATCH | CREATE_NEW",
      "matchedGroup": { "id": 42, "name": "设计统筹" },
      "matchReason": "描述匹配理由",
      "items": [
        {
          "originalText": "设计 (4人天)",
          "manDays": 4,
          "designers": ["邵腾"]
        }
      ]
    }
  ]
}

## 注意事项
- manDays 必须是数字类型，支持小数（如 0.6）
- designers 填入实际的设计师名称字符串列表
- 输出只包含 JSON，不要有其他文字
- 无法解析的行请忽略
```

---

## 5. 组件结构

### 5.1 ImportModal

主 Modal，两个状态：
- **输入态**：文本框 + 上传附件按钮 + 提交按钮
- **预览态**：
  - 分组卡片列表（可编辑组名、可删除单个条目）
  - 多选卡片 → 合并为新组
  - 单卡删除按钮 → 整组不导入
  - 确认/取消按钮

### 5.2 后端 LLM Service

```typescript
// src/lib/llm.ts (MVP 固定 MiniMax)
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY
const MINIMAX_BASE_URL = 'https://api.minimax.chat/v1'
const MODEL = 'MiniMax-M2.7-highspeed'
```

### 5.3 设计师名称匹配

- 系统用户账号列表传给 LLM（用于设计名称匹配）
- 导入时尝试匹配账号名，匹配成功写入 `userId`，失败则忽略（该条目无 Workload）
- MVP 阶段默认设计师为「邵腾」

---

## 6. 错误处理

- CSV / 纯文本解析失败 → 展示错误，允许重试
- LLM 调用失败 → 展示错误，允许重试
- 匹配失败的设计师 → 该条 Workload 跳过，不阻断其他条目

---

## 7. MVP 不做

- URL 抓取（后续版本支持）
- Admin AI 设置页面（后续版本支持）
- LLM 供应商配置持久化（后续版本支持）
- 需求组展开态上传入口（后续版本支持）
- 需求组拆分（不需要）
