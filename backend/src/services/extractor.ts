import { z } from 'zod';
import { Application, DocumentMetadata, ExtractionResult } from '../types.js';

export const extractedFieldSchema = z.object({
  value: z.union([z.number(), z.string()]).optional(),
  confidence: z.number().min(0).max(1),
  sourcePage: z.number().int().positive().optional(),
  evidenceText: z.string().max(200),
});

export const extractionOutputSchema = z.object({
  landAreaSqm: z.object({
    value: z.number().positive().optional(),
    confidence: z.number().min(0).max(1),
    sourcePage: z.number().int().positive().optional(),
    evidenceText: z.string().max(200),
  }),
  leaseStartDate: z.object({
    value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    confidence: z.number().min(0).max(1),
    sourcePage: z.number().int().positive().optional(),
    evidenceText: z.string().max(200),
  }),
  leaseEndDate: z.object({
    value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    confidence: z.number().min(0).max(1),
    sourcePage: z.number().int().positive().optional(),
    evidenceText: z.string().max(200),
  }),
  fireNocExpiry: z.object({
    value: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    confidence: z.number().min(0).max(1),
    sourcePage: z.number().int().positive().optional(),
    evidenceText: z.string().max(200),
  }),
});

export type ExtractedOutput = z.infer<typeof extractionOutputSchema>;

export type ModelGeneratorFn = (prompt: string, schema: typeof extractionOutputSchema) => Promise<unknown>;

/**
 * Runs extraction with retry once on invalid schema output or model error.
 */
export async function runWithRetry(generator: ModelGeneratorFn, prompt: string): Promise<ExtractedOutput> {
  let firstError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rawOutput = await generator(prompt, extractionOutputSchema);
      const parsed = extractionOutputSchema.safeParse(rawOutput);
      if (parsed.success) {
        return parsed.data;
      }
      throw new Error(`Schema validation failed: ${parsed.error.errors.map((e) => e.message).join(', ')}`);
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      if (attempt === 1) {
        firstError = errorObj;
        // Retry attempt 2
        continue;
      }
      throw new Error(`Extraction failed after retry: ${errorObj.message} (initial error: ${firstError?.message})`);
    }
  }

  throw new Error('Extraction failed after retry: Unknown failure');
}

/**
 * Deterministic mock extractor fallback when AI_GATEWAY_API_KEY is not configured.
 */
export function mockExtract(app: Application, docs: DocumentMetadata[]): ExtractionResult {
  const hasLease = docs.some((d) => d.docType === 'LEASE_DEED');
  const hasNoc = docs.some((d) => d.docType === 'FIRE_NOC');
  const hasLand = docs.some((d) => d.docType === 'LAND_RECORD');

  // Derive plausible values from application seed or fallback defaults
  const landArea = app.extracted?.landAreaSqm ?? (hasLand || hasLease ? 7500 : 4500);
  const leaseEndDate = app.extracted?.leaseEndDate ?? '2045-12-31';
  const fireNocExpiry = app.extracted?.fireNocExpiry ?? '2028-06-30';

  const fields = {
    landAreaSqm: {
      value: landArea,
      confidence: hasLand || hasLease ? 0.95 : 0.65, // Low confidence if no deed document uploaded
      sourcePage: 2,
      evidenceText: `Total campus land area is certified as ${landArea.toLocaleString()} sq.m contiguous plot.`,
      needsReview: !(hasLand || hasLease),
    },
    leaseStartDate: {
      value: '2020-01-01',
      confidence: 0.92,
      sourcePage: 1,
      evidenceText: 'This registered land lease deed is entered into on 1st day of January 2020.',
      needsReview: false,
    },
    leaseEndDate: {
      value: leaseEndDate,
      confidence: hasLease ? 0.88 : 0.60,
      sourcePage: 4,
      evidenceText: `The lease period shall expire and terminate on ${leaseEndDate}.`,
      needsReview: !hasLease,
    },
    fireNocExpiry: {
      value: fireNocExpiry,
      confidence: hasNoc ? 0.91 : 0.62,
      sourcePage: 1,
      evidenceText: `Fire and Life Safety Certificate valid up to ${fireNocExpiry}.`,
      needsReview: !hasNoc,
    },
  };

  return {
    source: 'mock',
    model: 'mock-deterministic-vision-extractor',
    extractedAt: new Date().toISOString(),
    fields,
  };
}

