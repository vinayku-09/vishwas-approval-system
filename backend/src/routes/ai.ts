import { Hono } from 'hono';

export const aiRouter = new Hono();

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-pro-latest',
];

interface ScrutinyRequestBody {
  apiKey?: string;
  type?: 'APPLICATION' | 'COURSE_PROPOSAL';
  data: any;
}

/**
 * Validates a Gemini API key by making a minimal test call
 */
aiRouter.post('/test-key', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const key =
      body.apiKey?.trim() ||
      c.req.header('x-gemini-key')?.trim() ||
      process.env.GEMINI_API_KEY?.trim();

    if (!key) {
      return c.json(
        { valid: false, error: 'Gemini API key is required. Please enter a valid key from Google AI Studio.' },
        400
      );
    }

    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(
      key
    )}`;

    const res = await fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with the word OK if you can read this.' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as any;
      const msg = errData?.error?.message || `HTTP ${res.status}: Invalid API Key or Unauthorized`;
      return c.json({ valid: false, error: msg }, 400);
    }

    return c.json({ valid: true, message: 'Google Gemini API key successfully validated!' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ valid: false, error: msg }, 500);
  }
});

/**
 * Scrutiny & Fault Analysis from AICTE Officer Perspective
 */
aiRouter.post('/scrutiny', async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as ScrutinyRequestBody;
    const key =
      body.apiKey?.trim() ||
      c.req.header('x-gemini-key')?.trim() ||
      process.env.GEMINI_API_KEY?.trim();

    if (!key) {
      return c.json(
        {
          error:
            'Google Gemini API key required. Please enter your API key in the Officer Scrutiny Console (obtainable from aistudio.google.com).',
          code: 'KEY_MISSING',
        },
        400
      );
    }

    const { type = 'COURSE_PROPOSAL', data } = body;
    if (!data) {
      return c.json({ error: 'Application or proposal data is required for scrutiny analysis.' }, 400);
    }

    const prompt = buildScrutinyPrompt(type, data);

    let lastError = '';
    let responseJson: any = null;

    // Attempt model calls with fallback across available Gemini versions
    for (const model of GEMINI_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          key
        )}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
        });

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as any;
          lastError = errData?.error?.message || `Model ${model} returned HTTP ${res.status}`;
          continue;
        }

        const resData = (await res.json()) as any;
        const rawText = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          lastError = `Model ${model} produced empty response.`;
          continue;
        }

        responseJson = parseJsonSafe(rawText);
        if (responseJson) break;
      } catch (e: any) {
        lastError = e?.message || String(e);
      }
    }

    if (!responseJson) {
      return c.json(
        {
          error: `Gemini AI analysis could not be completed: ${lastError}`,
          code: 'GEMINI_CALL_FAILED',
        },
        502
      );
    }

    return c.json({
      success: true,
      analysis: responseJson,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Internal error in AI scrutiny service: ${msg}` }, 500);
  }
});

function parseJsonSafe(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    // Strip markdown code fences if model enclosed JSON
    const clean = raw.replace(/^```json/im, '').replace(/```$/m, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      return null;
    }
  }
}

function buildScrutinyPrompt(type: string, data: any): string {
  return `You are a Senior AICTE Scrutiny Officer evaluating an institutional ${type} under the statutory guidelines of the AICTE Approval Process Handbook (APH 2024-27).

YOUR TASK:
Perform a comprehensive, objective scrutiny of the provided application/proposal data strictly from the PERSPECTIVE OF AN AICTE SCRUTINY OFFICER.

CRITICAL SCRUTINY DOMAINS TO AUDIT:
1. Student-to-Faculty Ratio (SFR): (UG standard is 1:20; PG is 1:15; Diploma is 1:25). Check sanctioned vs available faculty.
2. Faculty Pay & Cadre Compliance: Verification of 6th/7th Pay Commission compliance and Professor/Assoc. Professor/Asst. Professor cadre ratio.
3. Land & Infrastructure: Land area sufficiency, Bhulekh 7/12 land records verification, and built-up area for instructional/administrative spaces.
4. Affiliation & Approvals: Affiliation NOC from the State Technical University / Board, and Fire Safety NOC validity.
5. Intake Sanction Limits: Reasonableness of requested seats and division increments.

INPUT DATA FOR APPRAISAL:
${JSON.stringify(data, null, 2)}

OUTPUT REQUIREMENT:
You must respond with a STRICT JSON OBJECT with this EXACT schema:
{
  "summary": "Concise 2-sentence executive appraisal summary from the officer perspective",
  "riskLevel": "HIGH" | "MEDIUM" | "LOW",
  "faults": [
    "Concrete regulatory violation or fault 1 citing specific figures/rules",
    "Concrete regulatory violation or fault 2"
  ],
  "whatIsWrong": [
    "Detailed explanation of what failed from the scrutiny officer perspective",
    "Detailed explanation of the statutory impact"
  ],
  "suggestedChanges": [
    "Exact mandatory remedial action the institution must take to achieve compliance",
    "Document or clarification required from the college"
  ],
  "recommendedDecision": "NO_CONCERN" | "ASK_CLARIFICATION" | "REFER",
  "draftOfficerRemarks": "A formal, professional, statutory scrutiny paragraph that the officer can copy or apply directly into the official AICTE Scrutiny Record with 1-click. Cites relevant APH provisions, summarizes findings, and states the formal determination.",
  "statutoryCitations": [
    "Relevant AICTE APH clauses e.g. APH Clause 2.14 (Cadre Ratio), Appendix 4 (Land Norms), Appendix 7 (NOCs)"
  ]
}

Ensure all faults, whatIsWrong points, suggested changes, and draft officer remarks are tailored specifically to the numbers, branches, faculty, and documents in the input data.`;
}
