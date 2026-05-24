import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// 查询分析状态/结果
// 前端轮询 GET /api/analyze-status?id=xxx
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少分析ID' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('analyses')
      .select('id, result, overall_score, created_at')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '未找到分析记录' }, { status: 404 })
    }

    const result = data.result as Record<string, unknown>
    const status = result?.status || 'unknown'

    return NextResponse.json({
      id: data.id,
      status,               // pending / processing / completed / failed
      result: status === 'completed' ? result : null,
      overallScore: data.overall_score,
      createdAt: data.created_at,
    })

  } catch (error) {
    console.error('Status query error:', error)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}
