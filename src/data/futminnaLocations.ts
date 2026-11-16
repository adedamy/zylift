import { LocationPoint, RideOption } from '../types';

export const MINNA_CITY_CENTER = {
  lat: 9.6000,
  lng: 6.5400,
  zoom: 13,
};

export const FUTMINNA_CAMPUS_CENTER = {
  lat: 9.5330,
  lng: 6.4475,
  zoom: 15,
};

export interface LGABoundaryInfo {
  id: 'chanchaga' | 'bosso';
  name: string;
  fullName: string;
  badgeColor: string;
  fillColor: string;
  strokeColor: string;
  center: [number, number];
  zoom: number;
  description: string;
  keyHubs: string[];
  coordinates: [number, number][];
}

export const MINNA_LGA_BOUNDARIES: Record<'chanchaga' | 'bosso', LGABoundaryInfo> = {
  chanchaga: {
    id: 'chanchaga',
    name: 'Chanchaga LGA',
    fullName: 'Chanchaga Local Government Area',
    badgeColor: '#2563EB',
    fillColor: '#3B82F6',
    strokeColor: '#1D4ED8',
    center: [9.5950, 6.5550],
    zoom: 14,
    description: 'Minna Municipal Core · Central Market, Government House, Tunga, Kpakungu & Mobil Roundabout',
    keyHubs: [
      'Minna Central Market',
      'Niger State Secretariat / Govt House',
      'General Hospital Minna',
      'IBB Specialist Hospital',
      'Kpakungu Motor Park',
      'Mobil Roundabout',
      'Minna Railway Station',
      'Chanchaga Bridge'
    ],
    coordinates: [
      [9.6260, 6.5320],
      [9.6240, 6.5650],
      [9.6080, 6.5960],
      [9.5750, 6.6220],
      [9.5500, 6.5980],
      [9.5650, 6.5520],
      [9.5820, 6.5200],
      [9.6080, 6.5240],
      [9.6260, 6.5320],
    ],
  },
  bosso: {
    id: 'bosso',
    name: 'Bosso LGA',
    fullName: 'Bosso Local Government Area',
    badgeColor: '#0E7C3A',
    fillColor: '#10B981',
    strokeColor: '#047857',
    center: [9.6200, 6.5000],
    zoom: 13,
    description: 'Academic & Airport District · FUTMINNA Bosso & Main Campus (Gidan Kwanu), Maikunkele & Airport',
    keyHubs: [
      'FUTMINNA Main Campus (Gidan Kwanu)',
      'FUTMINNA Bosso Campus',
      'Bosso Central Motor Park & Market',
      'Maikunkele Junction & Market',
      'Minna International Airport',
      'Bosso Estate / Low Cost',
      'Garatu Transit Rank'
    ],
    coordinates: [
      [9.7120, 6.4950],
      [9.6950, 6.5380],
      [9.6580, 6.5520],
      [9.6280, 6.5360],
      [9.6080, 6.5220],
      [9.5750, 6.4900],
      [9.5480, 6.4700],
      [9.5200, 6.4550],
      [9.5180, 6.4280],
      [9.5450, 6.4350],
      [9.5950, 6.4580],
      [9.6650, 6.4380],
      [9.7120, 6.4950],
    ],
  },
};