/**
 * Main extractor entrypoint: chooses Real AI SDK Vision extraction if AI_GATEWAY_API_KEY is set,
 * otherwise falls back to deterministic mock extractor.
 */
export async function extractApplicationDocuments(
  app: Application,
  docs: DocumentMetadata[],
  customGenerator?: ModelGeneratorFn
): Promise<ExtractionResult> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (customGenerator) {
    const prompt = `Extract regulatory AICTE fields from ${docs.length} uploaded files for ${app.institutionName}`;
    const result = await runWithRetry(customGenerator, prompt);
    return {
      source: 'real',
      model: process.env.EXTRACTION_MODEL || 'custom-model',
      extractedAt: new Date().toISOString(),
      fields: {
        landAreaSqm: {
          ...result.landAreaSqm,
          needsReview: result.landAreaSqm.confidence < 0.7,
        },
        leaseStartDate: {
          ...result.leaseStartDate,
          needsReview: result.leaseStartDate.confidence < 0.7,
        },
        leaseEndDate: {
          ...result.leaseEndDate,
          needsReview: result.leaseEndDate.confidence < 0.7,
        },
        fireNocExpiry: {
          ...result.fireNocExpiry,
          needsReview: result.fireNocExpiry.confidence < 0.7,
        },
      },
    };
  }

  if (apiKey && apiKey.trim().length > 0) {
    const { generateObject } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');

    const modelId = process.env.EXTRACTION_MODEL || 'gpt-4o-mini';
    const openai = createOpenAI({
      apiKey,
      baseURL: process.env.AI_GATEWAY_BASE_URL || 'https://api.vercel.com/v1/ai',
    });

    const docDescriptions = docs
      .map((d) => `Document ${d.fileName} (${d.docType}) at ${d.storageUrl}`)
      .join('\n');

    const prompt = `You are an AI document extractor for AICTE technical institution approvals.
Institution: ${app.institutionName}
Uploaded Documents:
${docDescriptions}

Analyze the documents and extract:
1. landAreaSqm: Total contiguous land area in square meters.
2. leaseStartDate: Lease start date (YYYY-MM-DD).
3. leaseEndDate: Lease termination or renewal expiry date (YYYY-MM-DD).
4. fireNocExpiry: Fire and safety NOC validity expiration date (YYYY-MM-DD).

Provide value, confidence between 0 and 1, sourcePage, and an evidenceText quote (under 200 characters).`;

    const realGenerator: ModelGeneratorFn = async (p, schema) => {
      const res = await generateObject({
        model: openai(modelId),
        schema,
        prompt: p,
      });
      return res.object;
    };

    const result = await runWithRetry(realGenerator, prompt);
    return {
      source: 'real',
      model: modelId,
      extractedAt: new Date().toISOString(),
      fields: {
        landAreaSqm: {
          ...result.landAreaSqm,
          needsReview: result.landAreaSqm.confidence < 0.7,
        },
        leaseStartDate: {
          ...result.leaseStartDate,
          needsReview: result.leaseStartDate.confidence < 0.7,
        },
        leaseEndDate: {
          ...result.leaseEndDate,
          needsReview: result.leaseEndDate.confidence < 0.7,
        },
        fireNocExpiry: {
          ...result.fireNocExpiry,
          needsReview: result.fireNocExpiry.confidence < 0.7,
        },
      },
    };
  }

  // Zero-setup mock extractor
  return mockExtract(app, docs);
}
