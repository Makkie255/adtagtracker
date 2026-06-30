export type GeoLocation = {
  country: string;
  regions: string[];
};

/**
 * Countries and their most highly populated metros / regions for scan geo targeting.
 * Regions are major cities or administrative areas that cover the bulk of each country's population.
 */
export const GEO_LOCATIONS: GeoLocation[] = [
  {
    country: "USA",
    regions: [
      "New York Metro",
      "Los Angeles",
      "Chicago",
      "Houston",
      "Phoenix",
      "Philadelphia",
      "San Antonio",
      "San Diego",
      "Dallas",
      "San Jose",
      "Austin",
      "Jacksonville",
      "Fort Worth",
      "Columbus",
      "Charlotte",
      "San Francisco",
      "Indianapolis",
      "Seattle",
      "Denver",
      "Washington DC",
      "Boston",
      "Nashville",
      "Detroit",
      "Portland",
      "Las Vegas",
      "Miami",
      "Atlanta",
      "Minneapolis",
      "Tampa",
      "Baltimore",
      "St. Louis",
      "Orlando",
      "Sacramento",
      "Pittsburgh",
      "Cincinnati",
      "Kansas City",
      "Cleveland",
      "Riverside",
    ],
  },
  {
    country: "Canada",
    regions: [
      "Toronto",
      "Montreal",
      "Vancouver",
      "Calgary",
      "Edmonton",
      "Ottawa",
      "Winnipeg",
      "Quebec City",
      "Hamilton",
      "Kitchener",
    ],
  },
  {
    country: "UK",
    regions: [
      "London",
      "Birmingham",
      "Manchester",
      "Leeds",
      "Glasgow",
      "Liverpool",
      "Bristol",
      "Sheffield",
      "Edinburgh",
      "Leicester",
      "Cardiff",
      "Belfast",
    ],
  },
  {
    country: "Ireland",
    regions: ["Dublin", "Cork", "Limerick", "Galway"],
  },
  {
    country: "Australia",
    regions: [
      "Sydney",
      "Melbourne",
      "Brisbane",
      "Perth",
      "Adelaide",
      "Gold Coast",
      "Canberra",
      "Newcastle",
      "Hobart",
    ],
  },
  {
    country: "New Zealand",
    regions: ["Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga"],
  },
  {
    country: "Germany",
    regions: [
      "Berlin",
      "Hamburg",
      "Munich",
      "Cologne",
      "Frankfurt",
      "Stuttgart",
      "Düsseldorf",
      "Leipzig",
      "Dortmund",
      "Essen",
      "Bremen",
      "Dresden",
      "Hanover",
      "Nuremberg",
    ],
  },
  {
    country: "France",
    regions: [
      "Paris",
      "Lyon",
      "Marseille",
      "Toulouse",
      "Nice",
      "Nantes",
      "Strasbourg",
      "Montpellier",
      "Bordeaux",
      "Lille",
    ],
  },
  {
    country: "Spain",
    regions: [
      "Madrid",
      "Barcelona",
      "Valencia",
      "Seville",
      "Zaragoza",
      "Málaga",
      "Murcia",
      "Palma",
      "Bilbao",
      "Alicante",
    ],
  },
  {
    country: "Italy",
    regions: [
      "Rome",
      "Milan",
      "Naples",
      "Turin",
      "Palermo",
      "Genoa",
      "Bologna",
      "Florence",
      "Bari",
      "Catania",
    ],
  },
  {
    country: "Netherlands",
    regions: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Groningen"],
  },
  {
    country: "Belgium",
    regions: ["Brussels", "Antwerp", "Ghent", "Charleroi", "Liège", "Bruges"],
  },
  {
    country: "Switzerland",
    regions: ["Zürich", "Geneva", "Basel", "Bern", "Lausanne"],
  },
  {
    country: "Austria",
    regions: ["Vienna", "Graz", "Linz", "Salzburg", "Innsbruck"],
  },
  {
    country: "Sweden",
    regions: ["Stockholm", "Gothenburg", "Malmö", "Uppsala"],
  },
  {
    country: "Norway",
    regions: ["Oslo", "Bergen", "Trondheim", "Stavanger"],
  },
  {
    country: "Denmark",
    regions: ["Copenhagen", "Aarhus", "Odense", "Aalborg"],
  },
  {
    country: "Finland",
    regions: ["Helsinki", "Espoo", "Tampere", "Turku", "Oulu"],
  },
  {
    country: "Poland",
    regions: ["Warsaw", "Kraków", "Łódź", "Wrocław", "Poznań", "Gdańsk"],
  },
  {
    country: "Portugal",
    regions: ["Lisbon", "Porto", "Braga", "Coimbra", "Faro"],
  },
  {
    country: "Japan",
    regions: [
      "Tokyo",
      "Yokohama",
      "Osaka",
      "Nagoya",
      "Sapporo",
      "Fukuoka",
      "Kobe",
      "Kyoto",
      "Kawasaki",
      "Hiroshima",
    ],
  },
  {
    country: "South Korea",
    regions: ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju"],
  },
  {
    country: "China",
    regions: [
      "Shanghai",
      "Beijing",
      "Guangzhou",
      "Shenzhen",
      "Chengdu",
      "Chongqing",
      "Tianjin",
      "Wuhan",
      "Hangzhou",
      "Nanjing",
      "Xi'an",
      "Suzhou",
    ],
  },
  {
    country: "Hong Kong",
    regions: ["Hong Kong Island", "Kowloon", "New Territories"],
  },
  {
    country: "Taiwan",
    regions: ["Taipei", "Kaohsiung", "Taichung", "Tainan", "Hsinchu"],
  },
  {
    country: "India",
    regions: [
      "Mumbai",
      "Delhi",
      "Bangalore",
      "Hyderabad",
      "Chennai",
      "Kolkata",
      "Pune",
      "Ahmedabad",
      "Jaipur",
      "Surat",
      "Lucknow",
    ],
  },
  {
    country: "Singapore",
    regions: ["Central", "East", "North", "North-East", "West"],
  },
  {
    country: "Indonesia",
    regions: ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Makassar"],
  },
  {
    country: "Malaysia",
    regions: ["Kuala Lumpur", "George Town", "Johor Bahru", "Ipoh", "Shah Alam"],
  },
  {
    country: "Thailand",
    regions: ["Bangkok", "Chiang Mai", "Pattaya", "Phuket", "Hat Yai"],
  },
  {
    country: "Philippines",
    regions: ["Manila", "Quezon City", "Davao", "Cebu City", "Zamboanga"],
  },
  {
    country: "Vietnam",
    regions: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Can Tho"],
  },
  {
    country: "UAE",
    regions: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"],
  },
  {
    country: "Saudi Arabia",
    regions: ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam"],
  },
  {
    country: "Israel",
    regions: ["Tel Aviv", "Jerusalem", "Haifa", "Beersheba", "Netanya"],
  },
  {
    country: "Brazil",
    regions: [
      "São Paulo",
      "Rio de Janeiro",
      "Brasília",
      "Salvador",
      "Fortaleza",
      "Belo Horizonte",
      "Manaus",
      "Curitiba",
      "Recife",
      "Porto Alegre",
    ],
  },
  {
    country: "Mexico",
    regions: [
      "Mexico City",
      "Guadalajara",
      "Monterrey",
      "Puebla",
      "Tijuana",
      "León",
      "Juárez",
      "Mérida",
    ],
  },
  {
    country: "Argentina",
    regions: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "La Plata"],
  },
  {
    country: "Colombia",
    regions: ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"],
  },
  {
    country: "Chile",
    regions: ["Santiago", "Valparaíso", "Concepción", "La Serena", "Antofagasta"],
  },
  {
    country: "South Africa",
    regions: ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth"],
  },
  {
    country: "Egypt",
    regions: ["Cairo", "Alexandria", "Giza", "Shubra El Kheima", "Port Said"],
  },
  {
    country: "Nigeria",
    regions: ["Lagos", "Kano", "Ibadan", "Abuja", "Port Harcourt", "Benin City"],
  },
  {
    country: "Turkey",
    regions: ["Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana"],
  },
];

export function formatLocationId(country: string, region: string): string {
  return `${country}-${region}`;
}

export function getAllLocationIds(): string[] {
  return GEO_LOCATIONS.flatMap(({ country, regions }) =>
    regions.map((region) => formatLocationId(country, region)),
  );
}
