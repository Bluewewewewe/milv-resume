import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// 查询用户会员状态
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: '缺少用户ID' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('memberships')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      // 没有会员记录 = 免费用户
      return NextResponse.json({
        plan: 'free',
        remaining_quota: 3,
        expires_at: null,
      })
    }

    // 检查是否过期
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({
        plan: 'free',
        remaining_quota: 0,
        expires_at: data.expires_at,
        expired: true,
      })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Membership query error:', error)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}
