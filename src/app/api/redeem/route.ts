import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// 兑换码兑换接口
export async function POST(req: NextRequest) {
  try {
    const { code, userId } = await req.json()

    if (!code || !userId) {
      return NextResponse.json({ error: '缺少兑换码或用户信息' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. 查兑换码
    const { data: redeemCode, error: fetchError } = await admin
      .from('redeem_codes')
      .select('*')
      .eq('code', code)
      .eq('is_used', false)
      .single()

    if (fetchError || !redeemCode) {
      return NextResponse.json({ error: '兑换码无效或已使用' }, { status: 404 })
    }

    // 2. 标记兑换码已用
    const { error: updateError } = await admin
      .from('redeem_codes')
      .update({
        is_used: true,
        used_by: userId,
        used_at: new Date().toISOString(),
      })
      .eq('id', redeemCode.id)

    if (updateError) {
      return NextResponse.json({ error: '兑换失败' }, { status: 500 })
    }

    // 3. 激活会员
    const planMap: Record<string, string> = {
      'free_2': 'free',
      'basic_weekly': 'basic_weekly',
      'basic_monthly': 'basic_monthly',
      'basic_quarterly': 'basic_quarterly',
      'pro_weekly': 'pro_weekly',
      'pro_monthly': 'pro_monthly',
      'pro_quarterly': 'pro_quarterly',
    }
    const plan = planMap[redeemCode.plan_type] || 'free'
    const quotaMap: Record<string, number> = {
      'free': 2,
      'basic_weekly': 5, 'basic_monthly': 12, 'basic_quarterly': 30,
      'pro_weekly': 5, 'pro_monthly': 12, 'pro_quarterly': 30,
    }
    const durationDays: Record<string, number> = {
      'free': 365,
      'basic_weekly': 7, 'basic_monthly': 30, 'basic_quarterly': 90,
      'pro_weekly': 7, 'pro_monthly': 30, 'pro_quarterly': 90,
    }

    const { error: memberError } = await admin
      .from('memberships')
      .upsert({
        user_id: userId,
        plan: plan,
        remaining_quota: quotaMap[plan],
        expires_at: new Date(Date.now() + durationDays[plan] * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (memberError) {
      return NextResponse.json({ error: '会员激活失败' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      plan,
      message: plan === 'free' ? '获得3次免费优化机会！' :
               plan === 'annual' ? '年度会员已激活！' : '终身会员已激活！',
    })

  } catch (error) {
    console.error('Redeem error:', error)
    return NextResponse.json({ error: '兑换失败，请重试' }, { status: 500 })
  }
}