export const FUTMINNA_KEY_LOCATIONS: LocationPoint[] = [
  // --- FUTMINNA GIDAN KWANU CAMPUS (BOSSO LGA) ---
  {
    id: 'fut_gate',
    name: 'Main Campus Gate',
    address: 'Minna-Bida Road, Gidan Kwanu Entrance',
    city: 'Minna',
    area: 'FUTMINNA Gidan Kwanu',
    lat: 9.5375,
    lng: 6.4520,
    isPopular: true,
    lga: 'Bosso',
    category: 'Campus',
    description: 'Main campus security portal & shuttle drop-off',
  },
  {
    id: 'fut_park',
    name: 'School Motor Park (Keke & Bike Station)',
    address: 'Near Main Gate, Gidan Kwanu',
    city: 'Minna',
    area: 'FUTMINNA Gidan Kwanu',
    lat: 9.5368,
    lng: 6.4510,
    isPopular: true,
    lga: 'Bosso',
    category: 'Transit Hub',
    description: 'Central campus terminal for Keke, Okada, and Shuttles',
  },
  {
    id: 'fut_senate',
    name: 'Senate Building & Admin Complex',
    address: 'Central Campus Core, Gidan Kwanu',
    city: 'Minna',
    area: 'FUTMINNA Gidan Kwanu',
    lat: 9.5325,
    lng: 6.4468,
    isPopular: true,
    lga: 'Bosso',
    category: 'Campus',
    description: 'Vice Chancellor Office, Registry & Student Affairs',
  },
  {
    id: 'fut_library',
    name: 'University Central Library',
    address: 'Academic Ring Road, Gidan Kwanu',
    city: 'Minna',
    area: 'FUTMINNA Gidan Kwanu',
    lat: 9.5312,
    lng: 6.4455,
    isPopular: true,
    lga: 'Bosso',
    category: 'Campus',
    description: 'Ibrahim Badamasi Babangida Library & E-Learning Hub',
  },
  {
    id: 'fut_hostels',
    name: 'Student Hostels (Block A, B, C & Female Hostels)',
    address: 'Hostel Village, Gidan Kwanu',
    city: 'Minna',
    area: 'FUTMINNA Gidan Kwanu',
    lat: 9.5265,
    lng: 6.4430,
    isPopular: true,
    lga: 'Bosso',
    category: 'Residential',
    description: 'Undergraduate student residence village & shopping rank',
  },
  {
    id: 'fut_seet',
    name: 'SEET (School of Engineering Complex)',
    address: 'Engineering Road, Gidan Kwanu',
    city: 'Minna',
    area: 'FUTMINNA Gidan Kwanu',
    lat: 9.5340,
    lng: 6.4480,
    isPopular: true,
    lga: 'Bosso',
    category: 'Campus',
    description: 'Engineering lecture theatres, workshops & laboratories',
  },
  {
    id: 'fut_saat',
    name: 'SAAT (School of Agriculture Complex)',
    address: 'Agriculture Wing, Gidan Kwanu',
    city: 'Minna',
    area: 'FUTMINNA Gidan Kwanu',
    lat: 9.5355,
    lng: 6.4495,
    isPopular: true,
    lga: 'Bosso',
    category: 'Campus',
    description: 'Agricultural research facilities and lecture rooms',
  },
  {
    id: 'fut_set',
    name: 'SET (School of Environmental Tech)',
    address: 'Environmental Complex, Gidan Kwanu',
    city: 'Minna',
    area: 'FUTMINNA Gidan Kwanu',
    lat: 9.5332,
    lng: 6.4462,
    isPopular: true,
    lga: 'Bosso',
    category: 'Campus',
    description: 'Architecture, Urban Planning & Surveying studios',
  },
  {
    id: 'fut_convocation',
    name: 'Convocation Square & ETF Halls',
    address: 'Central Core, Gidan Kwanu',
    city: 'Minna',
    area: 'FUTMINNA Gidan Kwanu',
    lat: 9.5318,
    lng: 6.4472,
    isPopular: true,
    lga: 'Bosso',
    category: 'Campus',
    description: 'Multipurpose event hall, auditorium & lecture space',
  },
  {
    id: 'fut_village',
    name: 'Gidan Kwanu Village Market / Junction',
    address: 'Off Campus Junction, Minna-Bida Road',
    city: 'Minna',
    area: 'Gidan Kwanu Junction',
    lat: 9.5410,
    lng: 6.4560,
    isPopular: true,
    lga: 'Bosso',
    category: 'Market',
    description: 'Off-campus student apartments, restaurants & local grocery market',
  },
  {
    id: 'gidan_mangoro',
    name: 'Gidan Mangoro Village & Student Lodges',
    address: 'Minna-Bida Road, Gidan Mangoro',
    city: 'Minna',
    area: 'Gidan Mangoro',
    lat: 9.5480,
    lng: 6.4680,
    isPopular: true,
    lga: 'Bosso',
    category: 'Residential',
    description: 'Major student off-campus residential settlement, lodges & commercial centre',
  },
  {
    id: 'dama_village',
    name: 'Dama Village & Transit Junction',
    address: 'Minna-Bida Expressway, Dama',
    city: 'Minna',
    area: 'Dama',
    lat: 9.5530,
    lng: 6.4750,
    isPopular: true,
    lga: 'Bosso',
    category: 'Transit Hub',
    description: 'Corridor transit stop between Gidan Mangoro and Garatu',
  },
  {
    id: 'talba_estate',
    name: 'Talba Housing Estate',
    address: 'Bida Road Corridor, Near Kpakungu',
    city: 'Minna',
    area: 'Talba Estate',
    lat: 9.5720,
    lng: 6.5120,
    isPopular: true,
    lga: 'Chanchaga',
    category: 'Residential',
    description: 'Prominent residential housing estate along Minna-Bida university transit axis',
  },
  {
    id: 'sauka_kahuta',
    name: 'Sauka Kahuta Junction & Market',
    address: 'Bida Road Axis, Minna',
    city: 'Minna',
    area: 'Sauka Kahuta',
    lat: 9.5980,
    lng: 6.5360,
    isPopular: true,
    lga: 'Chanchaga',
    category: 'Market',
    description: 'Commercial hub and bus stop leading into Minna city',
  },

  // --- BOSSO LGA (MINNA NORTH & WEST) ---
  {
    id: 'fut_bosso',
    name: 'FUTMINNA Bosso Campus (Old Campus)',
    address: 'Bosso Road, Minna City Center',
    city: 'Minna',
    area: 'Bosso Town',
    lat: 9.6150,
    lng: 6.5450,
    isPopular: true,
    lga: 'Bosso',
    category: 'Campus',
    description: 'Bosso Campus gate, School of Science Education & clinics',
  },
  {
    id: 'bosso_motor_park',
    name: 'Bosso Central Motor Park & Market',
    address: 'Main Bosso Roundabout, Bosso LGA',
    city: 'Minna',
    area: 'Bosso Town',
    lat: 9.6450,
    lng: 6.5200,
    isPopular: true,
    lga: 'Bosso',
    category: 'Transit Hub',
    description: 'Major transit terminus for city shuttles & inter-town travel',
  },
  {
    id: 'bosso_estate',
    name: 'Bosso Estate & Low Cost Housing',
    address: 'Off Bosso Road, Minna',
    city: 'Minna',
    area: 'Bosso Estate',
    lat: 9.6380,
    lng: 6.5320,
    isPopular: false,
    lga: 'Bosso',
    category: 'Residential',
    description: 'Staff quarters, civil servant residences & off-campus student flats',
  },
  {
    id: 'maikunkele_junction',
    name: 'Maikunkele Commercial Junction',
    address: 'Minna-Zungeru Road, Maikunkele',
    city: 'Minna',
    area: 'Maikunkele',
    lat: 9.6840,
    lng: 6.5050,
    isPopular: true,
    lga: 'Bosso',
    category: 'Transit Hub',
    description: 'Suburban market junction & northern transit rank',
  },
  {
    id: 'minna_airport',
    name: 'Bola Ahmed Tinubu International Airport (Minna)',
    address: 'Airport Road, Maikunkele Corridor',
    city: 'Minna',
    area: 'Airport District',
    lat: 9.6520,
    lng: 6.4620,
    isPopular: true,
    lga: 'Bosso',
    category: 'Transit Hub',
    description: 'Commercial air passenger terminal & VIP charter hub',
  },
  {
    id: 'garatu_junction',
    name: 'Garatu Transit Rank & Village',
    address: 'Minna-Bida Expressway, Garatu',
    city: 'Minna',
    area: 'Garatu',
    lat: 9.5580,
    lng: 6.4820,
    isPopular: false,
    lga: 'Bosso',
    category: 'Transit Hub',
    description: 'Midway transit stop between Gidan Kwanu Campus & Minna metropolis',
  },

  // --- CHANCHAGA LGA (MINNA CITY CORE & SOUTHEAST) ---
  {
    id: 'minna_central_market',
    name: 'Minna Central Market (Kasuwan Gwari)',
    address: 'Market Road, Minna City Center',
    city: 'Minna',
    area: 'Central Minna',
    lat: 9.6130,
    lng: 6.5510,
    isPopular: true,
    lga: 'Chanchaga',
    category: 'Market',
    description: 'Prime commercial trading hub, foodstuff, electronics & textiles',
  },
  {
    id: 'govt_house_tunga',
    name: 'Government House & State Secretariat',
    address: 'Shehu Sultan Road, Tunga',
    city: 'Minna',
    area: 'Tunga District',
    lat: 9.5920,
    lng: 6.5620,
    isPopular: true,
    lga: 'Chanchaga',
    category: 'Government',
    description: 'Governor Office, State Ministries and administrative headquarters',
  },
  {
    id: 'general_hospital_minna',
    name: 'General Hospital Minna',
    address: 'Hospital Road, Central Minna',
    city: 'Minna',
    area: 'Central Minna',
    lat: 9.6080,
    lng: 6.5540,
    isPopular: true,
    lga: 'Chanchaga',
    category: 'Medical',
    description: 'Main public tertiary healthcare and emergency trauma centre',
  },
  {
    id: 'ibb_specialist_hospital',
    name: 'IBB Specialist Hospital, Minna',
    address: 'Tunga District, Minna',
    city: 'Minna',
    area: 'Tunga District',
    lat: 9.5870,
    lng: 6.5680,
    isPopular: true,
    lga: 'Chanchaga',
    category: 'Medical',
    description: 'Specialist referral hospital and diagnostic laboratories',
  },
  {
    id: 'kpakungu_roundabout',
    name: 'Kpakungu / Kwakwagu Roundabout & Motor Park',
    address: 'Bida Road Junction, Kpakungu (Kwakwagu)',
    city: 'Minna',
    area: 'Kpakungu',
    lat: 9.5850,
    lng: 6.5290,
    isPopular: true,
    lga: 'Chanchaga',
    category: 'Transit Hub',
    description: 'Major southern city gateway connecting town to FUTMINNA Gidan Kwanu',
  },
  {
    id: 'mobil_roundabout',
    name: 'Mobil Roundabout / Tunga Junction',
    address: 'Intersection of Bosso Rd & Paiko Rd, Tunga',
    city: 'Minna',
    area: 'Tunga District',
    lat: 9.6020,
    lng: 6.5580,
    isPopular: true,
    lga: 'Chanchaga',
    category: 'Transit Hub',
    description: 'Vibrant city junction connecting Bosso, Tunga and Central Minna',
  },
  {
    id: 'minna_railway_station',
    name: 'Minna Railway Station & Goods Yard',
    address: 'Station Road, Old Minna',
    city: 'Minna',
    area: 'Railway Quarter',
    lat: 9.6170,
    lng: 6.5490,
    isPopular: false,
    lga: 'Chanchaga',
    category: 'Transit Hub',
    description: 'Historical railway terminal linking North and South transit freight',
  },
  {
    id: 'bako_kontagora_stadium',
    name: 'Bako Kontagora Memorial Stadium',
    address: 'Stadium Road, Central Minna',
    city: 'Minna',
    area: 'Central Minna',
    lat: 9.6060,
    lng: 6.5520,
    isPopular: false,
    lga: 'Chanchaga',
    category: 'Transit Hub',
    description: 'State sports stadium, athletic tournaments & cultural gatherings',
  },
  {
    id: 'bahago_roundabout',
    name: 'Bahago Roundabout (Western Bypass)',
    address: 'Western Bypass Junction, Minna',
    city: 'Minna',
    area: 'Western Bypass',
    lat: 9.6190,
    lng: 6.5330,
    isPopular: true,
    lga: 'Chanchaga',
    category: 'Transit Hub',
    description: 'Key junction linking central city traffic to Shiroro and bypass',
  },
  {
    id: 'chanchaga_bridge',
    name: 'Chanchaga Bridge & Abuja Highway Gate',
    address: 'Minna-Suleja Highway, Chanchaga',
    city: 'Minna',
    area: 'Chanchaga',
    lat: 9.5600,
    lng: 6.6020,
    isPopular: true,
    lga: 'Chanchaga',
    category: 'Transit Hub',
    description: 'Eastern entrance into Minna metropolis from Abuja and Suleja',
  },

  // --- NIGER STATE REGIONAL TOWNS & LGA HUBS ---
  {
    id: 'wushishi_central',
    name: 'Wushishi Town & LGA Secretariat',
    address: 'Zungeru-Bida Road, Wushishi',
    city: 'Wushishi',
    area: 'Wushishi Town',
    lat: 9.7289,
    lng: 6.0747,
    isPopular: true,
    lga: 'Wushishi',
    category: 'Transit Hub',
    description: 'Wushishi LGA headquarters, Central Market & regional transit terminal',
  },
  {
    id: 'zungeru_junction',
    name: 'Zungeru Historic Town & River Junction',
    address: 'Minna-Zungeru Road, Zungeru',
    city: 'Zungeru',
    area: 'Zungeru',
    lat: 9.8139,
    lng: 6.1556,
    isPopular: true,
    lga: 'Wushishi',
    category: 'Transit Hub',
    description: 'Zungeru colonial heritage, Kaduna River bridge & railway terminal',
  },
  {
    id: 'bida_central',
    name: 'Bida City / Federal Polytechnic Bida',
    address: 'Minna-Bida Road, Bida Town',
    city: 'Bida',
    area: 'Bida Town',
    lat: 9.0833,
    lng: 6.0167,
    isPopular: true,
    lga: 'Bida',
    category: 'Campus',
    description: 'Historic city centre, Federal Poly Bida & Bida Central Motor Park',
  },
  {
    id: 'kontagora_central',
    name: 'Kontagora Commercial Centre & Motor Park',
    address: 'Lagos-Kaduna Highway Axis, Kontagora',
    city: 'Kontagora',
    area: 'Kontagora',
    lat: 10.4042,
    lng: 5.4697,
    isPopular: true,
    lga: 'Kontagora',
    category: 'Transit Hub',
    description: 'Commercial and educational metropolis in northern Niger State',
  },
  {
    id: 'suleja_market',
    name: 'Suleja Commercial Hub & IBB Market',
    address: 'Minna-Abuja Highway, Suleja',
    city: 'Suleja',
    area: 'Suleja',
    lat: 9.1806,
    lng: 7.1806,
    isPopular: true,
    lga: 'Suleja',
    category: 'Market',
    description: 'Vibrant commercial city bordering Abuja FCT & major transport terminal',
  },
  {
    id: 'lapai_ibbu',
    name: 'IBB University Main Gate & Lapai Town',
    address: 'Minna-Lapai Road, Lapai',
    city: 'Lapai',
    area: 'Lapai',
    lat: 9.0500,
    lng: 6.5667,
    isPopular: true,
    lga: 'Lapai',
    category: 'Campus',
    description: 'IBB University Main Gate, Lapai Emir Palace & transit corridor',
  },
  {
    id: 'shiroro_junction',
    name: 'Shiroro Hydro Road & Commercial Junction',
    address: 'Minna-Shiroro Road, Shiroro',
    city: 'Shiroro',
    area: 'Shiroro',
    lat: 9.9667,
    lng: 6.8333,
    isPopular: false,
    lga: 'Shiroro',
    category: 'Transit Hub',
    description: 'Hydroelectric power hub and transit link connecting to Minna bypass',
  },
  {
    id: 'paiko_junction',
    name: 'Paiko Junction & Paikoro LGA Secretariat',
    address: 'Minna-Suleja Highway, Paiko',
    city: 'Paiko',
    area: 'Paiko',
    lat: 9.4333,
    lng: 6.6333,
    isPopular: false,
    lga: 'Paikoro',
    category: 'Transit Hub',
    description: 'Paiko town junction along Minna-Suleja arterial transit corridor',
  },
];

