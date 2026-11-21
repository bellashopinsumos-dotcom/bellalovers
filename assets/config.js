// CONFIGURACIÓN DE BELLALOVERS - solo la URL y publishable key de Supabase.
// Nunca coloques aquí service_role / secret keys.
export const CONFIG = {
  supabaseUrl: 'https://xpnfdyfnaromfwkontid.supabase.co',
  supabasePublishableKey: 'sb_publishable_rDPaAHVm_DuCL7FBvQZ12Q_B24XlTcl',
  shopUrl: 'https://bellashopinsumos-dotcom.github.io/bella-shop-pruebas/',
  brand: 'BellaLovers',
  // Las solicitudes de ingreso se abren desde Configuración,
  // solo después de aprobar la política de datos definitiva.
  // Las clientas consultan su cuenta con celular o correo y nombre, sin clave ni aprobación del inicio de sesión.
};
export const HAS_BACKEND = Boolean(CONFIG.supabaseUrl && CONFIG.supabasePublishableKey);
