// English versions of the ready-made trips in lib/trips.ts, by trip id. Same stops in the
// same order; coordinates, days, prices and photos come from the Spanish file.

export interface TripEn {
  name: string; tag: string; destination: string; summary: string;
  stops: [name: string, country: string, sub: string, note: string][];
  budget: string[]; // labels, in the same order as the Spanish budget
  tips: string[];
  risks: { summary: string; points: string[] };
}

export const TRIPS_EN: Record<string, TripEn> = {
  indochina: {
    name: "Vietnam, Cambodia and Thailand", tag: "Southeast Asia's great classic", destination: "Vietnam, Cambodia and Thailand",
    summary: "North to south through Vietnam, the temples of Angkor and a finish on southern Thailand's islands. Short internal flights between countries.",
    stops: [
      ["Hanoi", "Vietnam", "Old Quarter", "The Old Quarter, Hoan Kiem Lake and egg coffee. Street food on Train Street."],
      ["Ha Long Bay", "Vietnam", "Cruise among the islets", "A night on a boat among limestone pillars; Lan Ha Bay is quieter."],
      ["Ninh Binh", "Vietnam", "Rice fields and karst", "Boat through Tam Coc and Trang An, then climb to the Hang Mua viewpoint at sunset."],
      ["Hoi An", "Vietnam", "Lantern town", "The old town, tailors, An Bang beach and a trip to My Son."],
      ["Ho Chi Minh City", "Vietnam", "Saigon and the Mekong", "Ben Thanh Market, the War Remnants Museum and a day in the Mekong Delta."],
      ["Siem Reap", "Cambodia", "Temples of Angkor", "Sunrise at Angkor Wat, Bayon and Ta Prohm; hire a tuk-tuk by the day."],
      ["Bangkok", "Thailand", "Temples and markets", "The Grand Palace, Wat Pho, Wat Arun and night markets. A boat on the Chao Phraya."],
      ["Krabi", "Thailand", "Beaches and islands", "Railay, a trip to the Phi Phi islands and kayaking through mangroves."],
    ],
    budget: ["Flights", "Accommodation", "Food", "Local transport", "Activities"],
    tips: ["Best time: November to March (central Vietnam is rainy in October-November).", "Vietnam and Cambodia need an e-visa; apply before you go.", "Cheap internal flights: Hanoi–Da Nang, Saigon–Siem Reap, Siem Reap–Bangkok."],
    risks: { summary: "Easy places for travellers; the risks are petty theft, traffic and health.", points: ["Bag snatching from motorbikes in Saigon and Bangkok: keep your phone on the inside.", "Check vaccinations (hepatitis A, typhoid) and use repellent against dengue.", "Don't rent a motorbike without an international licence: insurance won't cover you."] },
  },
  "atacama-uyuni": {
    name: "Atacama and the Uyuni Salt Flat", tag: "Desert, lagoons and the mirror of the world", destination: "Atacama Desert and Uyuni Salt Flat",
    summary: "From the driest desert on Earth to the largest salt flat, crossing the high plateau by 4x4 past coloured lagoons and geysers.",
    stops: [
      ["San Pedro de Atacama", "Chile", "Desert base", "Valle de la Luna at sunset, high-altitude lagoons, the El Tatio geysers and a night of stars."],
      ["Eduardo Avaroa Reserve", "Bolivia", "Coloured lagoons", "Laguna Colorada with flamingos and Laguna Verde, day one of the 4x4 tour."],
      ["Uyuni Salt Flat", "Bolivia", "The great salt flat", "Sunrise on the salt, Incahuasi Island and perspective photos; in the rainy season, the mirror effect."],
      ["Potosí", "Bolivia", "Colonial mining town", "The Royal Mint and the colonial centre at 4,000 m."],
      ["La Paz", "Bolivia", "City in the clouds", "Cable cars, the Witches' Market and a trip to the Valley of the Moon or Tiwanaku."],
    ],
    budget: ["Flights", "Accommodation", "Food", "Local transport", "Uyuni 4x4 tour", "Activities"],
    tips: ["Fly into Calama (via Santiago) and out of La Paz so you don't double back.", "Book the 3-day San Pedro–Uyuni tour in San Pedro; pick an agency with good recent reviews.", "Mirror effect on the salt flat: January to March; clear skies: May to October."],
    risks: { summary: "A safe area; the main risks are altitude and cold.", points: ["Altitude sickness: you go above 4,500 m. Acclimatise in San Pedro and drink plenty of water.", "Sub-zero nights on the plateau: bring thermals and a sleeping bag.", "Bolivia can have road blockades during protests: leave a spare day."] },
  },
  japon: {
    name: "Essential Japan", tag: "Tokyo, Kyoto and the classics", destination: "Japan",
    summary: "The perfect first-timer route: the big city, mountains by Mount Fuji, Kyoto's temples and on to Hiroshima.",
    stops: [
      ["Tokyo", "Japan", "Neon and neighbourhoods", "Shibuya, Asakusa, Harajuku and Shinjuku; an optional day trip to Nikko or Kamakura."],
      ["Hakone", "Japan", "Hot springs and Mount Fuji", "A night in a ryokan with an onsen and views of Fuji from Lake Ashi."],
      ["Kyoto", "Japan", "Temples and geishas", "Fushimi Inari at dawn, Kinkaku-ji, Arashiyama and Gion at night."],
      ["Nara", "Japan", "Deer and the Great Buddha", "Todai-ji and the deer park, as a day trip."],
      ["Osaka", "Japan", "Japan's kitchen", "Dotonbori, takoyaki and Osaka Castle."],
      ["Hiroshima", "Japan", "Memory and Miyajima", "The Peace Park and Miyajima's floating torii gate."],
    ],
    budget: ["Flights", "Accommodation", "Food", "Transport (rail)", "Activities"],
    tips: ["Best time: spring (cherry blossom, late March-April) or autumn (November).", "Compare the JR Pass with single tickets: since the price rise it doesn't always pay off.", "Book the Hakone ryokan and teamLab tickets well ahead."],
    risks: { summary: "One of the safest countries in the world.", points: ["Earthquakes and typhoons (August-September): follow local alerts.", "Cash is still widely used in small places."] },
  },
  peru: {
    name: "Peru: Lima to Machu Picchu", tag: "Andes, Lake Titicaca and the Incas", destination: "Peru",
    summary: "Climbing slowly to acclimatise: the coast, Arequipa, Lake Titicaca and a finish in Cusco and Machu Picchu.",
    stops: [
      ["Lima", "Peru", "Food capital", "Miraflores, Barranco and a dinner of ceviche and Nikkei cooking."],
      ["Arequipa", "Peru", "The White City", "Santa Catalina Monastery and a trip to the Colca Canyon to see condors."],
      ["Puno", "Peru", "Lake Titicaca", "The Uros floating islands and a night on Amantaní or Taquile."],
      ["Cusco", "Peru", "Inca capital", "Plaza de Armas, San Blas, Sacsayhuamán and Rainbow Mountain."],
      ["Sacred Valley", "Peru", "Villages and terraces", "Pisac, Moray and the Maras salt pans on the way to Ollantaytambo."],
      ["Machu Picchu", "Peru", "The lost city", "Train to Aguas Calientes and an early visit with the climb up Huayna Picchu."],
    ],
    budget: ["Flights", "Accommodation", "Food", "Local transport", "Machu Picchu tickets and train"],
    tips: ["Best time: May to September (dry season).", "Machu Picchu tickets and the train: book weeks ahead.", "Gain altitude slowly; coca tea helps."],
    risks: { summary: "A safe tourist route with normal precautions.", points: ["Altitude sickness in Puno and Cusco (over 3,400 m).", "Taxis: book through an app or your hotel, not on the street.", "Possible protests and road closures: keep an eye on local news."] },
  },
  islandia: {
    name: "Iceland: the Ring Road", tag: "Glaciers, waterfalls and northern lights", destination: "Iceland",
    summary: "The full loop of the island by car: southern waterfalls, the glacier lagoon, the eastern fjords and the volcanic north.",
    stops: [
      ["Reykjavík", "Iceland", "Capital and Blue Lagoon", "Hallgrímskirkja, the harbour and a geothermal soak on arrival."],
      ["Golden Circle", "Iceland", "Geysers and waterfalls", "Þingvellir, Geysir and Gullfoss."],
      ["Vík", "Iceland", "Black sand beach", "Seljalandsfoss, Skógafoss and Reynisfjara beach."],
      ["Jökulsárlón", "Iceland", "Glacier lagoon", "Icebergs in the lagoon and Diamond Beach; an ice cave in winter."],
      ["East Fjords", "Iceland", "Villages between fjords", "The coast road and Seyðisfjörður."],
      ["Mývatn", "Iceland", "Volcanic land", "Craters, Dettifoss and the Mývatn Nature Baths."],
      ["Akureyri", "Iceland", "Capital of the north", "Whale watching from Húsavík and Goðafoss waterfall."],
      ["Snæfellsnes", "Iceland", "Iceland in miniature", "Kirkjufell, sea cliffs and the Snæfellsjökull glacier before heading back."],
    ],
    budget: ["Flights", "Accommodation", "Food", "Car and fuel", "Activities"],
    tips: ["Summer: endless days and every road open. Winter: northern lights, but drive with care.", "Get a car with gravel insurance; a 4x4 in winter.", "Supermarkets (Bónus, Krónan) save a lot."],
    risks: { summary: "A very safe country; the danger is nature.", points: ["Changeable weather and strong wind: check safetravel.is and road.is every day.", "Sneaker waves at Reynisfjara: stay away from the water.", "Volcanic activity on Reykjanes: respect closures."] },
  },
  marruecos: {
    name: "Morocco: medinas and desert", tag: "Marrakesh, the Sahara and Fez", destination: "Morocco",
    summary: "From Marrakesh to the desert over the Atlas and through the valley of the kasbahs, finishing in the medinas of Fez and Chefchaouen.",
    stops: [
      ["Marrakesh", "Morocco", "Medina and souks", "Jemaa el-Fnaa square, Majorelle Garden, Bahia Palace and a night in a riad."],
      ["Aït Ben Haddou", "Morocco", "A ksar from the movies", "Over the Atlas by the Tizi n'Tichka pass and the ksar at sunset."],
      ["Dades Valley", "Morocco", "Gorges and kasbahs", "The Dades hairpins and the Todra Gorge."],
      ["Merzouga", "Morocco", "Sahara dunes", "A camel ride at sunset over Erg Chebbi and a night in a desert camp under the stars."],
      ["Fez", "Morocco", "The great medina", "The maze of Fez el-Bali, the tanneries and the madrasas."],
      ["Chefchaouen", "Morocco", "The blue town", "Blue alleys and the viewpoint at the Spanish Mosque."],
    ],
    budget: ["Flights", "Accommodation", "Food", "Transport / driver", "Activities"],
    tips: ["Best time: spring and autumn; in summer the desert goes above 45 °C.", "Fly into Marrakesh and out of Fez or Tangier.", "Haggle with good humour in the souks and agree prices first."],
    risks: { summary: "A safe destination with normal precautions.", points: ["Fake guides and commissions in the medinas: say no politely.", "Mountain roads: better with a driver or by day.", "Dress modestly outside tourist areas."] },
  },
  italia: {
    name: "Classic Italy", tag: "Venice, Florence, Tuscany and Rome", destination: "Italy",
    summary: "By train from north to south: canals, the Renaissance, Tuscan hills and the Eternal City.",
    stops: [
      ["Venice", "Italy", "Canals and gondolas", "St Mark's, the Rialto and getting lost in Cannaregio; Burano by vaporetto."],
      ["Florence", "Italy", "Cradle of the Renaissance", "The Duomo, the Uffizi, Michelangelo's David and sunset at Piazzale Michelangelo."],
      ["Siena", "Italy", "Medieval Tuscany", "Piazza del Campo and the Chianti vineyards."],
      ["Rome", "Italy", "The Eternal City", "The Colosseum, the Forum, the Vatican, Trastevere and the Trevi Fountain at night."],
    ],
    budget: ["Flights", "Accommodation", "Food", "Trains", "Tickets"],
    tips: ["Book the Uffizi, the Vatican and the Colosseum ahead.", "High-speed trains (Frecciarossa, Italo) are cheaper the earlier you buy.", "Fly into Venice and out of Rome."],
    risks: { summary: "Very safe; watch out for pickpockets.", points: ["Pickpockets on the Rome metro and in tourist areas.", "Some cities charge a tourist fee (Venice on peak days)."] },
  },
  "costa-rica": {
    name: "Costa Rica pura vida", tag: "Volcanoes, rainforest and two oceans", destination: "Costa Rica",
    summary: "Nature at its purest: Arenal volcano, the Monteverde cloud forest and beaches with monkeys at Manuel Antonio.",
    stops: [
      ["San José", "Costa Rica", "Arrival", "Arrival night and an early start north."],
      ["La Fortuna", "Costa Rica", "Arenal volcano", "Hanging bridges, La Fortuna waterfall and hot springs."],
      ["Monteverde", "Costa Rica", "Cloud forest", "A night wildlife walk, ziplines and the cloud forest reserve."],
      ["Manuel Antonio", "Costa Rica", "Beaches and monkeys", "The national park with a guide, beaches and a Pacific sunset."],
    ],
    budget: ["Flights", "Accommodation", "Food", "Car hire", "Activities"],
    tips: ["Dry season: December to April.", "A 4x4 for Monteverde; mandatory insurance makes hire pricier.", "With a guide in the parks you see far more wildlife."],
    risks: { summary: "Safe for tourists, though petty theft has grown.", points: ["Leave nothing visible in the car.", "Strong currents on some Pacific beaches: swim where there are lifeguards.", "Use repellent: there is dengue."] },
  },
  balcanes: {
    name: "Balkans: Croatia, Bosnia and Montenegro", tag: "Lakes, the Dalmatian coast and the Bay of Kotor", destination: "Croatia, Bosnia and Herzegovina and Montenegro",
    summary: "The Plitvice Lakes, the Dalmatian coast, Mostar's bridge and the Bay of Kotor, by car or bus.",
    stops: [
      ["Zagreb", "Croatia", "Capital", "The Upper Town and Dolac market."],
      ["Plitvice", "Croatia", "Turquoise lakes", "Boardwalks between lakes and waterfalls, first thing in the morning."],
      ["Split", "Croatia", "Roman palace", "Diocletian's Palace and a trip to Hvar or Krka."],
      ["Mostar", "Bosnia and Herzegovina", "The Old Bridge", "Stari Most, the Ottoman bazaar and Kravica waterfalls."],
      ["Dubrovnik", "Croatia", "Pearl of the Adriatic", "A walk on the city walls, kayaking and Lokrum island."],
      ["Kotor", "Montenegro", "A bay among mountains", "The climb to the fortress and Perast by boat."],
    ],
    budget: ["Flights", "Accommodation", "Food", "Transport / car", "Tickets"],
    tips: ["Best in June or September: fewer people and a warm sea.", "If you hire a car, ask for the green card for Bosnia and Montenegro.", "Fly into Zagreb and out of Dubrovnik or Tivat."],
    risks: { summary: "A safe region to travel.", points: ["In rural Bosnia, stay on marked paths (leftover landmines).", "Long border queues in summer."] },
  },
  egipto: {
    name: "Egypt: pyramids and the Nile", tag: "Cairo, Abu Simbel, Aswan and Luxor", destination: "Egypt",
    summary: "The pyramids and the Egyptian Museum, then down the Nile from Abu Simbel to the temples and tombs of Luxor.",
    stops: [
      ["Cairo", "Egypt", "Pyramids and museum", "The Pyramids of Giza, the Grand Egyptian Museum and Islamic Cairo."],
      ["Abu Simbel", "Egypt", "Temples of Ramesses II", "A flight or convoy from Aswan, first thing in the morning."],
      ["Aswan", "Egypt", "The Nile by felucca", "Philae Temple, a Nubian village and a felucca ride."],
      ["Luxor", "Egypt", "Temples and the Valley of the Kings", "Karnak, Luxor Temple at night, the Valley of the Kings and a balloon at sunrise."],
    ],
    budget: ["Flights", "Accommodation / cruise", "Food", "Internal transport", "Tickets"],
    tips: ["Best from October to April.", "A 3-4 night Aswan–Luxor cruise: comfortable, with visits included.", "Carry cash in euros or dollars for tips."],
    risks: { summary: "The Nile's tourist areas are safe; official advice is against northern Sinai and the borders.", points: ["Don't travel to northern Sinai or the Libyan border.", "Pushy sellers and scams at the pyramids: agree prices first.", "Check official travel advice before you go, given the situation in the Middle East."] },
  },
};