export const FUTMINNA_RIDE_OPTIONS: RideOption[] = [
  {
    id: 'keke',
    name: 'Campus Keke',
    subtitle: 'Tricycle · Safe & breezy for campus hops',
    category: 'Tricycle',
    basePrice: 150,
    perKm: 0,
    perMinute: 0,
    surgeMultiplier: 1.0,
    etaMinutes: 2,
    capacity: 3,
    tagline: 'Direct hostel to lecture hall transit at flat campus rate',
    iconType: 'keke',
    trafficAdvantage: 'Campus union vetted & gate approved',
    requiresHelmet: false,
  },
  {
    id: 'okada',
    name: 'Campus Bike (Okada)',
    subtitle: 'Motorcycle · Quickest across campus ring road',
    category: 'Okada',
    basePrice: 200,
    perKm: 0,
    perMinute: 0,
    surgeMultiplier: 1.0,
    etaMinutes: 1,
    capacity: 1,
    tagline: 'Fast drop-off at lecture halls with helmet provided',
    iconType: 'bike',
    trafficAdvantage: 'Cuts walking time from hostel to class by 90%',
    requiresHelmet: true,
  },
  {
    id: 'cab_go',
    name: 'Campus Cab',
    subtitle: 'Car · Gidan Kwanu ↔ Bosso Campus / Town',
    category: 'Car',
    basePrice: 500,
    perKm: 0,
    perMinute: 0,
    surgeMultiplier: 1.0,
    etaMinutes: 4,
    capacity: 4,
    tagline: 'Comfortable private or group commute between campuses',
    iconType: 'car',
    trafficAdvantage: 'Direct transit without roadside haggling',
    requiresHelmet: false,
  },
  {
    id: 'small_bus',
    name: 'Small Bus (Korope)',
    subtitle: 'Mini-Bus · Fast 7-passenger hop across campus gates',
    category: 'Small Bus',
    basePrice: 150,
    perKm: 0,
    perMinute: 0,
    surgeMultiplier: 1.0,
    etaMinutes: 3,
    capacity: 7,
    tagline: 'Economical group hop between Hostels, SEET, and Gate',
    iconType: 'small_bus',
    trafficAdvantage: 'High seat availability at campus motor park ranks',
    requiresHelmet: false,
  },
  {
    id: 'big_bus',
    name: 'Big Bus (Campus Coaster)',
    subtitle: 'Bus · 30-passenger high-capacity campus shuttle',
    category: 'Big Bus',
    basePrice: 100,
    perKm: 0,
    perMinute: 0,
    surgeMultiplier: 1.0,
    etaMinutes: 5,
    capacity: 30,
    tagline: 'Lowest fare campus shuttle for mass student movements',
    iconType: 'big_bus',
    trafficAdvantage: 'Union certified mass campus transportation',
    requiresHelmet: false,
  },
];

