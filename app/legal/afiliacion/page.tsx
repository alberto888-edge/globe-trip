import type { Metadata } from "next";
import { OWNER, SITE } from "@/lib/legal";

export const metadata: Metadata = { title: "Enlaces de afiliado · Globe Trip" };

export default function Page() {
  return (
    <>
      <h1>Enlaces de afiliado</h1>
      <p className="legal-lead">
        Estado actual: <strong>todavía no hay ningún enlace de afiliado activo</strong> en{" "}
        {SITE.name}. Esta página explica cómo funcionarán cuando los haya.
      </p>

      <h2>Qué significa</h2>
      <p>
        Algunas actividades y alojamientos que se sugieren podrán enlazar a plataformas
        de reserva externas. Si reservas a través de uno de esos enlaces, esa plataforma
        paga una comisión al titular de esta web. <strong>A ti no te cuesta nada más</strong>:
        el precio es el mismo que si entraras por tu cuenta.
      </p>

      <h2>Cómo afecta a lo que ves</h2>
      <p>
        Las sugerencias las genera el modelo a partir del destino, no del dinero. Un
        sitio no aparece antes ni mejor colocado por pagar comisión, y ninguna plataforma
        paga por aparecer. Si alguna vez eso cambiara, se diría aquí y se marcaría en la
        propia tarjeta.
      </p>

      <h2>Cómo se señalan</h2>
      <p>
        Todo enlace de afiliado irá marcado de forma visible en la tarjeta donde aparezca
        y llevará los atributos <code>rel=&quot;sponsored nofollow&quot;</code>, como exige
        la normativa de publicidad y las buenas prácticas.
      </p>

      <h2>Cookies</h2>
      <p>
        Estos enlaces usan cookies de terceros para atribuir la reserva, normalmente
        durante unos 30 días. No se activarán sin tu consentimiento previo.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        La reserva, el pago, las cancelaciones y la atención al cliente son cosa de la
        plataforma externa, no de {SITE.name}. Cualquier incidencia con una reserva se
        gestiona directamente con ellos.
      </p>

      <h2>Dudas</h2>
      <p>Escribe a {OWNER.email}.</p>
    </>
  );
}
