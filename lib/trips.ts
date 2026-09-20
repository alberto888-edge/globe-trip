// Ready-made trips shown first in "Crea tu viaje". Hand-written, so they open
// instantly and cost nothing; "Adaptar a mí" sends them to the AI planner.
// Budgets: rough per-person estimates, mid level, flights from Madrid, mid season.
import type { Route, Stop, TripRisk } from "./types";
import { withDayRanges } from "./itinerary";

interface ReadyTrip {
  id: string;
  name: string;
  tag: string; // one line for the card
  cover: string; // Wikipedia title for the card photo
  countries: string[]; // ISO codes, for the flags
  summary: string;
  stops: Omit<Stop, "when">[];
  budget: [label: string, amount: number][];
  tips: string[];
  risks: Omit<TripRisk, "countries">;
  destination: string; // what to prefill when adapting
}

const S = (name: string, country: string, lat: number, lng: number, days: number, sub: string, note: string, wiki?: string): Omit<Stop, "when"> =>
  ({ name, country, lat, lng, days, sub, note, wiki });

const TRIPS: ReadyTrip[] = [
  {
    id: "indochina", name: "Vietnam, Camboya y Tailandia", tag: "El gran clásico del Sudeste Asiático", cover: "Bahía de Ha Long",
    countries: ["VN", "KH", "TH"], destination: "Vietnam, Camboya y Tailandia",
    summary: "De norte a sur por Vietnam, los templos de Angkor y el final en las islas del sur de Tailandia. Vuelos internos cortos entre países.",
    stops: [
      S("Hanói", "Vietnam", 21.03, 105.85, 3, "Barrio antiguo", "Barrio antiguo, lago Hoan Kiem y cafés de huevo. Street food en la calle del tren.", "Hanói"),
      S("Bahía de Ha Long", "Vietnam", 20.91, 107.18, 1, "Crucero entre islotes", "Noche en barco entre farallones de caliza; mejor por Lan Ha, con menos barcos.", "Bahía de Ha Long"),
      S("Ninh Binh", "Vietnam", 20.25, 105.97, 2, "Arrozales y karst", "Barca por Tam Coc y Trang An, y subida al mirador de Hang Mua al atardecer.", "Ninh Bình"),
      S("Hoi An", "Vietnam", 15.88, 108.33, 3, "Ciudad de farolillos", "Casco antiguo, sastrerías, playa de An Bang y excursión a My Son.", "Hội An"),
      S("Ciudad Ho Chi Minh", "Vietnam", 10.78, 106.7, 2, "Saigón y el Mekong", "Mercado Ben Thanh, museo de la guerra y un día en el delta del Mekong.", "Ciudad Ho Chi Minh"),
      S("Siem Reap", "Camboya", 13.36, 103.86, 3, "Templos de Angkor", "Amanecer en Angkor Wat, Bayon y Ta Prohm; alquila tuk-tuk por días.", "Angkor Wat"),
      S("Bangkok", "Tailandia", 13.76, 100.5, 3, "Templos y mercados", "Gran Palacio, Wat Pho, Wat Arun y mercados nocturnos. Barco por el río Chao Phraya.", "Bangkok"),
      S("Krabi", "Tailandia", 8.05, 98.9, 4, "Playas e islas", "Railay, excursión a las islas Phi Phi y kayak entre manglares.", "Railay"),
    ],
    budget: [["Vuelos", 950], ["Alojamiento", 620], ["Comida", 380], ["Transporte local", 260], ["Actividades", 290]],
    tips: ["Mejor época: noviembre a marzo (el centro de Vietnam llueve en octubre-noviembre).", "Vietnam y Camboya piden visado electrónico; tramítalo antes.", "Vuelos internos baratos: Hanói–Da Nang, Saigón–Siem Reap, Siem Reap–Bangkok."],
    risks: { level: 2, summary: "Destinos tranquilos para el viajero; los riesgos son hurtos, tráfico y salud.", points: ["Tirones de bolso desde motos en Saigón y Bangkok: lleva el móvil por dentro.", "Consulta vacunas (hepatitis A, fiebre tifoidea) y usa repelente contra el dengue.", "Evita alquilar moto sin carné internacional: el seguro no cubre."] },
  },
  {
    id: "atacama-uyuni", name: "Atacama y Salar de Uyuni", tag: "Desierto, lagunas y el espejo del mundo", cover: "Salar de Uyuni",
    countries: ["CL", "BO"], destination: "Desierto de Atacama y Salar de Uyuni",
    summary: "Del desierto más seco del mundo al salar más grande, cruzando el altiplano en 4x4 entre lagunas de colores y géiseres.",
    stops: [
      S("San Pedro de Atacama", "Chile", -22.91, -68.2, 4, "Base en el desierto", "Valle de la Luna al atardecer, lagunas altiplánicas, géiseres del Tatio y noche de estrellas.", "San Pedro de Atacama"),
      S("Reserva Eduardo Avaroa", "Bolivia", -22.2, -67.62, 1, "Lagunas de colores", "Laguna Colorada con flamencos y Laguna Verde, primer día del tour en 4x4.", "Reserva nacional de fauna andina Eduardo Avaroa"),
      S("Salar de Uyuni", "Bolivia", -20.13, -67.49, 2, "El gran salar", "Amanecer en el salar, isla Incahuasi y fotos de perspectiva; en época de lluvias, efecto espejo.", "Salar de Uyuni"),
      S("Potosí", "Bolivia", -19.58, -65.75, 1, "Ciudad minera colonial", "Casa de la Moneda y casco colonial a 4.000 m.", "Potosí"),
      S("La Paz", "Bolivia", -16.5, -68.15, 2, "Ciudad en las nubes", "Teleféricos, mercado de las Brujas y excursión al valle de la Luna o Tiwanaku.", "La Paz"),
    ],
    budget: [["Vuelos", 1150], ["Alojamiento", 380], ["Comida", 220], ["Transporte local", 180], ["Tour 4x4 Uyuni", 280], ["Actividades", 150]],
    tips: ["Vuela a Calama (vía Santiago) y sal desde La Paz: ahorras volver atrás.", "El tour de 3 días San Pedro–Uyuni se reserva en San Pedro; elige agencia con buenas opiniones recientes.", "Efecto espejo del salar: enero a marzo; cielos despejados: mayo a octubre."],
    risks: { level: 2, summary: "Zona segura; el riesgo principal es la altitud y el frío.", points: ["Mal de altura: subes a más de 4.500 m. Aclimátate en San Pedro y bebe mucha agua.", "Noches bajo cero en el altiplano: lleva ropa térmica y saco.", "Bolivia puede tener bloqueos de carreteras por protestas: deja un día de margen."] },
  },
  {
    id: "japon", name: "Japón esencial", tag: "Tokio, Kioto y los clásicos", cover: "Fushimi Inari-taisha",
    countries: ["JP"], destination: "Japón",
    summary: "La ruta perfecta para una primera vez: la gran ciudad, montañas junto al Fuji, templos de Kioto y la ruta hasta Hiroshima.",
    stops: [
      S("Tokio", "Japón", 35.68, 139.69, 4, "Neón y barrios", "Shibuya, Asakusa, Harajuku y Shinjuku; excursión opcional a Nikko o Kamakura.", "Tokio"),
      S("Hakone", "Japón", 35.23, 139.1, 1, "Onsen y monte Fuji", "Noche en ryokan con onsen y vistas al Fuji desde el lago Ashi.", "Hakone"),
      S("Kioto", "Japón", 35.01, 135.77, 3, "Templos y geishas", "Fushimi Inari al amanecer, Kinkaku-ji, Arashiyama y Gion de noche.", "Kioto"),
      S("Nara", "Japón", 34.68, 135.8, 1, "Ciervos y Gran Buda", "Todai-ji y el parque de los ciervos, excursión de un día.", "Nara"),
      S("Osaka", "Japón", 34.69, 135.5, 2, "Capital de la comida", "Dotonbori, takoyaki y castillo de Osaka.", "Osaka"),
      S("Hiroshima", "Japón", 34.39, 132.45, 1, "Memoria y Miyajima", "Parque de la Paz y el torii flotante de Miyajima.", "Hiroshima"),
    ],
    budget: [["Vuelos", 1000], ["Alojamiento", 900], ["Comida", 420], ["Transporte (tren)", 480], ["Actividades", 180]],
    tips: ["Mejor época: primavera (cerezos, finales de marzo-abril) u otoño (noviembre).", "Compara el JR Pass con billetes sueltos: tras la subida de precio no siempre compensa.", "Reserva con antelación el ryokan de Hakone y las entradas de teamLab."],
    risks: { level: 1, summary: "Uno de los países más seguros del mundo.", points: ["Terremotos y tifones (agosto-septiembre): sigue las alertas locales.", "El efectivo aún se usa mucho en sitios pequeños."] },
  },
  {
    id: "peru", name: "Perú: de Lima a Machu Picchu", tag: "Andes, lago Titicaca e incas", cover: "Machu Picchu",
    countries: ["PE"], destination: "Perú",
    summary: "Subiendo poco a poco para aclimatarte: la costa, Arequipa, el lago Titicaca y el final en Cuzco y Machu Picchu.",
    stops: [
      S("Lima", "Perú", -12.05, -77.04, 2, "Capital gastronómica", "Miraflores, Barranco y una cena de cebiche y cocina nikkei.", "Lima"),
      S("Arequipa", "Perú", -16.41, -71.54, 2, "Ciudad blanca", "Monasterio de Santa Catalina y excursión al cañón del Colca para ver cóndores.", "Arequipa"),
      S("Puno", "Perú", -15.84, -70.02, 2, "Lago Titicaca", "Islas flotantes de los uros y noche en Amantaní o Taquile.", "Lago Titicaca"),
      S("Cuzco", "Perú", -13.53, -71.97, 3, "Capital inca", "Plaza de Armas, San Blas, Sacsayhuamán y la montaña de colores.", "Cuzco"),
      S("Valle Sagrado", "Perú", -13.33, -72.08, 1, "Pueblos y terrazas", "Pisac, Moray y las salinas de Maras camino de Ollantaytambo.", "Valle Sagrado de los Incas"),
      S("Machu Picchu", "Perú", -13.16, -72.54, 2, "La ciudad perdida", "Tren a Aguas Calientes y visita a primera hora con subida a Huayna Picchu.", "Machu Picchu"),
    ],
    budget: [["Vuelos", 950], ["Alojamiento", 420], ["Comida", 250], ["Transporte local", 230], ["Entradas y tren a Machu Picchu", 260]],
    tips: ["Mejor época: mayo a septiembre (temporada seca).", "Entradas a Machu Picchu y tren: resérvalos con semanas de antelación.", "Sube de altitud poco a poco; el mate de coca ayuda."],
    risks: { level: 2, summary: "Ruta turística segura con precauciones normales.", points: ["Mal de altura en Puno y Cuzco (más de 3.400 m).", "Taxis: pídelos por app o en el hotel, no en la calle.", "Posibles protestas y cortes de carretera: sigue las noticias locales."] },
  },
  {
    id: "islandia", name: "Islandia: la Ring Road", tag: "Glaciares, cascadas y auroras", cover: "Jökulsárlón",
    countries: ["IS"], destination: "Islandia",
    summary: "Vuelta completa a la isla en coche: cascadas del sur, la laguna glaciar, fiordos del este y el norte volcánico.",
    stops: [
      S("Reikiavik", "Islandia", 64.15, -21.94, 1, "Capital y Laguna Azul", "Hallgrímskirkja, el puerto y baño termal al llegar.", "Reikiavik"),
      S("Círculo Dorado", "Islandia", 64.26, -20.3, 1, "Géiseres y cascadas", "Þingvellir, Geysir y Gullfoss.", "Círculo Dorado"),
      S("Vík", "Islandia", 63.42, -19.01, 1, "Playa negra", "Seljalandsfoss, Skógafoss y la playa de Reynisfjara.", "Vík í Mýrdal"),
      S("Jökulsárlón", "Islandia", 64.05, -16.18, 1, "Laguna glaciar", "Icebergs en la laguna y la Diamond Beach; cueva de hielo en invierno.", "Jökulsárlón"),
      S("Fiordos del Este", "Islandia", 65.26, -14.39, 1, "Pueblos entre fiordos", "Carretera costera y Seyðisfjörður.", "Seyðisfjörður"),
      S("Mývatn", "Islandia", 65.6, -17.0, 1, "Tierra volcánica", "Cráteres, Dettifoss y baños naturales de Mývatn.", "Mývatn"),
      S("Akureyri", "Islandia", 65.68, -18.09, 1, "Capital del norte", "Avistamiento de ballenas en Húsavík y cascada Goðafoss.", "Akureyri"),
      S("Snæfellsnes", "Islandia", 64.87, -23.4, 1, "Islandia en miniatura", "Kirkjufell, acantilados y el glaciar Snæfellsjökull antes de volver.", "Península de Snæfellsnes"),
    ],
    budget: [["Vuelos", 350], ["Alojamiento", 900], ["Comida", 380], ["Coche y gasolina", 520], ["Actividades", 200]],
    tips: ["Verano: días eternos y todas las carreteras abiertas. Invierno: auroras, pero conduce con cuidado.", "Coche con seguro de grava; en invierno, 4x4.", "Comprar en supermercados (Bónus, Krónan) ahorra mucho."],
    risks: { level: 1, summary: "País muy seguro; el peligro es la naturaleza.", points: ["Clima cambiante y viento fuerte: mira safetravel.is y road.is cada día.", "Olas traicioneras en Reynisfjara: no te acerques al agua.", "Actividad volcánica en Reykjanes: respeta los cierres."] },
  },
  {
    id: "marruecos", name: "Marruecos: medinas y desierto", tag: "Marrakech, Sáhara y Fez", cover: "Merzouga",
    countries: ["MA"], destination: "Marruecos",
    summary: "De Marrakech al desierto por el Atlas y los valles de las kasbahs, y final en las medinas de Fez y Chefchaouen.",
    stops: [
      S("Marrakech", "Marruecos", 31.63, -7.99, 2, "Medina y zocos", "Plaza Jemaa el-Fna, jardín Majorelle, Bahía y noche en riad.", "Marrakech"),
      S("Aït Ben Haddou", "Marruecos", 31.05, -7.13, 1, "Ksar de película", "Cruce del Atlas por el Tizi n'Tichka y el ksar al atardecer.", "Aït Ben Haddou"),
      S("Valle del Dades", "Marruecos", 31.37, -5.99, 1, "Gargantas y kasbahs", "Curvas del Dades y gargantas del Todra.", "Valle del Dadès"),
      S("Merzouga", "Marruecos", 31.1, -4.01, 2, "Dunas del Sáhara", "Camello al atardecer por Erg Chebbi y noche en jaima bajo las estrellas.", "Erg Chebbi"),
      S("Fez", "Marruecos", 34.03, -5.0, 2, "La gran medina", "Laberinto de Fez el-Bali, curtidurías y medersas.", "Fez"),
      S("Chefchaouen", "Marruecos", 35.17, -5.27, 1, "El pueblo azul", "Callejuelas azules y mirador de la mezquita española.", "Chefchaouen"),
    ],
    budget: [["Vuelos", 150], ["Alojamiento", 300], ["Comida", 170], ["Transporte / conductor", 230], ["Actividades", 100]],
    tips: ["Mejor época: primavera y otoño; en verano el desierto supera los 45 °C.", "Vuela a Marrakech y vuelve desde Fez o Tánger.", "Regatea con humor en los zocos y acuerda los precios antes."],
    risks: { level: 2, summary: "Destino seguro con precauciones normales.", points: ["Falsos guías y comisiones en las medinas: di que no con amabilidad.", "Carreteras de montaña: mejor con conductor o de día.", "Viste de forma discreta fuera de las zonas turísticas."] },
  },
  {
    id: "italia", name: "Italia clásica", tag: "Venecia, Florencia, Toscana y Roma", cover: "Florencia",
    countries: ["IT"], destination: "Italia",
    summary: "En tren de norte a sur: canales, Renacimiento, colinas de la Toscana y la Ciudad Eterna.",
    stops: [
      S("Venecia", "Italia", 45.44, 12.33, 2, "Canales y góndolas", "San Marcos, Rialto y perderse por Cannaregio; Burano en vaporetto.", "Venecia"),
      S("Florencia", "Italia", 43.77, 11.26, 3, "Cuna del Renacimiento", "Duomo, Uffizi, David de Miguel Ángel y atardecer en el Piazzale Michelangelo.", "Florencia"),
      S("Siena", "Italia", 43.32, 11.33, 1, "Toscana medieval", "Piazza del Campo y viñedos del Chianti.", "Siena"),
      S("Roma", "Italia", 41.9, 12.5, 4, "La Ciudad Eterna", "Coliseo, Foro, Vaticano, Trastevere y la Fontana di Trevi de noche.", "Roma"),
    ],
    budget: [["Vuelos", 180], ["Alojamiento", 720], ["Comida", 380], ["Trenes", 150], ["Entradas", 170]],
    tips: ["Reserva Uffizi, Vaticano y Coliseo con antelación.", "Trenes rápidos (Frecciarossa, Italo): más baratos cuanto antes compres.", "Vuela a Venecia y vuelve desde Roma."],
    risks: { level: 1, summary: "Muy seguro; cuidado con los carteristas.", points: ["Carteristas en el metro de Roma y zonas turísticas.", "Algunas ciudades cobran tasa turística (Venecia en días punta)."] },
  },
  {
    id: "costa-rica", name: "Costa Rica pura vida", tag: "Volcanes, selva y dos océanos", cover: "Volcán Arenal",
    countries: ["CR"], destination: "Costa Rica",
    summary: "Naturaleza en estado puro: volcán Arenal, bosque nuboso de Monteverde y playas con monos en Manuel Antonio.",
    stops: [
      S("San José", "Costa Rica", 9.93, -84.08, 1, "Llegada", "Noche de llegada y salida temprano hacia el norte.", "San José (Costa Rica)"),
      S("La Fortuna", "Costa Rica", 10.47, -84.64, 3, "Volcán Arenal", "Puentes colgantes, catarata de La Fortuna y aguas termales.", "Volcán Arenal"),
      S("Monteverde", "Costa Rica", 10.3, -84.82, 2, "Bosque nuboso", "Tour nocturno de fauna, tirolinas y reserva del bosque nuboso.", "Reserva Biológica Bosque Nuboso Monteverde"),
      S("Manuel Antonio", "Costa Rica", 9.39, -84.14, 4, "Playas y monos", "Parque nacional con guía, playas y atardecer en el Pacífico.", "Parque nacional Manuel Antonio"),
    ],
    budget: [["Vuelos", 800], ["Alojamiento", 560], ["Comida", 330], ["Coche de alquiler", 380], ["Actividades", 260]],
    tips: ["Temporada seca: diciembre a abril.", "Coche 4x4 para Monteverde; el seguro obligatorio encarece el alquiler.", "Con guía en los parques ves muchos más animales."],
    risks: { level: 2, summary: "Destino seguro para turistas, con más hurtos que antes.", points: ["No dejes nada a la vista en el coche.", "Corrientes fuertes en algunas playas del Pacífico: báñate donde haya socorristas.", "Usa repelente: hay dengue."] },
  },
  {
    id: "balcanes", name: "Balcanes: Croacia, Bosnia y Montenegro", tag: "Lagos, costa dálmata y bahía de Kotor", cover: "Dubrovnik",
    countries: ["HR", "BA", "ME"], destination: "Croacia, Bosnia y Herzegovina y Montenegro",
    summary: "Lagos de Plitvice, la costa dálmata, el puente de Mostar y la bahía de Kotor, en coche o bus.",
    stops: [
      S("Zagreb", "Croacia", 45.81, 15.98, 1, "Capital", "Ciudad alta y mercado Dolac.", "Zagreb"),
      S("Plitvice", "Croacia", 44.88, 15.62, 1, "Lagos turquesa", "Pasarelas entre lagos y cascadas, a primera hora.", "Parque nacional de los Lagos de Plitvice"),
      S("Split", "Croacia", 43.51, 16.44, 2, "Palacio romano", "Palacio de Diocleciano y excursión a Hvar o a Krka.", "Split"),
      S("Mostar", "Bosnia y Herzegovina", 43.34, 17.81, 1, "El Puente Viejo", "Stari Most, bazar otomano y cascadas de Kravica.", "Mostar"),
      S("Dubrovnik", "Croacia", 42.65, 18.09, 3, "La perla del Adriático", "Paseo por las murallas, kayak y la isla de Lokrum.", "Dubrovnik"),
      S("Kotor", "Montenegro", 42.42, 18.77, 2, "Bahía entre montañas", "Subida a la fortaleza y Perast en barca.", "Kotor"),
    ],
    budget: [["Vuelos", 250], ["Alojamiento", 560], ["Comida", 280], ["Transporte / coche", 250], ["Entradas", 120]],
    tips: ["Mejor en junio o septiembre: menos gente y buen mar.", "Si alquilas coche, pide la carta verde para Bosnia y Montenegro.", "Vuela a Zagreb y vuelve desde Dubrovnik o Tivat."],
    risks: { level: 1, summary: "Región segura para viajar.", points: ["En zonas rurales de Bosnia no salgas de caminos señalizados (restos de minas).", "Colas largas en las fronteras en verano."] },
  },
  {
    id: "egipto", name: "Egipto: pirámides y Nilo", tag: "El Cairo, Abu Simbel, Asuán y Lúxor", cover: "Pirámides de Guiza",
    countries: ["EG"], destination: "Egipto",
    summary: "Las pirámides y el Museo Egipcio, y después Nilo abajo desde Abu Simbel hasta los templos y tumbas de Lúxor.",
    stops: [
      S("El Cairo", "Egipto", 30.04, 31.24, 3, "Pirámides y museo", "Pirámides de Guiza, Gran Museo Egipcio y el Cairo islámico.", "Pirámides de Guiza"),
      S("Abu Simbel", "Egipto", 22.34, 31.63, 1, "Templos de Ramsés II", "Vuelo o convoy desde Asuán, a primera hora.", "Abu Simbel"),
      S("Asuán", "Egipto", 24.09, 32.9, 2, "Nilo y faluca", "Templo de Filé, pueblo nubio y paseo en faluca.", "Asuán"),
      S("Lúxor", "Egipto", 25.69, 32.64, 3, "Templos y Valle de los Reyes", "Karnak, Lúxor de noche, Valle de los Reyes y globo al amanecer.", "Lúxor"),
    ],
    budget: [["Vuelos", 550], ["Alojamiento / crucero", 420], ["Comida", 160], ["Transporte interno", 180], ["Entradas", 240]],
    tips: ["Mejor de octubre a abril.", "Crucero Asuán–Lúxor de 3-4 noches: cómodo y con las visitas incluidas.", "Lleva efectivo en euros o dólares para propinas."],
    risks: { level: 3, summary: "Zonas turísticas del Nilo seguras; Exteriores desaconseja el norte del Sinaí y las fronteras.", points: ["No viajes al norte del Sinaí ni a la frontera con Libia.", "Acoso de vendedores y timos en las pirámides: acuerda precios antes.", "Consulta Exteriores antes de salir por la situación en Oriente Medio."] },
  },
];

