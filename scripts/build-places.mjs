// Builds the place names used on the globe and in search, in Spanish:
//  - lib/places.json    countries + big cities + tourist spots (bundled, shown from far away)
//  - public/cities.json every town over ~50k people (loaded after start, shown up close and in search)
// Run once (output is committed):  cd scripts && npm i world-countries all-the-cities && node build-places.mjs
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const countries = require("world-countries");
const cities = require("all-the-cities");

// Spanish exonyms for cities whose GeoNames name differs from how a Spanish speaker says it.
const ES = {
  Alexandria: "Alejandría", "Fès": "Fez", Brugge: "Brujas", Aswan: "Asuán", Giza: "Guiza", Dubai: "Dubái", "Abu Dhabi": "Abu Dabi", Riyadh: "Riad",
  Jeddah: "Yeda", Kolkata: "Calcuta", Shanghai: "Shanghái", Guangzhou: "Cantón", Gothenburg: "Gotemburgo",
  Genoa: "Génova", Bologna: "Bolonia", Fes: "Fez", Tangier: "Tánger", Tripoli: "Trípoli", Khartoum: "Jartum",
  "Dar es Salaam": "Dar es-Salam", Asuncion: "Asunción", "Asunción": "Asunción", Panama: "Panamá", "Panama City": "Ciudad de Panamá",
  "San Jose": "San José", "Guatemala City": "Ciudad de Guatemala", "Washington, D.C.": "Washington", "Phnom Penh": "Nom Pen",
  Yangon: "Rangún", Dhaka: "Daca", Tashkent: "Taskent", Baku: "Bakú", Yerevan: "Ereván", Damascus: "Damasco",
  Muscat: "Mascate", "Kuwait City": "Kuwait", "Sanaa": "Saná", Jakarta: "Yakarta", Ulaanbaatar: "Ulán Bator",
  "Nizhniy Novgorod": "Nizhni Nóvgorod", "Mecca": "La Meca", Medina: "Medina", Casablanca: "Casablanca",
  Marrakesh: "Marrakech", Agadir: "Agadir", Seville: "Sevilla", Saragossa: "Zaragoza", Zaragoza: "Zaragoza",
  "Palma de Mallorca": "Palma", "Las Palmas de Gran Canaria": "Las Palmas", Pamplona: "Pamplona", Bilbao: "Bilbao",
  Hanover: "Hannover", Nuremberg: "Núremberg", Dresden: "Dresde", Aachen: "Aquisgrán", Mainz: "Maguncia",
  Florence: "Florencia", Milan: "Milán", Padua: "Padua", Syracuse: "Siracusa", Seoul: "Seúl", Kyoto: "Kioto",
  Hiroshima: "Hiroshima", Sapporo: "Sapporo", "Ho Chi Minh City": "Ciudad Ho Chi Minh", Beijing: "Pekín",
  "Hong Kong": "Hong Kong", Macau: "Macao", "New Taipei": "Nuevo Taipéi", Karachi: "Karachi", Lahore: "Lahore",
  Istanbul: "Estambul", Izmir: "Esmirna", Antalya: "Antalya", Thessaloniki: "Salónica", Plovdiv: "Plovdiv",
  "Chisinau": "Chisináu", Tbilisi: "Tiflis", Belgrade: "Belgrado", Sarajevo: "Sarajevo", Skopje: "Skopie",
  Tirana: "Tirana", Pristina: "Pristina", Bratislava: "Bratislava", Ljubljana: "Liubliana", Zagreb: "Zagreb",
  Luxembourg: "Luxemburgo", Basel: "Basilea", Bern: "Berna", Lucerne: "Lucerna", Antwerp: "Amberes", Ghent: "Gante", Bruges: "Brujas",
  Rotterdam: "Róterdam", Amsterdam: "Ámsterdam", Moscow: "Moscú", Minsk: "Minsk", Kaliningrad: "Kaliningrado",
  Wellington: "Wellington", Auckland: "Auckland", Melbourne: "Melbourne", Philadelphia: "Filadelfia",
  "Quebec City": "Quebec", "Rio de Janeiro": "Río de Janeiro", Cusco: "Cuzco", Bogota: "Bogotá", Brasilia: "Brasilia",
  "Mexico City": "Ciudad de México", "Cape Town": "Ciudad del Cabo", Johannesburg: "Johannesburgo", Havana: "La Habana",
  London: "Londres", "New York City": "Nueva York", Moscow: "Moscú", Beijing: "Pekín", Cairo: "El Cairo",
  Rome: "Roma", Milan: "Milán", Naples: "Nápoles", Florence: "Florencia", Venice: "Venecia", Turin: "Turín",
  Lisbon: "Lisboa", Athens: "Atenas", Munich: "Múnich", Cologne: "Colonia", Vienna: "Viena", Prague: "Praga",
  Warsaw: "Varsovia", Brussels: "Bruselas", Copenhagen: "Copenhague", Stockholm: "Estocolmo", Geneva: "Ginebra",
  Zurich: "Zúrich", Edinburgh: "Edimburgo", Dublin: "Dublín", Bucharest: "Bucarest", Budapest: "Budapest",
  "Saint Petersburg": "San Petersburgo", Istanbul: "Estambul", Tokyo: "Tokio", Kyoto: "Kioto", Seoul: "Seúl",
  Singapore: "Singapur", Philadelphia: "Filadelfia", "New Orleans": "Nueva Orleans", "Mexico City": "Ciudad de México",
  "Cape Town": "Ciudad del Cabo", Marrakesh: "Marrakech", Tunis: "Túnez", Algiers: "Argel", Tehran: "Teherán",
  Baghdad: "Bagdad", Jerusalem: "Jerusalén", Mumbai: "Bombay", "New Delhi": "Nueva Delhi", Delhi: "Delhi",
  Kathmandu: "Katmandú", Hanoi: "Hanói", "Ho Chi Minh City": "Ciudad Ho Chi Minh", Bangkok: "Bangkok",
  "Kuala Lumpur": "Kuala Lumpur", Taipei: "Taipéi", Sydney: "Sídney", Havana: "La Habana", "São Paulo": "São Paulo",
  "Rio de Janeiro": "Río de Janeiro", Bogota: "Bogotá", Brasilia: "Brasilia", Kyiv: "Kiev", Belgrade: "Belgrado",
  "The Hague": "La Haya", Antwerp: "Amberes", Bordeaux: "Burdeos", Marseille: "Marsella", Seville: "Sevilla",
  "Palma": "Palma", Reykjavik: "Reikiavik", Oslo: "Oslo", Helsinki: "Helsinki", Riga: "Riga", Vilnius: "Vilna",
  Tallinn: "Tallin", Krakow: "Cracovia", Dubrovnik: "Dubrovnik", Beirut: "Beirut", Amman: "Ammán", Mecca: "La Meca",
  Nairobi: "Nairobi", Addis_Ababa: "Adís Abeba", "Addis Ababa": "Adís Abeba", Johannesburg: "Johannesburgo",
  Montreal: "Montreal", Quebec: "Quebec", Toronto: "Toronto", "Los Angeles": "Los Ángeles", "San Francisco": "San Francisco",
  Lyon: "Lyon", Nice: "Niza", Strasbourg: "Estrasburgo", Hamburg: "Hamburgo", Berlin: "Berlín", Frankfurt: "Fráncfort",
  Cusco: "Cuzco", Porto: "Oporto", "Nara-shi": "Nara", "Reykjavík": "Reikiavik", Chefchaouene: "Chefchaouen", Zanzibar: "Zanzíbar", "Donostia / San Sebastián": "San Sebastián", Kraków: "Cracovia", Luxembourg: "Luxemburgo", Monaco: "Mónaco", Valletta: "La Valeta",
  Tadmur: "Palmira", Aleppo: "Alepo", Hamah: "Hama", Hims: "Homs", "Dayr az Zawr": "Deir ez-Zor", "Al Ladhiqiyah": "Latakia", "Tartus": "Tartús", "Baalbek": "Baalbek", "Sayda": "Sidón", "Tarabulus": "Trípoli", Irbid: "Irbid", "Az Zarqa'": "Zarqa", "Al Aqabah": "Áqaba", "Aqaba": "Áqaba", Latakia: "Latakia", "Busra ash Sham": "Bosra",
  "Al Jizah": "Guiza", "Sharm el-Sheikh": "Sharm el-Sheij", Hurghada: "Hurgada", Luxor: "Lúxor",
  Ouarzazate: "Uarzazat", Essaouira: "Esauira", Tetouan: "Tetuán", Meknes: "Mequinez", "Rabat": "Rabat",
  Mandalay: "Mandalay", Kyiv: "Kiev", Lviv: "Leópolis", Odesa: "Odesa", Gdańsk: "Gdansk", Wrocław: "Breslavia",
  "Cluj-Napoca": "Cluj-Napoca", Brasov: "Brasov", "Brașov": "Brasov", Sofia: "Sofía", Nicosia: "Nicosia",
  Rhodes: "Rodas", Heraklion: "Heraclión", Chania: "La Canea", Corfu: "Corfú", "Kérkyra": "Corfú",
  Naples: "Nápoles", Palermo: "Palermo", Catania: "Catania", Bari: "Bari", Verona: "Verona", Pisa: "Pisa", Siena: "Siena",
  Avignon: "Aviñón", Toulouse: "Toulouse", Lille: "Lille", Nantes: "Nantes", Seville: "Sevilla", Cordoba: "Córdoba",
  Cadiz: "Cádiz", "A Coruña": "La Coruña", Tenerife: "Tenerife", Leipzig: "Leipzig", Stuttgart: "Stuttgart",
  Gothenburg: "Gotemburgo", Aarhus: "Aarhus", Innsbruck: "Innsbruck", Salzburg: "Salzburgo", Zermatt: "Zermatt",
  Cairo: "El Cairo", Esfahan: "Isfahán", Isfahan: "Isfahán", Shiraz: "Shiraz", Samarkand: "Samarcanda", Bukhara: "Bujará",
  Kathmandu: "Katmandú", Pokhara: "Pokhara", Varanasi: "Benarés", Agra: "Agra", Jaipur: "Jaipur", Chennai: "Chennai",
  Colombo: "Colombo", Kandy: "Kandy", Bangalore: "Bangalore", Bengaluru: "Bangalore", Manila: "Manila",
  Osaka: "Osaka", Nagasaki: "Nagasaki", Busan: "Busán", "Xi'an": "Xi'an", "Xi’an": "Xi'an", Chongqing: "Chongqing",
  Lhasa: "Lhasa", Chengdu: "Chengdú", Hangzhou: "Hangzhou", Guilin: "Guilin", Taipei: "Taipéi",
  "Ciudad de Mexico": "Ciudad de México", "Mexico City": "Ciudad de México", Merida: "Mérida", Cancun: "Cancún",
  "San Cristobal de las Casas": "San Cristóbal de las Casas", Medellin: "Medellín", Quito: "Quito", Cuenca: "Cuenca",
  "La Paz": "La Paz", Sucre: "Sucre", Valparaiso: "Valparaíso", Mendoza: "Mendoza", Cordoba: "Córdoba",
  Montevideo: "Montevideo", Salvador: "Salvador de Bahía", Florianopolis: "Florianópolis",
  "New Orleans": "Nueva Orleans", Miami: "Miami", Honolulu: "Honolulu", Vancouver: "Vancouver",
  Perth: "Perth", Brisbane: "Brisbane", Cairns: "Cairns", Christchurch: "Christchurch",
};

