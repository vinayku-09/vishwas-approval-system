export type LandType = 'OWNED' | 'RENTED';

export interface RequiredDocumentSpec {
  docKey: string;
  name: string;
  description: string;
  category: 'LAND' | 'STATUTORY' | 'FINANCIAL';
}

export const STATE_LAND_RECORD_NAMES: Record<string, string> = {
  maharashtra: '7/12 Extract (Satbara Utara)',
  gujarat: '7/12 Extract (Satbara Utara)',
  'tamil nadu': 'Patta / Chitta Land Record',
  karnataka: 'RTC (Pahani) Extract',
  'andhra pradesh': 'Pahani / Adangal Land Record',
  telangana: 'Pahani / Dharani Record',
  'uttar pradesh': 'Khasra / Khatauni Land Record',
  uttarakhand: 'Khasra / Khatauni Land Record',
  'madhya pradesh': 'Khasra / Khasra-Khatauni Record',
  bihar: 'Khasra / Khatiyan Land Record',
  'west bengal': 'ROR (Porcha) Land Record',
  odisha: 'ROR (Patta) Land Record',
  kerala: 'Thandaper / Land Tax Receipt',
  punjab: 'Jamabandi (Fard) Land Record',
  haryana: 'Jamabandi Land Record',
  rajasthan: 'Jamabandi Record of Rights',
};

export function getStateLandRecordName(state: string): string {
  const key = state.trim().toLowerCase();
  return STATE_LAND_RECORD_NAMES[key] || 'Record of Rights (7/12 / ROR / Patta Equivalent)';
}

export function getRequiredDocuments(landType: LandType, state: string): RequiredDocumentSpec[] {
  const landRecordName = getStateLandRecordName(state);

  const landDocs: RequiredDocumentSpec[] =
    landType === 'OWNED'
      ? [
          {
            docKey: 'landRecord',
            name: landRecordName,
            description: `Official state land record proving title (${landRecordName})`,
            category: 'LAND',
          },
          {
            docKey: 'titleDeed',
            name: 'Title / Registered Sale Deed',
            description: 'Registered sale/conveyance deed in favor of applicant Trust/Society',
            category: 'LAND',
          },
          {
            docKey: 'mutationEntry',
            name: 'Mutation Entry / Land Sanad',
            description: 'Revenue authority mutation entry evidencing change of ownership',
            category: 'LAND',
          },
          {
            docKey: 'conversionOrder',
            name: 'Non-Agricultural (NA) / Conversion Order',
            description: 'Competent revenue authority order authorizing educational use',
            category: 'LAND',
          },
        ]
      : [
          {
            docKey: 'leaseDeed',
            name: 'Registered Land Lease Deed',
            description: 'Government registered lease deed (minimum 30 years validity)',
            category: 'LAND',
          },
          {
            docKey: 'ownerNoc',
            name: 'Land Owner No Objection Certificate (NOC)',
            description: 'Affidavit/NOC from registered land owner authorizing educational use',
            category: 'LAND',
          },
        ];

  const commonDocs: RequiredDocumentSpec[] = [
    {
      docKey: 'fdrCertificate',
      name: 'Fixed Deposit Receipt (FDR) in favor of AICTE',
      description: 'Bank certified FDR document as statutory security deposit for AICTE',
      category: 'FINANCIAL',
    },
    {
      docKey: 'trustRegistration',
      name: 'Trust / Society Registration Certificate',
      description: 'Registration certificate under Public Trust Act or Societies Registration Act',
      category: 'STATUTORY',
    },
    {
      docKey: 'buildingPlan',
      name: 'Approved Building Plan',
      description: 'Master building layout approval sanctioned by local municipal/town planning body',
      category: 'STATUTORY',
    },
    {
      docKey: 'fireNoc',
      name: 'Fire Department No Objection Certificate (NOC)',
      description: 'Active Fire & Emergency Services clearance certificate',
      category: 'STATUTORY',
    },
  ];

  return [...landDocs, ...commonDocs];
}
