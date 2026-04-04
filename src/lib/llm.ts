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

// Ollama API (local)
async function callLLM(content: string, systemPrompt: string): Promise<string> {
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3:4b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      stream: false,
      reasoning_effort: 'none',  // disable thinking to avoid polluting JSON output
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LLM API error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.message?.content ?? ''
}

export function buildParsePrompt(
  rawContent: string,
  existingGroups: { id: number; name: string }[],
  systemUsers: string[]
): string {
  const groupsList = existingGroups.map(g => `- id:${g.id} name:"${g.name}"`).join('\n')
  const usersList = systemUsers.join(', ')

  return `你是一个设计师工作日志解析助手。你的任务是将用户输入的原始文本解析成结构化的需求组列表。

## 解析规则
1. 记录以 "avatarUI | 设计师姓名" 为起始标记，到下一个 "avatarUI |" 或文本末尾为止
2. avatarUI 行之后的连续3行固定为无效信息（跳过）：
   - calendar日期（如 "calendar2025-05-23"）
   - 项目/模块名称（如 "U5国内版"）
   - 当日总人天（如 "Usun10人天"）
3. 跳过 "excellent" 等块结束标记
4. 在每个 avatarUI 块内部，每个 "#数字" 行（如 "#329732"）上方的非空行即为该条目对应的需求组名称；如果两个 "#数字" 之间没有新的需求组名称，则沿用上一个需求组
5. "设计 (数字人天)" 等格式为投入人天，归属于最近一个已确定的需求组，同一组下累加

## 示例
输入：
avatarUI | 邵腾
calendar2025-05-23
U5国内版
Usun10人天
设计审核&统筹_5月
#329733 【05.28】设计统筹
设计 (6人天)
优化攻坚相关_5月
#329732 【05.21】设计统筹
设计 (4人天)

输出（必须是这个格式的 JSON，不要有任何其他文字）：
{"groups":[{"name":"设计审核&统筹_5月","action":"CREATE_NEW","matchedGroup":null,"matchReason":"","items":[{"originalText":"设计 (6人天)","manDays":6,"designers":["邵腾"]}]},{"name":"优化攻坚相关_5月","action":"CREATE_NEW","matchedGroup":null,"matchReason":"","items":[{"originalText":"设计 (4人天)","manDays":4,"designers":["邵腾"]}]}]}

## 匹配逻辑
将每条记录的需求名称与以下已有需求组列表进行语义匹配：
- 如果语义高度相关 → action: "MATCH"，返回 matchedGroup（只需返回 id 和 name）
- 如果无相关已有需求组 → action: "CREATE_NEW"

已有需求组列表：
${groupsList || '(无已有需求组)'}

系统用户账号：${usersList}

## 输出要求
**必须只输出 JSON**，不要有任何其他文字说明。JSON 格式如下：
{"groups":[{"name":"需求组名称","action":"CREATE_NEW","matchedGroup":null,"matchReason":"","items":[{"originalText":"设计 (0.5人天)","manDays":0.5,"designers":["邵腾"]}]}]}

## 注意事项
- manDays 必须是数字类型，支持小数（如 0.6）
- 同一需求组下多个工作项的人天需要累加
- designers 填入实际的设计师名称字符串列表`
}

export async function parseWorkload(
  rawContent: string,
  existingGroups: { id: number; name: string }[],
  systemUsers: string[]
): Promise<ParseResult> {
  const prompt = buildParsePrompt(rawContent, existingGroups, systemUsers)
  const response = await callLLM(rawContent, prompt)
  // Strip <think>...</think> blocks (qwen3 thinking output)
  let jsonStr = response
    .replace(/[\s\S]*?<\/think>/, '')  // strip everything up to and including </think>
    .replace(/```(?:json)?\n?/gi, '')  // strip ```json or ``` wrappers
    .replace(/```(?:json)?\n?/gi, '')  // strip ```json or ``` wrappers
    .replace(/^#.*$/gm, '')             // strip markdown headings like "# 结果"
    .trim()
  // Find JSON object bounds
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
  }
  return JSON.parse(jsonStr) as ParseResult
}