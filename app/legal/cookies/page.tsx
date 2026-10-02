import Link from "next/link";
import type { Metadata } from "next";
import { OWNER } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de cookies · Globe Trip" };

export default function Page() {
  return (
    <>
      <h1>Política de cookies</h1>
      <p className="legal-lead">
        Esta web no usa cookies de seguimiento ni de publicidad. Para saber cuánta gente la visita usa Vercel Web Analytics, que no instala cookies: cuenta visitas de forma agregada y anónima, y la sesión se descarta a las 24 horas.
      </p>

      <h2>Lo que sí se usa</h2>
      <p>
        <strong>Almacenamiento local del navegador</strong> (<code>localStorage</code>),
        que técnicamente no es una cookie pero conviene explicarlo igual. Guarda tus
        lugares y tus rutas en tu propio dispositivo para que sigan ahí cuando vuelvas.
        No se envía a ningún servidor, no viaja en las peticiones y nadie más puede
        leerlo.
      </p>
      <p>
        Es almacenamiento estrictamente necesario para que la app haga lo que esperas de
        ella, así que no requiere consentimiento previo.
      </p>

      <h2>Cómo borrarlo</h2>
      <p>
        Desde los ajustes de tu navegador, borrando los datos de este sitio. También
        puedes borrar tus rutas una a una dentro de la propia app.
      </p>

      <h2>Cuando haya enlaces de afiliado</h2>
      <p>
        Está previsto añadir enlaces de afiliado a plataformas de actividades. Esos
        enlaces sí instalan cookies de terceros para atribuir una reserva, y{" "}
        <strong>no se activarán sin pedirte permiso antes</strong> mediante un aviso de
        consentimiento. Mientras este párrafo siga aquí y no veas ese aviso, es que
        todavía no hay ninguno.
      </p>
      <p>
        Más detalle en <Link href="/legal/afiliacion">enlaces de afiliado</Link>.
      </p>

      <h2>Dudas</h2>
      <p>Escribe a {OWNER.email}.</p>
    </>
  );
}