export const CAMPUS_SECURITY_CONTACTS = [
  {
    role: 'FUTMINNA Security Control Post',
    phone: '+234 803 612 0041',
    description: 'Main Gate & Cadet patrol unit, available 24/7',
  },
  {
    role: 'University Health Centre (Clinic)',
    phone: '+234 805 918 2234',
    description: 'Gidan Kwanu Clinic emergency ambulance',
  },
  {
    role: 'Campus Keke & Transport Union',
    phone: '+234 814 551 9022',
    description: 'Official student transport union desk',
  },
];

/**
 * Keyed Route Pricing Matrix for FUTMINNA Gidan Kwanu & Bosso Campuses.
 * Deterministic lookup based on location IDs or standardized zone names.
 */
export interface RouteFareTier {
  keke: number;
  okada: number;
  cab_go: number;
  small_bus: number;
  big_bus: number;
}

export const CAMPUS_ROUTE_MATRIX: Record<string, RouteFareTier> = {
  // Gate <-> Hostels
  'fut_gate_fut_hostels': { keke: 200, okada: 250, cab_go: 500, small_bus: 150, big_bus: 100 },
  'fut_hostels_fut_gate': { keke: 200, okada: 250, cab_go: 500, small_bus: 150, big_bus: 100 },
  // Park <-> Hostels
  'fut_park_fut_hostels': { keke: 200, okada: 250, cab_go: 500, small_bus: 150, big_bus: 100 },
  'fut_hostels_fut_park': { keke: 200, okada: 250, cab_go: 500, small_bus: 150, big_bus: 100 },
  // Gate <-> Senate / Library / SEET / SAAT / SET
  'fut_gate_fut_senate': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  'fut_senate_fut_gate': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  'fut_gate_fut_library': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  'fut_library_fut_gate': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  'fut_gate_fut_seet': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  'fut_seet_fut_gate': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  // Hostels <-> Academic Core (SEET, Library, Convocation, SAAT, SET)
  'fut_hostels_fut_seet': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  'fut_seet_fut_hostels': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  'fut_hostels_fut_library': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  'fut_library_fut_hostels': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  'fut_hostels_fut_senate': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  'fut_senate_fut_hostels': { keke: 150, okada: 200, cab_go: 400, small_bus: 100, big_bus: 70 },
  // Campus <-> Gidan Kwanu Village Market
  'fut_village_fut_hostels': { keke: 250, okada: 300, cab_go: 600, small_bus: 200, big_bus: 150 },
  'fut_hostels_fut_village': { keke: 250, okada: 300, cab_go: 600, small_bus: 200, big_bus: 150 },
  'fut_village_fut_gate': { keke: 200, okada: 250, cab_go: 500, small_bus: 150, big_bus: 100 },
  'fut_gate_fut_village': { keke: 200, okada: 250, cab_go: 500, small_bus: 150, big_bus: 100 },
  // Inter-Campus: Gidan Kwanu <-> Bosso Campus
  'fut_gate_fut_bosso': { keke: 600, okada: 800, cab_go: 1000, small_bus: 400, big_bus: 250 },
  'fut_bosso_fut_gate': { keke: 600, okada: 800, cab_go: 1000, small_bus: 400, big_bus: 250 },
  'fut_hostels_fut_bosso': { keke: 700, okada: 900, cab_go: 1200, small_bus: 500, big_bus: 300 },
  'fut_bosso_fut_hostels': { keke: 700, okada: 900, cab_go: 1200, small_bus: 500, big_bus: 300 },
  'fut_park_fut_bosso': { keke: 600, okada: 800, cab_go: 1000, small_bus: 400, big_bus: 250 },
  'fut_bosso_fut_park': { keke: 600, okada: 800, cab_go: 1000, small_bus: 400, big_bus: 250 },
};

