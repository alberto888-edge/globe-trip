# Globe Trip

Pega un enlace de un vídeo de viajes de TikTok o Instagram y Globe Trip dibuja la ruta sobre un globo 3D: los lugares, el orden, los días y un itinerario. Además, puedes marcar en el globo dónde has estado y dónde quieres ir.

Es una app web (Next.js) que se instala en el iPhone como una app más.

## Cómo analiza un vídeo

1. **Lee el enlace** (`lib/video.ts`):
   - **TikTok**: descripción, lugar etiquetado, subtítulos automáticos y, si hay `OPENAI_API_KEY` y el vídeo no trae subtítulos, la transcripción del audio.
   - **Instagram**: la descripción (Instagram no deja leer más desde fuera).
2. **Claude extrae la ruta** (`lib/extract.ts`): lugares concretos, orden lógico, reparto de días y coordenadas. La respuesta se valida antes de usarla.
3. **Afina coordenadas** con Mapbox si hay `MAPBOX_TOKEN` (opcional).
4. Si el vídeo no se puede leer (privado, bloqueado, o una descripción sin lugares), la app te pide que pegues la descripción o escribas los sitios.

## Ponerla en marcha

### En tu ordenador

```bash
npm install
cp .env.example .env.local   # y pon tu ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

### En Vercel (para usarla en el móvil)

1. Sube esta carpeta a un repositorio nuevo de GitHub:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/globe-trip.git
   git push -u origin main
   ```
2. En [vercel.com/new](https://vercel.com/new), importa el repositorio. Vercel detecta Next.js solo.
3. En **Settings → Environment Variables**, añade:

| Variable | ¿Obligatoria? | Para qué |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sí | Claude extrae los lugares. [Crear clave](https://console.anthropic.com/settings/keys) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Recomendada | Imágenes de satélite nítidas al hacer zoom. Token **público** (`pk.…`), restringido a tu dominio de Vercel. [Crear token](https://account.mapbox.com/access-tokens/) |
| `OPENAI_API_KEY` | Opcional | Transcribe el audio de los TikTok sin subtítulos |
| `MAPBOX_TOKEN` | Opcional | Afina coordenadas en el servidor (puede ser el mismo token) |
| `ANTHROPIC_MODEL` | Opcional | Por defecto `claude-sonnet-5` |
| `RATE_LIMIT_PER_10_MIN` | Opcional | Análisis por visitante cada 10 min (por defecto 10) |

4. Pulsa **Redeploy** para que coja las variables. Las `NEXT_PUBLIC_…` se leen al compilar, así que también hace falta redesplegar cuando las cambies.

### Instalarla en el iPhone

Abre tu URL de Vercel en Safari → botón **Compartir** → **Añadir a pantalla de inicio**. Se abre a pantalla completa con su icono, como una app.

## Coste aproximado

- **Claude**: un análisis manda unos pocos miles de tokens. Son céntimos por vídeo; mira los precios del modelo en tu consola de Anthropic.
- **Mapbox**: las teselas de satélite tienen un tramo gratuito mensual amplio; solo se piden al acercarte mucho.
- **OpenAI** (opcional): solo si un TikTok no trae subtítulos.

El límite por visitante (`RATE_LIMIT_PER_10_MIN`) evita que alguien con tu enlace te gaste la clave. Es por instancia del servidor; para un límite estricto, cámbialo por Vercel KV o Upstash.

## Estructura

```
app/
  page.tsx              → la app
  api/analyze/route.ts  → POST {url?, text?} → ruta
  manifest.ts           → instalación como app (PWA)
components/
  App.tsx               → pantallas, estado y flujos
  GlobeCanvas.tsx       → globo 3D (react-globe.gl): cámara, zoom, alfileres, arcos
  Sheet.tsx             → hojas deslizables inferiores
lib/
  video.ts              → leer TikTok / Instagram
  extract.ts            → Claude → ruta validada
  geo.ts                → distancias, encuadre de cámara
  demo.ts               → rutas de ejemplo y lugares iniciales
public/textures/        → Tierra (NASA Blue Marble, dominio público), relieve y máscara de océano
```

Tus lugares y rutas se guardan en el navegador (`localStorage`). El siguiente paso natural es añadir cuentas de usuario (por ejemplo Supabase) para sincronizarlos entre dispositivos.

## Pruebas

```bash
npm test        # lectura de TikTok/Instagram, validación de rutas, encuadre de cámara
npm run build
```

## Límites conocidos

- TikTok e Instagram cambian su web a menudo. Si un día deja de leerse la descripción, el fallo está aislado en `lib/video.ts` y la app pasa a pedir el texto a mano.
- Desde los servidores de Vercel, TikTok a veces solo devuelve la descripción (vía oEmbed) y no los subtítulos. Con la descripción suele bastar.
