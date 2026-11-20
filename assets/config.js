// CONFIGURACIÓN DE BELLALOVERS - solo la URL y publishable key de Supabase.
// Nunca coloques aquí service_role / secret keys.
export const CONFIG = {
  supabaseUrl: '',
  supabasePublishableKey: '',
  shopUrl: 'https://bellashopinsumos-dotcom.github.io/bella-shop-pruebas/',
  brand: 'BellaLovers',
  // Activar SOLO después de aprobar y publicar la política de datos definitiva.
  legalPolicyApproved: false,
};
export const HAS_BACKEND = Boolean(CONFIG.supabaseUrl && CONFIG.supabasePublishableKey);
