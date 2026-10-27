import { SUSPICIOUS_PDF_PRODUCERS } from '../config/landDocuments.js';

export interface RiskSignal {
  code: string;
  label: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  score: number;
  evidence: string;
  documentKey?: string;
  documentName?: string;
}

export interface DocumentRiskScore {
  documentKey: string;
  documentName: string;
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  signals: RiskSignal[];
}

export interface InstitutionRiskAssessment {
  institutionName: string;
  overallScore: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  disclaimer: string;
  signals: RiskSignal[];
  documentScores: DocumentRiskScore[];
  assessedAt: string;
}

export interface DocumentScanInput {
  docKey: string;
  name: string;
  sha256: string;
  fileName: string;
  pdfMetadata?: {
    producer?: string;
    creator?: string;
  };
  extracted?: {
    institutionName?: string;
    landAreaSqm?: number;
    amount?: number;
    startDate?: string;
    endDate?: string;
    confidence?: number;
  };
}

export interface ProfileRiskInput {
  institutionName: string;
  collegeName: string;
  landType: 'OWNED' | 'RENTED';
  declaredLandAreaSqm?: number;
  fdrAmount?: number;
  fdrIssueDate?: string;
  fdrMaturityDate?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  fireNocExpiry?: string;
  documents: DocumentScanInput[];
  existingForeignHashes: Set<string>; // Hashes from other institutions only
}

