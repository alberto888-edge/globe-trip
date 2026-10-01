// Datos del titular de la web. La LSSI obliga a publicarlos de forma
// "permanente, fácil, directa y gratuita".
//
// ⚠️ RELLENA LOS TRES VALORES DE ABAJO ANTES DE ENVIAR NADA A UNA RED DE AFILIACIÓN.
// Es lo único que queda por completar en todo el bloque legal.
export const OWNER = {
  name: "Alberto Alía",
  taxId: "PENDIENTE",          // NIF/DNI con letra
  email: "PENDIENTE",          // correo de contacto público
  country: "España",
};

export const SITE = {
  name: "Globe Trip",
  url: "https://globe-trip-tau.vercel.app",
};

export const LAST_UPDATED = "1 de octubre de 2026";

/** true cuando los datos obligatorios están puestos. */
export const legalReady = () => OWNER.taxId !== "PENDIENTE" && OWNER.email !== "PENDIENTE";
