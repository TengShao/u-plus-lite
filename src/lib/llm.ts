// src/lib/llm.ts

export interface LLMConfig {
  apiKey: string
  baseUrl: string
  model: string
}

export interface ParsedItem {
  originalText: string
  manDays: number
  designers: string[]
}

export interface ParsedGroup {
  name: string
  action: 'MATCH' | 'CREATE_NEW'
  matchedGroup: { id: number; name: string } | null
  matchReason: string
  items: ParsedItem[]
}

export interface ParseResult {
  groups: ParsedGroup[]
}

// MiniMax API compatible with OpenAI format
async function callLLM(content: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set')

  const res = await fetch('https://api.minimax.chat/v1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-M2.7-highspeed',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LLM API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export function buildParsePrompt(
  rawContent: string,
  existingGroups: { id: number; name: string }[],
  systemUsers: string[]
): string {
  const groupsList = existingGroups.map(g => `- id:${g.id} name:"${g.name}"`).join('\n')
  const usersList = systemUsers.join(', ')

  return `你是一个设计师工作日志解析助手。你的任务是将用户输入的原始文本解析成结构化的需求组列表。

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
- 如果语义高度相关 → action: "MATCH"，返回 matchedGroup（只需返回 id 和 name）
- 如果无相关已有需求组 → action: "CREATE_NEW"

已有需求组列表：
${groupsList || '(无已有需求组)'}

系统用户账号：${usersList}

## 输出要求
必须输出有效的 JSON，格式如下：
{
  "groups": [
    {
      "name": "需求组名称",
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
- 无法解析的行请忽略`
}

export async function parseWorkload(
  rawContent: string,
  existingGroups: { id: number; name: string }[],
  systemUsers: string[]
): Promise<ParseResult> {
  const prompt = buildParsePrompt(rawContent, existingGroups, systemUsers)
  const response = await callLLM(rawContent, prompt)
  // Strip markdown code blocks if present
  const jsonStr = response.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(jsonStr) as ParseResult
}