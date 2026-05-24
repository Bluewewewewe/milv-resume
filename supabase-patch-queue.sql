-- 觅履(MILV) 数据库补丁 — 异步队列支持
-- 在Supabase SQL Editor中运行

-- 1. 配额扣减函数
CREATE OR REPLACE FUNCTION public.decrement_quota(user_id_input UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.memberships
  SET remaining_quota = GREATEST(remaining_quota - 1, 0),
      updated_at = NOW()
  WHERE user_id = user_id_input
    AND plan = 'free'
    AND remaining_quota > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. 给analyses表加status字段（如果之前建表没加）
-- result字段里的status是JSON里的，但加一个列索引查询更快
CREATE INDEX IF NOT EXISTS idx_analyses_result_status ON public.analyses 
  USING gin ((result->'status'));

-- 3. 兑换码批量生成函数（方便后台管理）
CREATE OR REPLACE FUNCTION public.generate_redeem_codes(
  p_plan_type TEXT,
  p_count INTEGER DEFAULT 10,
  p_note TEXT DEFAULT ''
)
RETURNS TABLE(code TEXT, plan_type TEXT) AS $$
DECLARE
  i INTEGER;
  new_code TEXT;
  prefix TEXT;
BEGIN
  prefix := CASE p_plan_type
    WHEN 'free_3' THEN 'MILV-FREE'
    WHEN 'annual' THEN 'MILV-VIP'
    WHEN 'lifetime' THEN 'MILV-LT'
    ELSE 'MILV'
  END;

  FOR i IN 1..p_count LOOP
    new_code := prefix || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    
    INSERT INTO public.redeem_codes (code, plan_type, note)
    VALUES (new_code, p_plan_type, p_note)
    ON CONFLICT (code) DO NOTHING;
    
    code := new_code;
    plan_type := p_plan_type;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 测试：生成5个免费兑换码
-- SELECT * FROM public.generate_redeem_codes('free_3', 5, '批量测试');
