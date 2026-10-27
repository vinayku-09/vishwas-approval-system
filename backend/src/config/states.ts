import { Region } from '../types.js';

export interface StateInfo {
  name: string;
  code: string;
  region: Region;
}

export const INDIAN_STATES: StateInfo[] = [
  // NORTH
  { name: 'Delhi', code: 'DL', region: 'NORTH' },
  { name: 'Haryana', code: 'HR', region: 'NORTH' },
  { name: 'Punjab', code: 'PB', region: 'NORTH' },
  { name: 'Himachal Pradesh', code: 'HP', region: 'NORTH' },
  { name: 'Jammu and Kashmir', code: 'JK', region: 'NORTH' },
  { name: 'Ladakh', code: 'LA', region: 'NORTH' },
  { name: 'Rajasthan', code: 'RJ', region: 'NORTH' },
  { name: 'Chandigarh', code: 'CH', region: 'NORTH' },

  // SOUTH
  { name: 'Tamil Nadu', code: 'TN', region: 'SOUTH' },
  { name: 'Karnataka', code: 'KA', region: 'SOUTH' },
  { name: 'Kerala', code: 'KL', region: 'SOUTH' },
  { name: 'Andhra Pradesh', code: 'AP', region: 'SOUTH' },
  { name: 'Telangana', code: 'TG', region: 'SOUTH' },
  { name: 'Puducherry', code: 'PY', region: 'SOUTH' },
  { name: 'Lakshadweep', code: 'LD', region: 'SOUTH' },

  // EAST
  { name: 'West Bengal', code: 'WB', region: 'EAST' },
  { name: 'Odisha', code: 'OR', region: 'EAST' },
  { name: 'Bihar', code: 'BR', region: 'EAST' },
  { name: 'Jharkhand', code: 'JH', region: 'EAST' },
  { name: 'Andaman and Nicobar Islands', code: 'AN', region: 'EAST' },

  // WEST
  { name: 'Maharashtra', code: 'MH', region: 'WEST' },
  { name: 'Gujarat', code: 'GJ', region: 'WEST' },
  { name: 'Goa', code: 'GA', region: 'WEST' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: 'DN', region: 'WEST' },

  // CENTRAL
  { name: 'Madhya Pradesh', code: 'MP', region: 'CENTRAL' },
  { name: 'Chhattisgarh', code: 'CG', region: 'CENTRAL' },
  { name: 'Uttar Pradesh', code: 'UP', region: 'CENTRAL' },
  { name: 'Uttarakhand', code: 'UK', region: 'CENTRAL' },

  // NORTH_EAST
  { name: 'Assam', code: 'AS', region: 'NORTH_EAST' },
  { name: 'Meghalaya', code: 'ML', region: 'NORTH_EAST' },
  { name: 'Manipur', code: 'MN', region: 'NORTH_EAST' },
  { name: 'Mizoram', code: 'MZ', region: 'NORTH_EAST' },
  { name: 'Nagaland', code: 'NL', region: 'NORTH_EAST' },
  { name: 'Tripura', code: 'TR', region: 'NORTH_EAST' },
  { name: 'Arunachal Pradesh', code: 'AR', region: 'NORTH_EAST' },
  { name: 'Sikkim', code: 'SK', region: 'NORTH_EAST' },
];

const stateToRegionMap = new Map<string, Region>();
for (const s of INDIAN_STATES) {
  stateToRegionMap.set(s.name.toLowerCase(), s.region);
  stateToRegionMap.set(s.code.toLowerCase(), s.region);
}

export function getStateRegion(stateOrCode: string): Region {
  const normalized = stateOrCode.trim().toLowerCase();
  const region = stateToRegionMap.get(normalized);
  if (!region) {
    // Default fallback if not recognized
    return 'ALL';
  }
  return region;
}

export function getAllStateNames(): string[] {
  return INDIAN_STATES.map((s) => s.name);
}