// Tourist spots that aren't (or aren't findable as) towns in GeoNames: [name, country, lat, lng].
const SPOTS = [
  ["Bosra", "SY", 32.52, 36.48], ["Krak de los Caballeros", "SY", 34.76, 36.29],
  ["Petra", "JO", 30.33, 35.44], ["Wadi Rum", "JO", 29.58, 35.42], ["Mar Muerto", "JO", 31.56, 35.55],
  ["Machu Picchu", "PE", -13.16, -72.54], ["Valle Sagrado", "PE", -13.33, -72.08], ["Huacachina", "PE", -14.09, -75.76],
  ["Salar de Uyuni", "BO", -20.13, -67.49], ["Lago Titicaca", "PE", -15.84, -69.33],
  ["Torres del Paine", "CL", -50.94, -73.41], ["Isla de Pascua", "CL", -27.12, -109.35],
  ["El Chaltén", "AR", -49.33, -72.89], ["Perito Moreno", "AR", -50.49, -73.05], ["Cataratas del Iguazú", "AR", -25.69, -54.44],
  ["Galápagos", "EC", -0.74, -90.31], ["Chichén Itzá", "MX", 20.68, -88.57], ["Holbox", "MX", 21.52, -87.38], ["Tikal", "GT", 17.22, -89.62],
  ["Gran Cañón", "US", 36.11, -112.11], ["Yosemite", "US", 37.75, -119.59], ["Parque Yellowstone", "US", 44.43, -110.59], ["Banff", "CA", 51.18, -115.57],
  ["Bora Bora", "PF", -16.5, -151.74], ["Uluru", "AU", -25.34, 131.04], ["Gran Barrera de Coral", "AU", -16.5, 146.0],
  ["Milford Sound", "NZ", -44.67, 167.93], ["Hobbiton", "NZ", -37.86, 175.68],
  ["Bahía de Ha Long", "VN", 20.95, 107.08], ["Trang An", "VN", 20.25, 105.9], ["Da Nang", "VN", 16.05, 108.2], ["Phong Nha", "VN", 17.59, 106.28],
  ["Angkor Wat", "KH", 13.41, 103.87], ["Bagan", "MM", 21.17, 94.86], ["Pai", "TH", 19.36, 98.44],
  ["Phi Phi", "TH", 7.74, 98.77], ["Ko Samui", "TH", 9.51, 100.01], ["Ko Pha Ngan", "TH", 9.73, 100.02], ["Ko Lanta", "TH", 7.62, 99.04],
  ["El Nido", "PH", 11.2, 119.4], ["Coron", "PH", 12.0, 120.2], ["Siargao", "PH", 9.85, 126.05], ["Boracay", "PH", 11.97, 121.92],
  ["Nusa Penida", "ID", -8.73, 115.54], ["Uluwatu", "ID", -8.83, 115.09], ["Gili Trawangan", "ID", -8.35, 116.04], ["Labuan Bajo", "ID", -8.49, 119.89], ["Borobudur", "ID", -7.61, 110.2],
  ["Hakone", "JP", 35.23, 139.1], ["Nikko", "JP", 36.75, 139.6], ["Miyajima", "JP", 34.3, 132.32], ["Monte Fuji", "JP", 35.36, 138.73], ["Shirakawa-go", "JP", 36.26, 136.9],
  ["Jeju", "KR", 33.49, 126.53], ["Muralla China", "CN", 40.43, 116.57], ["Zhangjiajie", "CN", 29.12, 110.48],
  ["Taj Mahal", "IN", 27.18, 78.04], ["Goa", "IN", 15.5, 73.83], ["Everest (campo base)", "NP", 28.0, 86.85],
  ["Maldivas", "MV", 3.2, 73.22], ["Sigiriya", "LK", 7.96, 80.76], ["Ella", "LK", 6.87, 81.05],
  ["Capadocia", "TR", 38.64, 34.83], ["Pamukkale", "TR", 37.92, 29.12], ["Kaş", "TR", 36.2, 29.64],
  ["Merzouga", "MA", 31.1, -4.01], ["Chefchaouen", "MA", 35.17, -5.27], ["Aït Ben Haddou", "MA", 31.05, -7.13],
  ["Pirámides de Guiza", "EG", 29.98, 31.13], ["Abu Simbel", "EG", 22.34, 31.63],
  ["Serengeti", "TZ", -2.33, 34.83], ["Kilimanjaro", "TZ", -3.07, 37.35], ["Masái Mara", "KE", -1.49, 35.14],
  ["Cataratas Victoria", "ZW", -17.92, 25.86], ["Sossusvlei", "NA", -24.73, 15.29], ["Delta del Okavango", "BW", -19.3, 22.9], ["Parque Kruger", "ZA", -24.01, 31.49],
  ["Seychelles", "SC", -4.62, 55.45], ["Mauricio", "MU", -20.25, 57.55],
  ["Santorini", "GR", 36.42, 25.43], ["Mykonos", "GR", 37.45, 25.33], ["Meteora", "GR", 39.72, 21.63], ["Zakynthos", "GR", 37.78, 20.9],
  ["Cinque Terre", "IT", 44.13, 9.71], ["Amalfi", "IT", 40.63, 14.6], ["Positano", "IT", 40.63, 14.48], ["Capri", "IT", 40.55, 14.24], ["Dolomitas", "IT", 46.55, 11.85], ["Lago de Como", "IT", 46.0, 9.25], ["Toscana", "IT", 43.3, 11.3],
  ["Hallstatt", "AT", 47.56, 13.65], ["Interlaken", "CH", 46.69, 7.86], ["Zermatt", "CH", 46.02, 7.75], ["Chamonix", "FR", 45.92, 6.87],
  ["Mont Saint-Michel", "FR", 48.64, -1.51], ["Provenza", "FR", 43.9, 5.2], ["Córcega", "FR", 42.15, 9.1],
  ["Plitvice", "HR", 44.88, 15.62], ["Hvar", "HR", 43.17, 16.44], ["Kotor", "ME", 42.42, 18.77], ["Bled", "SI", 46.37, 14.11],
  ["Giethoorn", "NL", 52.74, 6.08], ["Sintra", "PT", 38.8, -9.39], ["Algarve", "PT", 37.09, -8.25], ["Madeira", "PT", 32.75, -16.95], ["Azores", "PT", 37.78, -25.5],
  ["Ronda", "ES", 36.74, -5.16], ["Cabo de Gata", "ES", 36.78, -2.1], ["Menorca", "ES", 39.95, 4.1], ["Formentera", "ES", 38.7, 1.45], ["Lanzarote", "ES", 29.04, -13.63], ["Picos de Europa", "ES", 43.2, -4.85],
  ["Islas Lofoten", "NO", 68.2, 13.9], ["Geirangerfjord", "NO", 62.1, 7.1], ["Preikestolen", "NO", 58.99, 6.19],
  ["Jökulsárlón", "IS", 64.05, -16.18], ["Vík", "IS", 63.42, -19.01], ["Círculo Dorado", "IS", 64.26, -20.3],
  ["Laponia", "FI", 66.5, 25.73], ["Rovaniemi", "FI", 66.5, 25.73], ["Highlands", "GB", 57.3, -5.0], ["Isla de Skye", "GB", 57.3, -6.2],
  ["Moraine Lake", "CA", 51.32, -116.18], ["Cancún", "MX", 21.16, -86.85], ["Tulum", "MX", 20.21, -87.46],
];

