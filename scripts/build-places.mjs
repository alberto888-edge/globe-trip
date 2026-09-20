// Builds lib/places.json: country and city labels for the globe, in Spanish.
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
};

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

const outCountries = countries
  .filter((c) => c.area > 300 && c.latlng?.length === 2)
  .map((c) => ({
    n: c.translations?.spa?.common || c.name.common,
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
  byKey.set(key, { n: ES[c.name] || c.name, lat: round(lat), lng: round(lng), t: tier });
};
for (const c of cities) {
  const capital = c.featureCode === "PPLC";
  if (c.population >= 7_000_000) add(c, 1);
  else if (c.population >= 2_000_000 || (capital && c.population >= 300_000)) add(c, 2);
  else if (c.population >= 600_000 || capital) add(c, 3);
}
for (const [name, cc] of TOURIST) {
  const hit = cities
    .filter((c) => c.country === cc && (c.name === name || c.altName?.split(",").includes(name)))
    .sort((a, b) => b.population - a.population)[0];
  if (hit) add(hit, 3);
}
const outCities = [...byKey.values()].sort((a, b) => a.t - b.t);

writeFileSync(new URL("../lib/places.json", import.meta.url), JSON.stringify({ countries: outCountries, cities: outCities }));
console.log(`countries ${outCountries.length}, cities ${outCities.length} (t1 ${outCities.filter((c) => c.t === 1).length}, t2 ${outCities.filter((c) => c.t === 2).length}, t3 ${outCities.filter((c) => c.t === 3).length})`);
