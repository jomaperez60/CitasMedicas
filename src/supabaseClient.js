import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://axrtijirrwukbsvhhrcl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cnRpamlycnd1a2JzdmhocmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzU4NTgsImV4cCI6MjA5MDgxMTg1OH0.lagZ357fYzNpYqDueCmcUkajTN6-S9XO-g7F5KIENQ8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
