
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qrjoavkoohdvicelezjw.supabase.co';
// 주의: 실제 배포 시 환경 변수(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)를 사용해야 합니다.
// 로컬 테스트를 위해 .env.local 파일에 키를 추가해주세요.
// 빌드 오류 방지를 위해 기본값 추가 (Vercel 배포 시 환경변수가 없어도 빌드는 성공하도록)
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key-for-build';

export const supabase = createClient(supabaseUrl, supabaseKey);
