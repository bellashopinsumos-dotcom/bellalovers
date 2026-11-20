// CONFIGURACIÓN DE BELLALOVERS - solo la URL y publishable key de Supabase.
// Nunca coloques aquí service_role / secret keys.
export const CONFIG = {
  supabaseUrl: 'https://xpnfdyfnaromfwkontid.supabase.co',
  supabasePublishableKey: 'sb_publishable_rDPaAHVm_DuCL7FBvQZ12Q_B24XlTcl',
  shopUrl: 'https://bellashopinsumos-dotcom.github.io/bella-shop-pruebas/',
  brand: 'BellaLovers',
  // Las inscripciones se abren desde Configuración del administrador,
  // después de validar la política de datos y el proveedor de SMS.
};
export const HAS_BACKEND = Boolean(CONFIG.supabaseUrl && CONFIG.supabasePublishableKey);
