export type LandType = 'OWNED' | 'RENTED';

export interface RequiredDocumentSpec {
  docKey: string;
  name: string;
  description: string;
  category: 'LAND' | 'STATUTORY' | 'FINANCIAL';
}

/**
 * State-specific land record name mappings.
 * E.g., 7/12 Extract in Maharashtra/Gujarat, Patta/Chitta in Tamil Nadu, RTC in Karnataka.
 */
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

/**
 * Returns the exact list of required documents for an institution based on land ownership type and state.
 */
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
            description: 'Registered sale/conveyance deed in favor of the applicant Trust/Society',
            category: 'LAND',
          },
          {
            docKey: 'mutationEntry',
            name: 'Mutation Entry / Land Sanad',
            description: 'Revenue authority mutation entry evidencing change of ownership in government records',
            category: 'LAND',
          },
          {
            docKey: 'conversionOrder',
            name: 'Non-Agricultural (NA) / Land Conversion Order',
            description: 'Competent revenue authority order authorizing use for educational purpose',
            category: 'LAND',
          },
        ]
      : [
          {
            docKey: 'leaseDeed',
            name: 'Registered Land Lease Deed',
            description: 'Government registered lease deed with clear start date, end date (minimum 30 years), and survey numbers',
            category: 'LAND',
          },
          {
            docKey: 'ownerNoc',
            name: 'Land Owner No Objection Certificate (NOC)',
            description: 'Affidavit/NOC from the registered land owner authorizing educational establishment',
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
      description: 'Registration certificate under Public Trust Act or Societies Registration Act along with Memorandum of Association',
      category: 'STATUTORY',
    },
    {
      docKey: 'buildingPlan',
      name: 'Sanctioned Building Plan Approval',
      description: 'Building completion / sanctioned architectural plan approved by municipal/local planning authority',
      category: 'STATUTORY',
    },
    {
      docKey: 'fireNoc',
      name: 'Fire and Life Safety Certificate (Fire NOC)',
      description: 'Valid Fire Safety NOC issued by the State Fire Services Department',
      category: 'STATUTORY',
    },
  ];

  return [...landDocs, ...commonDocs];
}

/**
 * List of editing, manipulation, or design software signatures.
 * If detected in PDF Creator / Producer / Author metadata, this creates a risk signal for scrutiny.
 */
export const SUSPICIOUS_PDF_PRODUCERS: string[] = [
  'photoshop',
  'canva',
  'illustrator',
  'coreldraw',
  'gimp',
  'sejda',
  'ilovepdf',
  'pdfescape',
  'smallpdf',
  'foxit phantompdf',
  'indesign',
  'inkscape',
  'paint.net',
  'pdf2go',
  'soda pdf',
  'online-convert',
  'wondershare pdfelement',
];