// Places travellers look for even though they are small.
const TOURIST = [
  ["Florence", "IT"], ["Venice", "IT"], ["Cusco", "PE"], ["Granada", "ES"], ["Dubrovnik", "HR"], ["Reykjavík", "IS"],
  ["Kyoto", "JP"], ["Nara-shi", "JP"], ["Hoi An", "VN"], ["Luang Prabang", "LA"], ["Chiang Mai", "TH"], ["Siem Reap", "KH"],
  ["Queenstown", "NZ"], ["Marrakesh", "MA"], ["Fès", "MA"], ["Chefchaouene", "MA"], ["Luxor", "EG"], ["Aswan", "EG"],
  ["Petra", "JO"], ["Santorini", "GR"], ["Mykonos", "GR"], ["Porto", "PT"], ["Seville", "ES"], ["Salzburg", "AT"],
  ["Brugge", "BE"], ["Edinburgh", "GB"], ["Split", "HR"], ["Tromsø", "NO"], ["Bergen", "NO"], ["Zanzibar", "TZ"],
  ["Ubud", "ID"], ["Denpasar", "ID"], ["Cancún", "MX"], ["Tulum", "MX"], ["Oaxaca", "MX"], ["Cartagena", "CO"],
  ["Ushuaia", "AR"], ["El Calafate", "AR"], ["San Pedro de Atacama", "CL"], ["Uyuni", "BO"], ["Havana", "CU"],
  ["Nice", "FR"], ["Amalfi", "IT"], ["Positano", "IT"], ["Lucerne", "CH"], ["Interlaken", "CH"], ["Hallstatt", "AT"],
  ["Kotor", "ME"], ["Ljubljana", "SI"], ["Bled", "SI"], ["Valletta", "MT"], ["Palma", "ES"], ["Ibiza", "ES"],
  ["San Sebastián", "ES"], ["Donostia / San Sebastián", "ES"], ["Málaga", "ES"], ["Almería", "ES"], ["Valencia", "ES"],
];