/**
 * Resolves deterministic fare using location IDs or name fallback.
 */
export function getDeterministicCampusFare(
  pickupIdOrName: string,
  dropoffIdOrName: string,
  category: 'keke' | 'okada' | 'cab_go' | 'small_bus' | 'big_bus' | 'comfort' | 'dispatch'
): number {
  const normCategory = category === 'comfort' ? 'cab_go' : category === 'dispatch' ? 'okada' : category;
  
  // Try exact ID match
  const pairKey = `${pickupIdOrName}_${dropoffIdOrName}`;
  if (CAMPUS_ROUTE_MATRIX[pairKey]) {
    return CAMPUS_ROUTE_MATRIX[pairKey][normCategory as keyof RouteFareTier] || 150;
  }

  // Find IDs if names were passed
  const pickupLoc = FUTMINNA_KEY_LOCATIONS.find(
    l => l.id === pickupIdOrName || l.name.toLowerCase() === pickupIdOrName.toLowerCase()
  );
  const dropoffLoc = FUTMINNA_KEY_LOCATIONS.find(
    l => l.id === dropoffIdOrName || l.name.toLowerCase() === dropoffIdOrName.toLowerCase()
  );

  if (pickupLoc && dropoffLoc) {
    const resolvedKey = `${pickupLoc.id}_${dropoffLoc.id}`;
    if (CAMPUS_ROUTE_MATRIX[resolvedKey]) {
      return CAMPUS_ROUTE_MATRIX[resolvedKey][normCategory as keyof RouteFareTier];
    }
  }

  // Standard intra-campus and city zone fallbacks
  const p = (pickupLoc?.name || pickupIdOrName || '').toLowerCase();
  const d = (dropoffLoc?.name || dropoffIdOrName || '').toLowerCase();
  const pLga = pickupLoc?.lga || '';
  const dLga = dropoffLoc?.lga || '';

  // Airport routes
  if (p.includes('airport') || d.includes('airport')) {
    if (normCategory === 'keke') return 800;
    if (normCategory === 'okada') return 1000;
    if (normCategory === 'small_bus') return 600;
    if (normCategory === 'big_bus') return 400;
    return 2000; // cab_go
  }

  // Inter-town / Campus to Minna City (Chanchaga / Bosso Town <-> Gidan Kwanu Campus)
  const isGidanKwanuTrip = (p.includes('gidan') || p.includes('hostel') || p.includes('gate') || p.includes('seet') || p.includes('saat') || p.includes('library') || p.includes('senate')) &&
    (d.includes('chanchaga') || d.includes('market') || d.includes('tunga') || d.includes('kpakungu') || d.includes('mobil') || d.includes('stadium') || d.includes('hospital') || d.includes('bosso') || d.includes('maikunkele'));

  const isReverseGidanKwanuTrip = (d.includes('gidan') || d.includes('hostel') || d.includes('gate') || d.includes('seet') || d.includes('saat') || d.includes('library') || d.includes('senate')) &&
    (p.includes('chanchaga') || p.includes('market') || p.includes('tunga') || p.includes('kpakungu') || p.includes('mobil') || p.includes('stadium') || p.includes('hospital') || p.includes('bosso') || p.includes('maikunkele'));

  if (p.includes('bosso') || d.includes('bosso') || isGidanKwanuTrip || isReverseGidanKwanuTrip) {
    if (normCategory === 'keke') return 600;
    if (normCategory === 'okada') return 800;
    if (normCategory === 'small_bus') return 400;
    if (normCategory === 'big_bus') return 250;
    return 1000;
  }

  // Intra-Chanchaga City trips (e.g. Kpakungu to Central Market or Tunga)
  if (pLga === 'Chanchaga' && dLga === 'Chanchaga') {
    if (normCategory === 'keke') return 200;
    if (normCategory === 'okada') return 250;
    if (normCategory === 'small_bus') return 150;
    if (normCategory === 'big_bus') return 100;
    return 500;
  }

  // Intra-Bosso Town trips (e.g. Bosso Campus to Bosso Estate / Maikunkele)
  if (pLga === 'Bosso' && dLga === 'Bosso' && !p.includes('gidan') && !d.includes('gidan') && !p.includes('hostel') && !d.includes('hostel')) {
    if (normCategory === 'keke') return 200;
    if (normCategory === 'okada') return 250;
    if (normCategory === 'small_bus') return 150;
    if (normCategory === 'big_bus') return 100;
    return 500;
  }

  if (p.includes('village') || d.includes('village')) {
    if (normCategory === 'keke') return 250;
    if (normCategory === 'okada') return 300;
    if (normCategory === 'small_bus') return 200;
    if (normCategory === 'big_bus') return 150;
    return 600;
  }

  if ((p.includes('gate') && d.includes('hostel')) || (p.includes('hostel') && d.includes('gate'))) {
    if (normCategory === 'keke') return 200;
    if (normCategory === 'okada') return 250;
    if (normCategory === 'small_bus') return 150;
    if (normCategory === 'big_bus') return 100;
    return 500;
  }

  // Intra-academic hops
  if (normCategory === 'keke') return 150;
  if (normCategory === 'okada') return 200;
  if (normCategory === 'small_bus') return 100;
  if (normCategory === 'big_bus') return 70;
  return 400;
}

