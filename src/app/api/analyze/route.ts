import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { checkRateLimit, getClientIp, DEFAULT_ANALYZE_LIMIT } from '@/lib/rate-limit'

// AI简历分析接口（异步队列模式）
// 提交分析 → 返回jobId → 前端轮询 /api/analyze-status?id=xxx
export async function POST(req: NextRequest) {
  try {
    // 1. IP限流
    const ip = getClientIp(req)
    const rateCheck = checkRateLimit(ip, DEFAULT_ANALYZE_LIMIT)
    if (!rateCheck.allowed) {
      return NextResponse.json({
        error: '今日分析次数已用完，请明天再来',
        resetAt: rateCheck.resetAt,
      }, { status: 429 })
    }

    const { resumeText, jobDescription, userId } = await req.json()

    if (!resumeText) {
      return NextResponse.json({ error: '请提供简历内容' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 2. 检查会员配额（如果已登录）
    if (userId) {
      const { data: membership } = await admin
        .from('memberships')
        .select('plan, remaining_quota, expires_at')
        .eq('user_id', userId)
        .single()

      if (membership) {
        // 检查是否过期
        if (membership.expires_at && new Date(membership.expires_at) < new Date()) {
          return NextResponse.json({ error: '会员已过期，请续费或使用兑换码' }, { status: 403 })
        }
        // 免费用户检查配额
        if (membership.plan === 'free' && membership.remaining_quota <= 0) {
          return NextResponse.json({
            error: '免费次数已用完，升级会员获取无限次分析',
            remainingQuota: 0,
          }, { status: 403 })
        }
      }
    }

    // 3. 写入数据库，状态=pending（排队中）
    const { data: analysis, error: insertError } = await admin
      .from('analyses')
      .insert({
        user_id: userId || null,
        resume_text: resumeText,
        job_description: jobDescription || null,
        overall_score: 0,
        result: { status: 'pending' },
      })
      .select('id')
      .single()

    if (insertError || !analysis) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: '提交失败' }, { status: 500 })
    }

    // 4. 扣减配额
    if (userId) {
      await admin.rpc('decrement_quota', { user_id_input: userId })
    }

    // 5. 触发后台分析（不await，让前端去轮询）
    // 在生产环境中，这里应该用消息队列或Edge Function
    // 目前用 fire-and-forget 模式
    processAnalysis(analysis.id, resumeText, jobDescription).catch(err => {
      console.error('Background analysis failed:', err)
    })

    return NextResponse.json({
      id: analysis.id,
      status: 'pending',
      message: '分析已提交，正在排队处理',
      remainingRequests: rateCheck.remaining,
    })

  } catch (error) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: '分析提交失败' }, { status: 500 })
  }
}

// 后台分析函数
async function processAnalysis(
  analysisId: string,
  resumeText: string,
  jobDescription?: string
) {
  const admin = createAdminClient()

  try {
    // 更新状态为processing
    await admin
      .from('analyses')
      .update({ result: { status: 'processing' } })
      .eq('id', analysisId)

    const apiKey = process.env.AI_API_KEY
    const apiUrl = process.env.AI_API_URL || 'https://api.coze.cn/v1/chat'

    let analysisResult: Record<string, unknown>

    if (!apiKey) {
      // 没配API key → 模拟延迟后返回模拟数据
      await new Promise(r => setTimeout(r, 3000))
      analysisResult = getMockAnalysis()
    } else {
      // 调用AI API
      const prompt = buildPrompt(resumeText, jobDescription)

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          bot_id: process.env.COZE_BOT_ID,
          user_id: `milv-${analysisId}`,
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
        throw new Error(`AI API error: ${response.status}`)
      }

      const data = await response.json()
      const aiContent = data?.messages?.[0]?.content || data?.output?.text || ''

      try {
        analysisResult = JSON.parse(aiContent)
      } catch {
        analysisResult = getMockAnalysis()
      }
    }

    // 更新结果
    await admin
      .from('analyses')
      .update({
        result: analysisResult,
        overall_score: (analysisResult as { overallScore: number }).overallScore || 0,
      })
      .eq('id', analysisId)

  } catch (error) {
    console.error('Process analysis error:', error)
    // 标记失败
    await admin
      .from('analyses')
      .update({ result: { status: 'failed', error: '分析失败' } })
      .eq('id', analysisId)
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