export function evaluateInstitutionRisk(input: ProfileRiskInput): InstitutionRiskAssessment {
  const signals: RiskSignal[] = [];
  const docScoreMap = new Map<string, { score: number; signals: RiskSignal[]; name: string }>();

  for (const doc of input.documents) {
    docScoreMap.set(doc.docKey, { score: 0, signals: [], name: doc.name });
  }

  const addSignal = (sig: RiskSignal) => {
    signals.push(sig);
    if (sig.documentKey && docScoreMap.has(sig.documentKey)) {
      const entry = docScoreMap.get(sig.documentKey)!;
      entry.score = Math.min(100, entry.score + sig.score);
      entry.signals.push(sig);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  // 1. Cross-institution duplicate hash check
  for (const doc of input.documents) {
    if (doc.sha256 && input.existingForeignHashes.has(doc.sha256)) {
      addSignal({
        code: 'DUPLICATE_HASH_CROSS_INSTITUTION',
        label: 'Duplicate Document Hash Across Institutions',
        severity: 'HIGH',
        score: 35,
        evidence: `SHA-256 checksum (${doc.sha256.slice(0, 12)}...) matches a statutory file previously submitted under a different institution.`,
        documentKey: doc.docKey,
        documentName: doc.name,
      });
    }

    // 2. Suspicious PDF metadata (editing / graphic design tools)
    const producer = (doc.pdfMetadata?.producer || '').toLowerCase();
    const creator = (doc.pdfMetadata?.creator || '').toLowerCase();
    const matchedTool = SUSPICIOUS_PDF_PRODUCERS.find(
      (tool) => producer.includes(tool) || creator.includes(tool)
    );

    if (matchedTool) {
      addSignal({
        code: 'DESIGN_TOOL_METADATA',
        label: 'Graphic Editing Software Signature in PDF',
        severity: 'MEDIUM',
        score: 25,
        evidence: `Document metadata reveals compilation or modification using graphic software (${matchedTool}). Statutory records are expected to originate from official scanning hardware or digital registration portals.`,
        documentKey: doc.docKey,
        documentName: doc.name,
      });
    }

    // 3. Low extraction confidence
    if (doc.extracted?.confidence !== undefined && doc.extracted.confidence < 0.6) {
      addSignal({
        code: 'LOW_EXTRACTION_CONFIDENCE',
        label: 'Low Document Extraction Confidence',
        severity: 'LOW',
        score: 15,
        evidence: `Automated OCR confidence score is ${(doc.extracted.confidence * 100).toFixed(0)}% on critical regulatory clauses. Possible scan degradation, skewed orientation, or watermark overlay.`,
        documentKey: doc.docKey,
        documentName: doc.name,
      });
    }
  }

  // 4. Conflicts between declared values and extracted values
  for (const doc of input.documents) {
    if (!doc.extracted) continue;

    // College name mismatch
    if (doc.extracted.institutionName) {
      const declared = input.collegeName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const extracted = doc.extracted.institutionName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (declared && extracted && !declared.includes(extracted.slice(0, 10)) && !extracted.includes(declared.slice(0, 10))) {
        addSignal({
          code: 'INSTITUTION_NAME_MISMATCH',
          label: 'Declared College Name Discrepancy',
          severity: 'HIGH',
          score: 30,
          evidence: `Declared college title does not match institution name identified on ${doc.name}.`,
          documentKey: doc.docKey,
          documentName: doc.name,
        });
      }
    }

    // Land area mismatch
    if (doc.docKey === 'landRecord' || doc.docKey === 'titleDeed' || doc.docKey === 'leaseDeed') {
      if (input.declaredLandAreaSqm && doc.extracted.landAreaSqm) {
        const diff = Math.abs(input.declaredLandAreaSqm - doc.extracted.landAreaSqm);
        const percentDiff = diff / Math.max(input.declaredLandAreaSqm, doc.extracted.landAreaSqm);
        if (percentDiff > 0.15) {
          addSignal({
            code: 'LAND_AREA_CONFLICT',
            label: 'Land Area Figure Mismatch',
            severity: 'HIGH',
            score: 25,
            evidence: `Declared land area (${input.declaredLandAreaSqm.toLocaleString()} sq.m) differs significantly from extracted deed value (${doc.extracted.landAreaSqm.toLocaleString()} sq.m).`,
            documentKey: doc.docKey,
            documentName: doc.name,
          });
        }
      }
    }

    // FDR Amount mismatch
    if (doc.docKey === 'fdrCertificate' && input.fdrAmount && doc.extracted.amount) {
      if (Math.abs(input.fdrAmount - doc.extracted.amount) > 100) {
        addSignal({
          code: 'FDR_AMOUNT_CONFLICT',
          label: 'FDR Principal Amount Mismatch',
          severity: 'HIGH',
          score: 25,
          evidence: `Declared FDR deposit (₹${input.fdrAmount.toLocaleString()}) does not match receipt principal amount (₹${doc.extracted.amount.toLocaleString()}).`,
          documentKey: doc.docKey,
          documentName: doc.name,
        });
      }
    }
  }

  // 5. Date anomalies (missing, inverted, or expired)
  if (input.fdrIssueDate && input.fdrMaturityDate) {
    if (input.fdrIssueDate > input.fdrMaturityDate) {
      addSignal({
        code: 'ODD_FDR_DATES',
        label: 'Inverted FDR Validity Dates',
        severity: 'HIGH',
        score: 25,
        evidence: `FDR issue date (${input.fdrIssueDate}) is set after the maturity date (${input.fdrMaturityDate}).`,
        documentKey: 'fdrCertificate',
        documentName: 'Fixed Deposit Receipt',
      });
    }
    if (input.fdrMaturityDate < today) {
      addSignal({
        code: 'EXPIRED_FDR',
        label: 'FDR Already Matured / Expired',
        severity: 'HIGH',
        score: 30,
        evidence: `FDR security deposit matured on ${input.fdrMaturityDate} and is no longer active.`,
        documentKey: 'fdrCertificate',
        documentName: 'Fixed Deposit Receipt',
      });
    }
  }

  if (input.landType === 'RENTED' && input.leaseStartDate && input.leaseEndDate) {
    if (input.leaseStartDate >= input.leaseEndDate) {
      addSignal({
        code: 'ODD_LEASE_DATES',
        label: 'Inverted Lease Deed Period',
        severity: 'HIGH',
        score: 30,
        evidence: `Lease start date (${input.leaseStartDate}) is after or equal to lease termination date (${input.leaseEndDate}).`,
        documentKey: 'leaseDeed',
        documentName: 'Registered Lease Deed',
      });
    } else if (input.leaseEndDate < today) {
      addSignal({
        code: 'EXPIRED_LEASE',
        label: 'Lease Deed Expired',
        severity: 'HIGH',
        score: 35,
        evidence: `Registered lease deed concluded on ${input.leaseEndDate} and has lapsed.`,
        documentKey: 'leaseDeed',
        documentName: 'Registered Lease Deed',
      });
    }
  }

  if (input.fireNocExpiry) {
    if (input.fireNocExpiry < today) {
      addSignal({
        code: 'EXPIRED_FIRE_NOC',
        label: 'Fire Safety NOC Expired',
        severity: 'HIGH',
        score: 30,
        evidence: `Fire NOC certificate validity expired on ${input.fireNocExpiry}. Statutory building occupation violation.`,
        documentKey: 'fireNoc',
        documentName: 'Fire and Life Safety Certificate',
      });
    }
  }

  // Calculate overall score (capped at 100)
  const rawTotal = signals.reduce((acc, s) => acc + s.score, 0);
  const overallScore = Math.min(100, rawTotal);

  let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (overallScore >= 71) {
    level = 'HIGH';
  } else if (overallScore >= 31) {
    level = 'MEDIUM';
  }

  const documentScores: DocumentRiskScore[] = Array.from(docScoreMap.entries()).map(([key, val]) => {
    let docLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (val.score >= 71) docLevel = 'HIGH';
    else if (val.score >= 31) docLevel = 'MEDIUM';

    return {
      documentKey: key,
      documentName: val.name,
      score: val.score,
      level: docLevel,
      signals: val.signals,
    };
  });

  return {
    institutionName: input.institutionName,
    overallScore,
    level,
    disclaimer: 'Risk indicators are assistive signals and not definitive proof of irregularities. Scrutiny officers must independently verify physical/digital originals before decision.',
    signals,
    documentScores,
    assessedAt: new Date().toISOString(),
  };
}
