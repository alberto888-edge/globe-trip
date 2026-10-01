import Link from "next/link";
import type { Metadata } from "next";
import { OWNER, SITE } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidad · Globe Trip" };

export default function Page() {
  return (
    <>
      <h1>Política de privacidad</h1>
      <p className="legal-lead">
        Resumen honesto: {SITE.name} no te pide cuenta, no te pide el correo y no guarda
        tus rutas en ningún servidor. Lo que creas se queda en tu propio navegador.
      </p>

      <h2>Quién trata tus datos</h2>
      <p>
        El responsable es {OWNER.name}{OWNER.taxId ? ` (${OWNER.taxId})` : ""}. Para
        cualquier cuestión sobre privacidad: {OWNER.email}.
      </p>

      <h2>Qué datos se tratan</h2>
      <table>
        <thead><tr><th>Dato</th><th>Para qué</th><th>Dónde queda</th></tr></thead>
        <tbody>
          <tr>
            <td>El enlace de vídeo que pegas</td>
            <td>Descargar el vídeo y extraer fotogramas para identificar lugares</td>
            <td>En memoria del servidor, en caché hasta 6 horas</td>
          </tr>
          <tr>
            <td>Tus lugares y rutas guardadas</td>
            <td>Que sigan ahí cuando vuelvas</td>
            <td>Solo en tu navegador (almacenamiento local). No se envían a ningún servidor</td>
          </tr>
          <tr>
            <td>Tu dirección IP</td>
            <td>Limitar el número de análisis por visitante y evitar abusos</td>
            <td>En memoria del servidor, ventanas de 10 minutos</td>
          </tr>
          <tr>
            <td>Registros técnicos del servidor</td>
            <td>Detectar errores</td>
            <td>Infraestructura de Vercel, de forma temporal</td>
          </tr>
        </tbody>
      </table>
      <p>
        No se recogen nombre, correo, teléfono ni datos de pago, porque el servicio no
        los necesita.
      </p>

      <h2>Base legal</h2>
      <ul>
        <li><strong>Ejecución del servicio</strong> que solicitas: procesar el enlace que pegas.</li>
        <li><strong>Interés legítimo</strong>: proteger el servicio frente a abusos mediante el límite por IP.</li>
        <li><strong>Consentimiento</strong>: para cualquier cookie que no sea estrictamente necesaria.</li>
      </ul>

      <h2>Con quién se comparte</h2>
      <p>Solo con los proveedores necesarios para que la app funcione:</p>
      <ul>
        <li><strong>Vercel</strong> — alojamiento y ejecución del servidor.</li>
        <li><strong>Anthropic</strong> — el modelo que lee los fotogramas e identifica lugares. Recibe las imágenes y el texto del vídeo, no datos personales tuyos.</li>
        <li><strong>Esri (ArcGIS)</strong> — imágenes de satélite del globo. Tu navegador las descarga directamente de sus servidores, que ven tu dirección IP.</li>
        <li><strong>Mapbox</strong> — geocodificación de los lugares detectados.</li>
        <li><strong>TikTok e Instagram</strong> — se consulta el contenido público del enlace que pegas.</li>
      </ul>
      <p>Nunca se venden ni se ceden datos con fines publicitarios.</p>

      <h2>Cuánto tiempo se conserva</h2>
      <ul>
        <li>Análisis en caché: hasta 6 horas.</li>
        <li>Límite por IP: ventanas de 10 minutos.</li>
        <li>Tus rutas: en tu navegador, hasta que las borres tú o limpies los datos del sitio.</li>
      </ul>

      <h2>Tus derechos</h2>
      <p>
        Puedes ejercer los derechos de acceso, rectificación, supresión, oposición,
        limitación y portabilidad escribiendo a {OWNER.email}. Como el servicio no guarda
        datos identificativos tuyos, en la práctica la forma más rápida de borrar todo lo
        que hay es limpiar los datos del sitio en tu navegador.
      </p>
      <p>
        Si crees que no se han respetado tus derechos, puedes reclamar ante la Agencia
        Española de Protección de Datos (<span className="nowrap">aepd.es</span>).
      </p>

      <h2>Menores</h2>
      <p>
        El servicio no está dirigido a menores de 14 años y no recoge datos de forma
        consciente de ellos.
      </p>

      <h2>Cookies y enlaces de afiliado</h2>
      <p>
        Lo explican sus propias páginas: <Link href="/legal/cookies">cookies</Link> y{" "}
        <Link href="/legal/afiliacion">enlaces de afiliado</Link>.
      </p>

      <h2>Cambios</h2>
      <p>
        Si esta política cambia, se actualiza la fecha del pie. Los cambios relevantes se
        avisarán en la propia app.
      </p>
    </>
  );
}
