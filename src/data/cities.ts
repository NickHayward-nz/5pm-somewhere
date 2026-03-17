// Expanded city list - March 2025 - added to fill time zone gaps
export type City = {
  id: string
  name: string
  countryCode: string
  tz: string
  lat: number
  lon: number
}

// Expanded list of cities for dense global 5 PM coverage.
// Lat/Lon are approximate city centers for the globe visualization.
export const CITIES: City[] = [
  // Pacific / NZ / Australia
  { id: 'auckland', name: 'Auckland', countryCode: 'NZ', tz: 'Pacific/Auckland', lat: -36.8485, lon: 174.7633 },
  { id: 'wellington', name: 'Wellington', countryCode: 'NZ', tz: 'Pacific/Auckland', lat: -41.2865, lon: 174.7762 },
  { id: 'christchurch', name: 'Christchurch', countryCode: 'NZ', tz: 'Pacific/Auckland', lat: -43.5321, lon: 172.6362 },
  { id: 'fiji', name: 'Fiji', countryCode: 'FJ', tz: 'Pacific/Fiji', lat: -18.1248, lon: 178.4501 },
  { id: 'samoa', name: 'Samoa', countryCode: 'WS', tz: 'Pacific/Apia', lat: -13.8333, lon: -171.7667 },
  { id: 'sydney', name: 'Sydney', countryCode: 'AU', tz: 'Australia/Sydney', lat: -33.8688, lon: 151.2093 },
  { id: 'melbourne', name: 'Melbourne', countryCode: 'AU', tz: 'Australia/Melbourne', lat: -37.8136, lon: 144.9631 },
  { id: 'brisbane', name: 'Brisbane', countryCode: 'AU', tz: 'Australia/Brisbane', lat: -27.4698, lon: 153.0251 },
  { id: 'adelaide', name: 'Adelaide', countryCode: 'AU', tz: 'Australia/Adelaide', lat: -34.9285, lon: 138.6007 },
  { id: 'perth', name: 'Perth', countryCode: 'AU', tz: 'Australia/Perth', lat: -31.9505, lon: 115.8605 },
  { id: 'guam', name: 'Guam', countryCode: 'GU', tz: 'Pacific/Guam', lat: 13.4443, lon: 144.7937 },

  // Pacific US / Hawaii
  { id: 'honolulu', name: 'Honolulu', countryCode: 'US', tz: 'Pacific/Honolulu', lat: 21.3069, lon: -157.8583 },
  { id: 'anchorage', name: 'Anchorage', countryCode: 'US', tz: 'America/Anchorage', lat: 61.2181, lon: -149.9003 },
  { id: 'vancouver', name: 'Vancouver', countryCode: 'CA', tz: 'America/Vancouver', lat: 49.2827, lon: -123.1207 },
  { id: 'seattle', name: 'Seattle', countryCode: 'US', tz: 'America/Los_Angeles', lat: 47.6062, lon: -122.3321 },
  { id: 'san-francisco', name: 'San Francisco', countryCode: 'US', tz: 'America/Los_Angeles', lat: 37.7749, lon: -122.4194 },
  { id: 'los-angeles', name: 'Los Angeles', countryCode: 'US', tz: 'America/Los_Angeles', lat: 34.0522, lon: -118.2437 },
  { id: 'denver', name: 'Denver', countryCode: 'US', tz: 'America/Denver', lat: 39.7392, lon: -104.9903 },
  { id: 'phoenix', name: 'Phoenix', countryCode: 'US', tz: 'America/Phoenix', lat: 33.4484, lon: -112.0740 },
  { id: 'mexico-city', name: 'Mexico City', countryCode: 'MX', tz: 'America/Mexico_City', lat: 19.4326, lon: -99.1332 },
  { id: 'chicago', name: 'Chicago', countryCode: 'US', tz: 'America/Chicago', lat: 41.8781, lon: -87.6298 },
  { id: 'new-orleans', name: 'New Orleans', countryCode: 'US', tz: 'America/Chicago', lat: 29.9511, lon: -90.0715 },
  { id: 'toronto', name: 'Toronto', countryCode: 'CA', tz: 'America/Toronto', lat: 43.6532, lon: -79.3832 },
  { id: 'new-york', name: 'New York', countryCode: 'US', tz: 'America/New_York', lat: 40.7128, lon: -74.0060 },
  { id: 'miami', name: 'Miami', countryCode: 'US', tz: 'America/New_York', lat: 25.7617, lon: -80.1918 },
  { id: 'montreal', name: 'Montreal', countryCode: 'CA', tz: 'America/Toronto', lat: 45.5017, lon: -73.5673 },
  { id: 'bogota', name: 'Bogota', countryCode: 'CO', tz: 'America/Bogota', lat: 4.7110, lon: -74.0721 },
  { id: 'lima', name: 'Lima', countryCode: 'PE', tz: 'America/Lima', lat: -12.0464, lon: -77.0428 },
  { id: 'santiago', name: 'Santiago', countryCode: 'CL', tz: 'America/Santiago', lat: -33.4489, lon: -70.6693 },
  { id: 'buenos-aires', name: 'Buenos Aires', countryCode: 'AR', tz: 'America/Argentina/Buenos_Aires', lat: -34.6037, lon: -58.3816 },
  { id: 'sao-paulo', name: 'Sao Paulo', countryCode: 'BR', tz: 'America/Sao_Paulo', lat: -23.5505, lon: -46.6333 },
  { id: 'rio', name: 'Rio de Janeiro', countryCode: 'BR', tz: 'America/Sao_Paulo', lat: -22.9068, lon: -43.1729 },
  { id: 'fernando-de-noronha', name: 'Fernando de Noronha', countryCode: 'BR', tz: 'America/Noronha', lat: -3.8440, lon: -32.4100 },
  { id: 'montevideo', name: 'Montevideo', countryCode: 'UY', tz: 'America/Montevideo', lat: -34.9011, lon: -56.1645 },
  { id: 'la-paz', name: 'La Paz', countryCode: 'BO', tz: 'America/La_Paz', lat: -16.4897, lon: -68.1193 },
  { id: 'quito', name: 'Quito', countryCode: 'EC', tz: 'America/Guayaquil', lat: -0.1807, lon: -78.4678 },

  // North Atlantic / fringe offsets
  { id: 'reykjavik', name: 'Reykjavik', countryCode: 'IS', tz: 'Atlantic/Reykjavik', lat: 64.1466, lon: -21.9426 },
  { id: 'ponta-delgada', name: 'Ponta Delgada', countryCode: 'PT', tz: 'Atlantic/Azores', lat: 37.7412, lon: -25.6756 },
  { id: 'st-johns', name: "St. John's", countryCode: 'CA', tz: 'America/St_Johns', lat: 47.5615, lon: -52.7126 }, // UTC-3:30
  { id: 'nuuk', name: 'Nuuk', countryCode: 'GL', tz: 'America/Nuuk', lat: 64.1835, lon: -51.7216 },
  { id: 'ponta-delgada', name: 'Ponta Delgada', countryCode: 'PT', tz: 'Atlantic/Azores', lat: 37.7412, lon: -25.6756 },
  { id: 'dublin', name: 'Dublin', countryCode: 'IE', tz: 'Europe/Dublin', lat: 53.3498, lon: -6.2603 },
  { id: 'lisbon', name: 'Lisbon', countryCode: 'PT', tz: 'Europe/Lisbon', lat: 38.7223, lon: -9.1393 },
  { id: 'london', name: 'London', countryCode: 'GB', tz: 'Europe/London', lat: 51.5072, lon: -0.1276 },
  { id: 'paris', name: 'Paris', countryCode: 'FR', tz: 'Europe/Paris', lat: 48.8566, lon: 2.3522 },
  { id: 'berlin', name: 'Berlin', countryCode: 'DE', tz: 'Europe/Berlin', lat: 52.5200, lon: 13.4050 },
  { id: 'rome', name: 'Rome', countryCode: 'IT', tz: 'Europe/Rome', lat: 41.9028, lon: 12.4964 },
  { id: 'madrid', name: 'Madrid', countryCode: 'ES', tz: 'Europe/Madrid', lat: 40.4168, lon: -3.7038 },
  { id: 'amsterdam', name: 'Amsterdam', countryCode: 'NL', tz: 'Europe/Amsterdam', lat: 52.3676, lon: 4.9041 },
  { id: 'copenhagen', name: 'Copenhagen', countryCode: 'DK', tz: 'Europe/Copenhagen', lat: 55.6761, lon: 12.5683 },
  { id: 'zurich', name: 'Zürich', countryCode: 'CH', tz: 'Europe/Zurich', lat: 47.3769, lon: 8.5417 },
  { id: 'vienna', name: 'Vienna', countryCode: 'AT', tz: 'Europe/Vienna', lat: 48.2082, lon: 16.3738 },
  { id: 'prague', name: 'Prague', countryCode: 'CZ', tz: 'Europe/Prague', lat: 50.0755, lon: 14.4378 },
  { id: 'warsaw', name: 'Warsaw', countryCode: 'PL', tz: 'Europe/Warsaw', lat: 52.2297, lon: 21.0122 },
  { id: 'stockholm', name: 'Stockholm', countryCode: 'SE', tz: 'Europe/Stockholm', lat: 59.3293, lon: 18.0686 },
  { id: 'oslo', name: 'Oslo', countryCode: 'NO', tz: 'Europe/Oslo', lat: 59.9139, lon: 10.7522 },
  { id: 'athens', name: 'Athens', countryCode: 'GR', tz: 'Europe/Athens', lat: 37.9838, lon: 23.7275 },
  { id: 'helsinki', name: 'Helsinki', countryCode: 'FI', tz: 'Europe/Helsinki', lat: 60.1699, lon: 24.9384 },
  { id: 'istanbul', name: 'Istanbul', countryCode: 'TR', tz: 'Europe/Istanbul', lat: 41.0082, lon: 28.9784 },
  { id: 'kyiv', name: 'Kyiv', countryCode: 'UA', tz: 'Europe/Kyiv', lat: 50.4501, lon: 30.5234 },
  { id: 'moscow', name: 'Moscow', countryCode: 'RU', tz: 'Europe/Moscow', lat: 55.7558, lon: 37.6173 },

  // Atlantic / North America fringe offsets and islands
  { id: 'st-johns', name: "St. John's", countryCode: 'CA', tz: 'America/St_Johns', lat: 47.5615, lon: -52.7126 },
  { id: 'halifax', name: 'Halifax', countryCode: 'CA', tz: 'America/Halifax', lat: 44.6488, lon: -63.5752 },
  { id: 'caracas', name: 'Caracas', countryCode: 'VE', tz: 'America/Caracas', lat: 10.4806, lon: -66.9036 },
  { id: 'fernando-de-noronha', name: 'Fernando de Noronha', countryCode: 'BR', tz: 'America/Noronha', lat: -3.8440, lon: -32.4100 },
  { id: 'praia', name: 'Praia', countryCode: 'CV', tz: 'Atlantic/Cape_Verde', lat: 14.9330, lon: -23.5133 },

  { id: 'casablanca', name: 'Casablanca', countryCode: 'MA', tz: 'Africa/Casablanca', lat: 33.5731, lon: -7.5898 },
  { id: 'praia', name: 'Praia', countryCode: 'CV', tz: 'Atlantic/Cape_Verde', lat: 14.9330, lon: -23.5133 },
  { id: 'dakar', name: 'Dakar', countryCode: 'SN', tz: 'Africa/Dakar', lat: 14.7167, lon: -17.4677 },
  { id: 'accra', name: 'Accra', countryCode: 'GH', tz: 'Africa/Accra', lat: 5.6037, lon: -0.1870 },
  { id: 'lagos', name: 'Lagos', countryCode: 'NG', tz: 'Africa/Lagos', lat: 6.5244, lon: 3.3792 },
  { id: 'cairo', name: 'Cairo', countryCode: 'EG', tz: 'Africa/Cairo', lat: 30.0444, lon: 31.2357 },
  { id: 'nairobi', name: 'Nairobi', countryCode: 'KE', tz: 'Africa/Nairobi', lat: -1.2921, lon: 36.8219 },
  { id: 'kinshasa', name: 'Kinshasa', countryCode: 'CD', tz: 'Africa/Kinshasa', lat: -4.4419, lon: 15.2663 },
  { id: 'addis-ababa', name: 'Addis Ababa', countryCode: 'ET', tz: 'Africa/Addis_Ababa', lat: 8.9806, lon: 38.7578 },
  { id: 'johannesburg', name: 'Johannesburg', countryCode: 'ZA', tz: 'Africa/Johannesburg', lat: -26.2041, lon: 28.0473 },
  { id: 'cape-town', name: 'Cape Town', countryCode: 'ZA', tz: 'Africa/Johannesburg', lat: -33.9249, lon: 18.4241 },

  // More African and Middle Eastern representation
  { id: 'addis-ababa', name: 'Addis Ababa', countryCode: 'ET', tz: 'Africa/Addis_Ababa', lat: 8.9806, lon: 38.7578 },
  { id: 'algiers', name: 'Algiers', countryCode: 'DZ', tz: 'Africa/Algiers', lat: 36.7538, lon: 3.0588 },
  { id: 'tunis', name: 'Tunis', countryCode: 'TN', tz: 'Africa/Tunis', lat: 36.8065, lon: 10.1815 },


  // Middle East / South Asia / East Asia
  { id: 'dubai', name: 'Dubai', countryCode: 'AE', tz: 'Asia/Dubai', lat: 25.2048, lon: 55.2708 },
  { id: 'riyadh', name: 'Riyadh', countryCode: 'SA', tz: 'Asia/Riyadh', lat: 24.7136, lon: 46.6753 },
  { id: 'tehran', name: 'Tehran', countryCode: 'IR', tz: 'Asia/Tehran', lat: 35.6892, lon: 51.3890 },
  { id: 'karachi', name: 'Karachi', countryCode: 'PK', tz: 'Asia/Karachi', lat: 24.8607, lon: 67.0011 },
  { id: 'delhi', name: 'New Delhi', countryCode: 'IN', tz: 'Asia/Kolkata', lat: 28.6139, lon: 77.2090 },
  { id: 'mumbai', name: 'Mumbai', countryCode: 'IN', tz: 'Asia/Kolkata', lat: 19.0760, lon: 72.8777 },
  { id: 'colombo', name: 'Colombo', countryCode: 'LK', tz: 'Asia/Colombo', lat: 6.9271, lon: 79.8612 },
  { id: 'dhaka', name: 'Dhaka', countryCode: 'BD', tz: 'Asia/Dhaka', lat: 23.8103, lon: 90.4125 },
  { id: 'bangkok', name: 'Bangkok', countryCode: 'TH', tz: 'Asia/Bangkok', lat: 13.7563, lon: 100.5018 },
  { id: 'hanoi', name: 'Hanoi', countryCode: 'VN', tz: 'Asia/Ho_Chi_Minh', lat: 21.0278, lon: 105.8342 },
  { id: 'singapore', name: 'Singapore', countryCode: 'SG', tz: 'Asia/Singapore', lat: 1.3521, lon: 103.8198 },
  { id: 'kuala-lumpur', name: 'Kuala Lumpur', countryCode: 'MY', tz: 'Asia/Kuala_Lumpur', lat: 3.1390, lon: 101.6869 },
  { id: 'jakarta', name: 'Jakarta', countryCode: 'ID', tz: 'Asia/Jakarta', lat: -6.2088, lon: 106.8456 },
  { id: 'manila', name: 'Manila', countryCode: 'PH', tz: 'Asia/Manila', lat: 14.5995, lon: 120.9842 },
  { id: 'hong-kong', name: 'Hong Kong', countryCode: 'HK', tz: 'Asia/Hong_Kong', lat: 22.3193, lon: 114.1694 },
  { id: 'taipei', name: 'Taipei', countryCode: 'TW', tz: 'Asia/Taipei', lat: 25.0330, lon: 121.5654 },
  { id: 'shanghai', name: 'Shanghai', countryCode: 'CN', tz: 'Asia/Shanghai', lat: 31.2304, lon: 121.4737 },
  { id: 'beijing', name: 'Beijing', countryCode: 'CN', tz: 'Asia/Shanghai', lat: 39.9042, lon: 116.4074 },
  { id: 'seoul', name: 'Seoul', countryCode: 'KR', tz: 'Asia/Seoul', lat: 37.5665, lon: 126.9780 },
  { id: 'tokyo', name: 'Tokyo', countryCode: 'JP', tz: 'Asia/Tokyo', lat: 35.6762, lon: 139.6503 },
  { id: 'osaka', name: 'Osaka', countryCode: 'JP', tz: 'Asia/Tokyo', lat: 34.6937, lon: 135.5023 },

  // Extra Pacific / Oceania
  { id: 'noumea', name: 'Noumea', countryCode: 'NC', tz: 'Pacific/Noumea', lat: -22.2763, lon: 166.4572 },

  { id: 'perth', name: 'Perth', countryCode: 'AU', tz: 'Australia/Perth', lat: -31.9505, lon: 115.8605 },
  { id: 'adelaide', name: 'Adelaide', countryCode: 'AU', tz: 'Australia/Adelaide', lat: -34.9285, lon: 138.6007 },
  { id: 'melbourne', name: 'Melbourne', countryCode: 'AU', tz: 'Australia/Melbourne', lat: -37.8136, lon: 144.9631 },
  { id: 'sydney', name: 'Sydney', countryCode: 'AU', tz: 'Australia/Sydney', lat: -33.8688, lon: 151.2093 },
  { id: 'brisbane', name: 'Brisbane', countryCode: 'AU', tz: 'Australia/Brisbane', lat: -27.4698, lon: 153.0251 },
  { id: 'auckland', name: 'Auckland', countryCode: 'NZ', tz: 'Pacific/Auckland', lat: -36.8485, lon: 174.7633 },
  { id: 'suva', name: 'Suva', countryCode: 'FJ', tz: 'Pacific/Fiji', lat: -18.1248, lon: 178.4501 },
]

if (CITIES.length < 75) {
  // eslint-disable-next-line no-console
  console.warn(`Expected at least 75 cities, got ${CITIES.length}`)
}

