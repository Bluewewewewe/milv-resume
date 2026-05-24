import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// 面包多支付回调接口
// 用户在面包多付款后，面包多会通知这个接口
export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-mbd-signature')

    // TODO: 验证签名（防止伪造请求）
    // const expectedSig = crypto.createHmac('sha256', process.env.MBD_WEBHOOK_SECRET!).update(body).digest('hex')
    // if (signature !== expectedSig) return NextResponse.json({ error: 'invalid' }, { status: 401 })

    const payload = JSON.parse(body)
    const { order_no, status, custom_data } = payload

    if (status !== 'paid') {
      return NextResponse.json({ received: true })
    }

    // custom_data里我们传了userId
    const userId = custom_data?.userId
    const plan = custom_data?.plan || 'monthly'

    if (!userId) {
      return NextResponse.json({ error: 'missing userId' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 次数和时长映射
    const quotaMap: Record<string, number> = {
      basic_weekly: 5, basic_monthly: 12, basic_quarterly: 30,
      pro_weekly: 5, pro_monthly: 12, pro_quarterly: 30,
    }
    const durationMap: Record<string, number> = {
      basic_weekly: 7, basic_monthly: 30, basic_quarterly: 90,
      pro_weekly: 7, pro_monthly: 30, pro_quarterly: 90,
    }

    const quota = quotaMap[plan] || 12
    const days = durationMap[plan] || 30

    // 更新会员状态（次数不累计，直接覆盖为新配额）
    const { error } = await admin
      .from('memberships')
      .upsert({
        user_id: userId,
        plan,
        remaining_quota: quota,
        expires_at: new Date(Date.now() + days * 86400000).toISOString(),
        payment_method: 'mianbaoduo',
        payment_order: order_no,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('Payment callback error:', error)
      return NextResponse.json({ error: 'update failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'webhook failed' }, { status: 500 })
  }
}
