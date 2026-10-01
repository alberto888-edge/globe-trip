import type { Metadata } from "next";
import { OWNER, SITE } from "@/lib/legal";

export const metadata: Metadata = { title: "Aviso legal · Globe Trip" };

export default function Page() {
  return (
    <>
      <h1>Aviso legal</h1>
      <p>
        En cumplimiento de la Ley 34/2002 de Servicios de la Sociedad de la Información
        y de Comercio Electrónico (LSSI-CE), se publican los datos del titular de este
        sitio web.
      </p>

      <h2>Titular</h2>
      <dl>
        <dt>Responsable</dt><dd>{OWNER.name}</dd>
        <dt>NIF</dt><dd>{OWNER.taxId}</dd>
        <dt>Correo de contacto</dt><dd>{OWNER.email}</dd>
        <dt>País</dt><dd>{OWNER.country}</dd>
        <dt>Sitio web</dt><dd>{SITE.url}</dd>
      </dl>

      <h2>Qué es este sitio</h2>
      <p>
        {SITE.name} es un proyecto personal sin ánimo de lucro directo. Convierte enlaces
        públicos de vídeos de viajes en rutas sobre un globo terráqueo y sugiere planes
        de viaje. Se ofrece tal cual, sin garantía de disponibilidad ni de continuidad.
      </p>

      <h2>Uso del servicio</h2>
      <ul>
        <li>Pega únicamente enlaces a contenido público. No subas material del que no tengas derechos.</li>
        <li>No está permitido el uso automatizado, masivo o que degrade el servicio para los demás.</li>
        <li>El servicio puede limitar el número de análisis por visitante para proteger sus costes.</li>
      </ul>

      <h2>Exactitud de la información</h2>
      <p>
        Las rutas, itinerarios, presupuestos, actividades y niveles de riesgo los genera
        un modelo de inteligencia artificial a partir del contenido del vídeo. Pueden
        contener errores. <strong>No son asesoramiento de viaje, ni de seguridad, ni
        financiero.</strong> Antes de viajar, consulta las fuentes oficiales: para España,
        las recomendaciones del Ministerio de Asuntos Exteriores.
      </p>

      <h2>Propiedad intelectual</h2>
      <p>
        El código y el diseño de {SITE.name} pertenecen a su titular. Los vídeos
        analizados pertenecen a sus autores y a las plataformas donde están publicados:
        este sitio no los almacena ni los redistribuye, solo lee fotogramas de forma
        temporal para identificar lugares.
      </p>

      <h2>Legislación aplicable</h2>
      <p>Este aviso se rige por la legislación española.</p>
    </>
  );
}
