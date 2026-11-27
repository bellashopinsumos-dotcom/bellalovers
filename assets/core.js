import { CONFIG, HAS_BACKEND } from './config.js';

let clientPromise;
export async function db(area = 'client') {
  if (!HAS_BACKEND) return null;
  if (!clientPromise) {
    clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.16/+esm')
      .catch(async firstError => {
        console.warn('Primera fuente de conexión no disponible, intentando la alternativa:', firstError?.message);
        return import('https://esm.sh/@supabase/supabase-js@2.47.16');
      })
      .then(({createClient}) => createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, storageKey: area === 'admin' ? 'bellalovers-admin-auth' : 'bellalovers-client-auth' },
      }))
      .catch(error => { clientPromise = null; throw error; });
  }
  return clientPromise;
}
export const $ = (selector, root=document) => root.querySelector(selector);
export const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
export const fmt = (number) => '$' + Number(number || 0).toLocaleString('es-CO');
export const date = (value) => value ? new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeZone:'America/Bogota'}).format(new Date(value)) : '—';
export function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function short(value, n=45) { const t=String(value??''); return t.length > n ? `${t.slice(0,n-1)}…` : t; }
export const TYPE = { iniciante: 'Iniciante', estudiante: 'Estudiante de uñas', manicurista: 'Manicurista / clienta frecuente', profesora: 'Profesora de uñas' };
export const DEFAULT_RULES = { min_purchase:50000, point_value:10000, unlock_points:50, student_gift_min:200000, cycle_months:12, grace_days:30, exclude_discounts:true, student_first_no_points:false, shop_url:CONFIG.shopUrl };
export function calcPoints(amount, rules=DEFAULT_RULES, discounted=false, validNumber=1, category='manicurista') {
  if (!Number.isFinite(Number(amount)) || Number(amount) < rules.min_purchase) return 0;
  if (rules.exclude_discounts && discounted) return 0;
  if (category === 'estudiante' && rules.student_first_no_points && validNumber === 1) return 0;
  return Math.floor(Number(amount) / rules.point_value);
}
export function referralPoints(amount, tiers=[{min:50000,points:1},{min:100000,points:2},{min:200000,points:4},{min:400000,points:6},{min:600000,points:8},{min:1000000,points:10}]) {
  return tiers.filter(t=>amount>=t.min).reduce((a,t)=>t.points,0);
}
export function notify(message, kind='ok') {
  const toast=$('#toast'); if(!toast) return;
  toast.textContent=message; toast.className='toast visible '+(kind==='error'?'error':'');
  clearTimeout(window.__bellaToast); window.__bellaToast=setTimeout(()=>toast.classList.remove('visible'),4200);
}
export function setLoading(btn, state, label='Procesando…') {
  if(!btn) return; if(state) {btn.dataset.old=btn.textContent;btn.disabled=true;btn.textContent=label;}
  else { btn.disabled=false; btn.textContent=btn.dataset.old||btn.textContent; }
}
export function safeUrl(url) { try { const u=new URL(url,location.href); return ['https:','http:'].includes(u.protocol) ? u.href : ''; }catch{return '';} }
export function putText(selector,text) { const e=$(selector); if(e) e.textContent=text; }
export function pill(text, alt='') { return `<span class="status ${alt}">${esc(text)}</span>`; }
