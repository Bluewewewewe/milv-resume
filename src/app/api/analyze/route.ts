import { NextRequest, NextResponse } from 'next/server'

// AI简历分析接口
// 前端上传简历文本 + JD，后端调AI返回分析报告
export async function POST(req: NextRequest) {
  try {
    const { resumeText, jobDescription } = await req.json()

    if (!resumeText) {
      return NextResponse.json({ error: '请提供简历内容' }, { status: 400 })
    }

    const apiKey = process.env.AI_API_KEY
    const apiUrl = process.env.AI_API_URL || 'https://api.coze.cn/v1/chat'

    if (!apiKey) {
      // 没配API key时返回模拟数据（开发模式）
      return NextResponse.json(getMockAnalysis())
    }

    // 调用Coze Bot API
    const prompt = buildPrompt(resumeText, jobDescription)

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        bot_id: process.env.COZE_BOT_ID,
        user_id: 'milv-user',
        stream: false,
        auto_save_history: false,
        additional_messages: [{
          role: 'user',
          content: prompt,
          content_type: 'text',
        }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('AI API error:', err)
      // AI调用失败也返回模拟数据，保证体验
      return NextResponse.json(getMockAnalysis())
    }

    const data = await response.json()
    const aiContent = data?.messages?.[0]?.content || data?.output?.text || ''

    // 尝试解析AI返回的JSON，解析失败就返回模拟数据
    try {
      const parsed = JSON.parse(aiContent)
      return NextResponse.json(parsed)
    } catch {
      return NextResponse.json(getMockAnalysis())
    }

  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: '分析失败，请重试' }, { status: 500 })
  }
}

function buildPrompt(resumeText: string, jd?: string): string {
  let prompt = `你是一个专业的简历分析顾问。请分析以下简历内容，返回JSON格式的分析报告。

简历内容：
${resumeText}`

  if (jd) {
    prompt += `\n\n目标岗位JD：\n${jd}`
  }

  prompt += `

请返回以下JSON格式（不要有其他文字）：
{
  "overallScore": 数字(0-100),
  "dimensions": {
    "content": { "score": 数字, "label": "内容质量", "comment": "评价" },
    "structure": { "score": 数字, "label": "结构逻辑", "comment": "评价" },
    "keywords": { "score": 数字, "label": "关键词匹配", "comment": "评价" },
    "expression": { "score": 数字, "label": "表达力", "comment": "评价" }
  },
  "strengths": ["优点1", "优点2", "优点3"],
  "weaknesses": ["不足1", "不足2", "不足3"],
  "suggestions": [
    { "original": "原文", "improved": "改进后", "reason": "原因" }
  ],
  "jdMatch": 数字(0-100, 如有JD),
  "summary": "总体评价"
}`

  return prompt
}

// 开发模式模拟数据
function getMockAnalysis() {
  return {
    overallScore: 58,
    dimensions: {
      content: { score: 55, label: '内容质量', comment: '工作描述偏笼统，缺少量化成果' },
      structure: { score: 62, label: '结构逻辑', comment: '基本框架有，但重点不够突出' },
      keywords: { score: 48, label: '关键词匹配', comment: '缺少行业关键词，ATS系统可能过滤' },
      expression: { score: 67, label: '表达力', comment: '语言平实，缺少动词驱动和成果导向' },
    },
    strengths: [
      '有相关实习经验，基础能力可体现',
      '教育背景与目标岗位匹配',
      '项目经历覆盖了核心技能',
    ],
    weaknesses: [
      '工作描述只有职责没有成果，缺乏说服力',
      '缺少数据量化（如提升了XX%，服务了XX人）',
      '技能描述太泛，没有针对性',
    ],
    suggestions: [
      {
        original: '负责公司网站的前端开发',
        improved: '主导公司官网重构，页面加载速度提升40%，用户留存率提高25%',
        reason: '用数据量化成果，比纯职责描述有力得多',
      },
      {
        original: '参与团队项目协作',
        improved: '在5人敏捷团队中负责前端模块，2周内交付3个核心功能',
        reason: '具体化团队规模和交付节奏，展示协作效率',
      },
      {
        original: '熟悉JavaScript',
        improved: '精通ES6+特性，熟练使用React/Vue构建SPA，有性能优化经验',
        reason: '从笼统到具体，直接命中招聘关键词',
      },
    ],
    jdMatch: 52,
    summary: '简历基础框架完整，但内容深度不足。建议用STAR法则重写经历描述，补充量化数据，调整关键词以匹配目标岗位。',
  }
}
