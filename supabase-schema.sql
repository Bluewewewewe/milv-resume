-- ========================================
-- 觅履(MILV) 数据库建表脚本
-- 在 Supabase SQL Editor 中运行
-- ========================================

-- 1. 用户表（Supabase Auth自动创建auth.users，这个表扩展用户信息）
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 会员表
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',        -- free / annual / lifetime
  remaining_quota INTEGER NOT NULL DEFAULT 3,
  expires_at TIMESTAMPTZ,
  payment_method TEXT,                       -- mianbaoduo / wechat / alipay / redeem
  payment_order TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 兑换码表
CREATE TABLE IF NOT EXISTS public.redeem_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,                 -- MILV-XXXX-XXXX 格式
  plan_type TEXT NOT NULL,                   -- free_3 / annual / lifetime
  is_used BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  used_by UUID REFERENCES public.profiles(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  note TEXT                                  -- 备注：给谁的、为什么发
);

-- 4. 分析记录表（用户每次分析都存一份）
CREATE TABLE IF NOT EXISTS public.analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resume_text TEXT,
  job_description TEXT,
  result JSONB,                              -- AI返回的完整分析结果
  overall_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS策略（行级安全）
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- 用户只能看自己的profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 用户只能看自己的会员状态
CREATE POLICY "Users can view own membership" ON public.memberships
  FOR SELECT USING (auth.uid() = user_id);

-- 用户只能看自己的分析记录
CREATE POLICY "Users can view own analyses" ON public.analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses" ON public.analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. 自动创建profile的触发器（用户注册时自动建profile）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO public.memberships (user_id, plan, remaining_quota)
  VALUES (NEW.id, 'free', 3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. 插入测试兑换码
INSERT INTO public.redeem_codes (code, plan_type, note) VALUES
  ('MILV-TEST-1234', 'free_3', '测试用兑换码'),
  ('MILV-VIP0-2025', 'annual', '年度会员测试码'),
  ('MILV-FREE-DEMO', 'free_3', '演示用免费码');
