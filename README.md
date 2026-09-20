# Globe Trip

Pega un enlace de un vídeo de viajes de TikTok o Instagram y Globe Trip dibuja la ruta sobre un globo 3D: los lugares, el orden, los días y un itinerario. Además, puedes marcar en el globo dónde has estado y dónde quieres ir.

Es una app web (Next.js) que se instala en el iPhone como una app más.

## Cómo analiza un vídeo

1. **Lee el enlace** (`lib/video.ts`). Resuelve los enlaces cortos (`vm.tiktok.com`) y obtiene la descripción, la portada y el vídeo mediante un resolvedor público (tikwm), con la web de TikTok como respaldo (lugar etiquetado y subtítulos).
2. **Mira el vídeo** (`lib/frames.ts`): lo descarga y saca 8 fotogramas repartidos con ffmpeg. En los carruseles de fotos usa las fotos. En Instagram, la portada.
3. **Claude ve los fotogramas** (`lib/extract.ts`): lee los textos de pantalla («📍 Kioto»), reconoce lugares y usa la descripción como apoyo. Devuelve cada lugar con coordenadas, días recomendados y en qué fotograma aparece.
4. **Tú eliges** qué lugares te gustan (cuestionario con fotos del propio vídeo) y se crea la ruta.
5. Si hay `OPENAI_API_KEY` y el TikTok no tiene subtítulos, también transcribe el audio (opcional).

El mismo enlace pegado dos veces se responde desde caché: no gasta y tarda milisegundos.

## Crea tu viaje

Destinos con fotos, estilos de viaje (playas, montaña, gastronomía…) o texto libre; días, viajeros, presupuesto (mochilero / medio / alto, con máximo opcional) y ciudad de salida. Claude propone la ruta, reparte los días y estima un presupuesto por partidas en euros, con consejos (`/api/plan`).

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
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Recomendada | Globo con imagen de satélite en todos los niveles de zoom (sin él, usa la textura Blue Marble). Token **público** (`pk.…`), restringido a tu dominio de Vercel. [Crear token](https://account.mapbox.com/access-tokens/) |
| `OPENAI_API_KEY` | Opcional | Transcribe el audio de los TikTok sin subtítulos |
| `MAPBOX_TOKEN` | Opcional | Afina coordenadas en el servidor (puede ser el mismo token) |
| `ANTHROPIC_MODEL` | Opcional | Por defecto `claude-sonnet-5` |
| `RATE_LIMIT_PER_10_MIN` | Opcional | Análisis por visitante cada 10 min (por defecto 10) |
| `TIKTOK_RESOLVER_URL` | Opcional | Otro servicio para leer TikTok con la misma respuesta que tikwm (por defecto `https://www.tikwm.com/api/?hd=0&url=`) |

4. Pulsa **Redeploy** para que coja las variables. Las `NEXT_PUBLIC_…` se leen al compilar, así que también hace falta redesplegar cuando las cambies.

### Instalarla en el iPhone

Abre tu URL de Vercel en Safari → botón **Compartir** → **Añadir a pantalla de inicio**. Se abre a pantalla completa con su icono, como una app.

## Coste aproximado

- **Claude**: un vídeo son unos 8 fotogramas + texto (≈6.000 tokens de entrada). Con Sonnet 5 ≈ 2 céntimos por vídeo nuevo; con Haiku 4.5 (`ANTHROPIC_MODEL=claude-haiku-4-5-20251001`) ≈ 1 céntimo. Un plan de viaje ≈ 1-2 céntimos.
- **Mapbox**: las teselas de satélite tienen un tramo gratuito mensual amplio; cada usuario carga unas decenas por sesión.
- **OpenAI** (opcional): solo si un TikTok no trae subtítulos.

El límite por visitante (`RATE_LIMIT_PER_10_MIN`) evita que alguien con tu enlace te gaste la clave. Es por instancia del servidor; para un límite estricto, cámbialo por Vercel KV o Upstash.

## Estructura

```
app/
  page.tsx              → la app
  api/analyze/route.ts  → POST {url?, text?} → lugares del vídeo
  api/plan/route.ts     → POST {destino, días, presupuesto…} → viaje con presupuesto
  manifest.ts           → instalación como app (PWA)
components/
  App.tsx               → pantallas, estado y flujos
  GlobeCanvas.tsx       → globo 3D (react-globe.gl): cámara, zoom, alfileres, arcos
  Sheet.tsx             → hojas deslizables inferiores
  PickSheet.tsx         → «¿Cuáles te han gustado?»
  PlannerSheet.tsx      → «Crea tu viaje»
  ItinerarySheet.tsx    → itinerario con fotos y presupuesto
lib/
  video.ts              → leer TikTok / Instagram (texto + imágenes)
  frames.ts             → fotogramas con ffmpeg
  labels.ts, places.json → nombres de países y ciudades en el globo, por zoom
  wiki.ts               → fotos y descripción de cada lugar (Wikipedia)
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

- Leer TikTok depende de un resolvedor público no oficial (tikwm). Si deja de funcionar, cámbialo con `TIKTOK_RESOLVER_URL` o edita `lib/video.ts`; la app sigue usando la web de TikTok y su oEmbed como respaldo.
- Instagram solo deja leer la descripción y la portada desde fuera.
- Las fotos vienen de Wikipedia: los lugares muy pequeños pueden no tener.