/** The card list for the planner. */
export const READY_TRIPS = TRIPS.map((t) => ({
  id: t.id, name: t.name, tag: t.tag, cover: t.cover, countries: t.countries,
  days: t.stops.reduce((a, s) => a + (s.days || 1), 0),
  perPerson: t.budget.reduce((a, [, n]) => a + n, 0),
}));

/** A ready trip as a route, for a given number of travellers. */
export function readyRoute(id: string, travelers = 1): Route | null {
  const t = TRIPS.find((x) => x.id === id);
  if (!t) return null;
  const perPerson = t.budget.reduce((a, [, n]) => a + n, 0);
  const stops = withDayRanges(t.stops);
  return {
    id: `r-${t.id}-${Date.now().toString(36)}`,
    name: t.name,
    days: stops.reduce((a, s) => a + (s.days || 1), 0),
    stops,
    kind: "ready",
    summary: t.summary,
    budget: {
      currency: "EUR",
      total: perPerson * travelers,
      perPerson,
      breakdown: t.budget.map(([label, amount]) => ({ label, amount: amount * travelers })),
      note: "Estimación por persona, nivel medio, vuelos desde Madrid en temporada media.",
    },
    tips: t.tips,
    risks: { ...t.risks, countries: [...new Set(t.stops.map((s) => s.country!))] },
    request: { destination: t.destination, multiCountry: t.countries.length > 1 },
  };
}