const round = (n) => Math.round(n * 100) / 100;

// world-countries' Spanish names that differ from common Spanish usage.
const COUNTRY_ES = {
  Iran: "Irán", Bahrein: "Baréin", Brunei: "Brunéi", Botswana: "Botsuana", Djibouti: "Yibuti", "Sierra Leone": "Sierra Leona",
  Suazilandia: "Esuatini", "Kirguizistán": "Kirguistán", Lesotho: "Lesoto", Malawi: "Malaui", "Islas Faroe": "Islas Feroe",
  "Congo (Rep. Dem.)": "R. D. del Congo", Mali: "Malí", Grenada: "Granada",
};
const outCountries = countries
  .filter((c) => c.area > 300 && c.latlng?.length === 2)
  .map((c) => ({
    n: COUNTRY_ES[c.translations?.spa?.common] || c.translations?.spa?.common || c.name.common,
    c: c.cca2,
    lat: round(c.latlng[0]),
    lng: round(c.latlng[1]),
    t: c.area > 1_000_000 ? 1 : c.area > 150_000 ? 2 : 3,
  }));

const byKey = new Map();
const add = (c, tier) => {
  const key = c.cityId;
  const prev = byKey.get(key);
  if (prev && prev.t <= tier) return;
  const [lng, lat] = c.loc.coordinates;
  byKey.set(key, { n: nameOf(c), lat: round(lat), lng: round(lng), t: tier, c: c.country });
};
// Spanish writes Vietnamese places without tone marks (Hội An → Hoi An).
const plain = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "D").replace(/đ/g, "d");
// Same for GeoNames' scholarly transliterations of Arabic, Persian and Turkic names (Ḩamāh → Hamah).
const PLAIN = new Set(["VN", "SY", "IQ", "SA", "JO", "LB", "YE", "OM", "AE", "QA", "KW", "BH", "EG", "LY", "SD", "IR", "AF", "PK", "UZ", "TM", "KZ", "KG", "TJ", "AZ", "MA", "DZ", "TN", "MR"]);
const nameOf = (c) => ES[c.name] || ES[plain(c.name)] || (PLAIN.has(c.country) ? plain(c.name).replace(/[ʻʼ‘’`]/g, "'") : c.name);
for (const c of cities) {
  const capital = c.featureCode === "PPLC";
  if (c.population >= 7_000_000) add(c, 1);
  else if (c.population >= 2_000_000 || (capital && c.population >= 300_000)) add(c, 2);
  else if (c.population >= 500_000 || capital) add(c, 3);
  else if (c.population >= 150_000) add(c, 4);
  else if (c.population >= 50_000) add(c, 5);
}
for (const [name, cc] of TOURIST) {
  const hit = cities
    .filter((c) => c.country === cc && (c.name === name || c.altName?.split(",").includes(name)))
    .sort((a, b) => b.population - a.population)[0];
  if (hit) add(hit, 3);
}
for (const [name, cc] of [["Tadmur", "SY"], ["Hội An", "VN"], ["Huế", "VN"], ["Ninh Bình", "VN"], ["Sa Pa", "VN"], ["Luang Prabang", "LA"], ["Siem Reap", "KH"],
  ["Kampot", "KH"], ["Krabi", "TH"], ["Uyuni", "BO"], ["Puno", "PE"], ["Arequipa", "PE"], ["Oaxaca", "MX"], ["Bacalar", "MX"], ["Antigua Guatemala", "GT"],
  ["Puerto Natales", "CL"], ["Takayama", "JP"], ["Kanazawa", "JP"], ["Ubud", "ID"], ["Essaouira", "MA"], ["Mostar", "BA"], ["Fethiye", "TR"], ["Göreme", "TR"]]) {
  const hit = cities.filter((c) => c.country === cc && c.name === name).sort((a, b) => b.population - a.population)[0];
  if (hit) add(hit, 3);
}
const taken = new Set([...byKey.values()].map((c) => c.n.toLowerCase() + c.c));
for (const [n, c, lat, lng] of SPOTS) if (!taken.has(n.toLowerCase() + c)) byKey.set(`s:${n}`, { n, lat, lng, t: 3, c, s: 1 });

const all = [...byKey.values()].sort((a, b) => a.t - b.t);
const outCities = all.filter((c) => c.t <= 3);
const more = all.filter((c) => c.t > 3);

writeFileSync(new URL("../lib/places.json", import.meta.url), JSON.stringify({ countries: outCountries, cities: outCities }));
writeFileSync(new URL("../public/cities.json", import.meta.url), JSON.stringify(more));
console.log(`countries ${outCountries.length}, cities ${outCities.length} bundled + ${more.length} loaded later`);