/**
 * Finds the nearest known campus/Minna location to arbitrary GPS coordinates
 */
export function findNearestLocation(lat: number, lng: number): LocationPoint | null {
  if (!FUTMINNA_KEY_LOCATIONS || FUTMINNA_KEY_LOCATIONS.length === 0) return null;
  let nearest: LocationPoint | null = null;
  let minDistance = Infinity;

  for (const loc of FUTMINNA_KEY_LOCATIONS) {
    const dLat = loc.lat - lat;
    const dLng = loc.lng - lng;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistance) {
      minDistance = distSq;
      nearest = loc;
    }
  }

  return nearest;
}

/**
 * Calculates fair fares for any arbitrary point/coordinate on the map based on physical distance
 */
export function calculateDynamicRouteFare(
  pName: string,
  dName: string,
  category: string,
  pCoords?: [number, number],
  dCoords?: [number, number]
): number {
  // If known key location name or ID, try deterministic first
  const baseDeterministic = getDeterministicCampusFare(pName, dName, category as any);

  // If coordinates are provided and either point is custom pinned, compute real distance
  if (pCoords && dCoords && (pName.toLowerCase().includes('pinned') || dName.toLowerCase().includes('pinned') || pName.toLowerCase().includes('point') || dName.toLowerCase().includes('point'))) {
    const lat1 = pCoords[0];
    const lon1 = pCoords[1];
    const lat2 = dCoords[0];
    const lon2 = dCoords[1];
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distKm = R * c;

    const norm = category.toLowerCase();
    let fare = 200;
    if (norm === 'keke') {
      fare = distKm < 2.5 ? 200 : Math.round((200 + (distKm - 2.5) * 50) / 50) * 50;
    } else if (norm === 'okada') {
      fare = distKm < 2.5 ? 250 : Math.round((250 + (distKm - 2.5) * 60) / 50) * 50;
    } else if (norm === 'cab_go') {
      fare = distKm < 2.5 ? 500 : Math.round((500 + (distKm - 2.5) * 100) / 50) * 50;
    } else if (norm === 'small_bus') {
      fare = distKm < 2.5 ? 150 : Math.round((150 + (distKm - 2.5) * 40) / 50) * 50;
    } else if (norm === 'big_bus') {
      fare = distKm < 2.5 ? 100 : Math.round((100 + (distKm - 2.5) * 30) / 50) * 50;
    }
    return Math.max(fare, 100);
  }

  return baseDeterministic;
}

