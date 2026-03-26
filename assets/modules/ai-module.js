const FIELD_PATTERNS = {
  pregnancy: [
    { regex: /pregnan|embaraz/i, value: 'yes', status: 'extracted', evidence: null }
  ],
  ageBand: [
    // FIX 2: allow optional hyphen between number and "year" (e.g. "52-year-old")
    {
      regex: /(\d{2,3})\s*[-–]?\s*(?:year(?:s|-old)?|años)/i,
      resolver: (match) => {
        const age = Number(match[1]);
        if (age > 65) return { value: 'over65', evidence: String(age) };
        if (age > 50) return { value: 'over50', evidence: String(age) };
        return { value: 'under50', evidence: String(age) };
      },
      status: 'extracted'
    },
    // FIX 2: second pattern for Spanish "de 52 años" format
    {
      regex: /de\s+(\d{2,3})\s+años/i,
      resolver: (match) => {
        const age = Number(match[1]);
        if (age > 65) return { value: 'over65', evidence: String(age) };
        if (age > 50) return { value: 'over50', evidence: String(age) };
        return { value: 'under50', evidence: String(age) };
      },
      status: 'extracted'
    }
  ],
  comorbidities: [
    {
      // FIX 4: added Spanish terms: hipertensión, dislipemia, hepatopatía, insuficiencia renal, obesidad, EPOC
      regex: /(diabetes|hypertension|dyslipidemia|cardiovascular|renal|liver|hepatitis|hipertensión|hipertension|dislipemia|hepatopatía|hepatopatia|insuficiencia\s+renal|obesidad|EPOC)/gi,
      // FIX 4: 1 match → low (was null), 2+ matches → high
      aggregate: (matches) => {
        if (matches.length >= 2) return { value: 'high', evidence: matches.join('; ') };
        if (matches.length === 1) return { value: 'low', evidence: matches[0] };
        return null;
      },
      status: 'inferred'
    }
  ],
  polypharmacy: [
    // FIX 3: "polimedicado" alone implies high polypharmacy
    { regex: /polimedicado/i, value: 'high', status: 'inferred', evidence: null },
    {
      // FIX 3: added Spanish variants: medicamentos, fármacos, principios activos
      regex: /(\d+)\s+(?:total\s+)?(?:medications?|medicamentos?|fármacos?|farmacos?|principios\s+activos)/i,
      resolver: (match) => Number(match[1]) >= 6 ? { value: 'high', evidence: match[0] } : { value: 'low', evidence: match[0] },
      status: 'extracted'
    }
  ],
  complexity: [
    {
      regex: /(complexity(?:\s+index)?|índice de complejidad)\D{0,15}(\d+(?:\.\d+)?)/i,
      resolver: (match) => Number(match[2]) > 11.25 ? { value: 'high', evidence: match[0] } : { value: 'low', evidence: match[0] },
      status: 'extracted'
    }
  ],
  adherenceArt: [
    // FIX 6: added Spanish variants for poor ART adherence
    { regex: /(missed doses|suboptimal ART adherence|olvidos.*TAR|poor adherence|olvida\s+tomas|no\s+toma\s+correctamente|mal\s+cumplimiento|incumplimiento\s+TAR|adherencia\s+sub[oó]ptima)/i, value: 'suboptimal', status: 'inferred', evidence: null }
  ],
  adherenceConcomitant: [
    // FIX 6: added Spanish variants for concomitant adherence issues
    { regex: /(concomitant adherence issue|difficulty taking other medication|medicaci[oó]n concomitante.*adherencia|adherencia.*medicaci[oó]n concomitante)/i, value: 'suboptimal', status: 'inferred', evidence: null }
  ],
  hospitalization: [
    // FIX 5: added "hospitalizado" and "ingreso hospitalario"; time reference optional (either order)
    { regex: /(hospitalization|hospitalisation|hospitalización|hospitalizado|ingreso\s+hospitalario|admission).*(6\s*months?|6\s*meses)?/i, value: 'recent', status: 'extracted', evidence: null },
    // FIX 5: second pattern with time reference appearing BEFORE the hospitalization term
    { regex: /(6\s*months?|6\s*meses).*(hospitali[zs]ation|hospitalización|hospitalizado|admission|ingreso)/i, value: 'recent', status: 'extracted', evidence: null }
  ],
  qualityOfLife: [
    { regex: /(fatigue|quality of life affected|calidad de vida afectada|functional limitation)/i, value: 'affected', status: 'inferred', evidence: null }
  ],
  depression: [
    { regex: /(depressive symptoms|depression|depresi)/i, value: 'yes', status: 'extracted', evidence: null }
  ],
  substanceUse: [
    { regex: /(alcohol misuse|substance use|abuso de sustancias|drug use)/i, value: 'yes', status: 'extracted', evidence: null }
  ],
  neurocognitive: [
    { regex: /(neurocognitive|cognitive impairment|deterioro cognitivo)/i, value: 'yes', status: 'extracted', evidence: null }
  ],
  frailty: [
    { regex: /(frailty|frágil|fragilidad)/i, value: 'yes', status: 'extracted', evidence: null }
  ],
  socioeconomic: [
    { regex: /(lives alone|homeless|housing insecurity|vive solo|social isolation|pension)/i, value: 'vulnerable', status: 'inferred', evidence: null }
  ],
  viralLoad: [
    // FIX 1: undetectable/indetectable evaluated FIRST to prevent substring false positive
    // Also added "carga viral" for Spanish notes
    { regex: /(viral load|carga viral).*?(undetectable|indetectable)/i, value: 'undetectable', status: 'extracted', evidence: null },
    // FIX 1: \b word boundary ensures "undetectable" does not match this pattern
    { regex: /(viral load|carga viral).*?\b(detectable)\b/i, value: 'detectable', status: 'extracted', evidence: null }
  ],
  comorbidityGoals: [
    { regex: /(HbA1c\s*[>:=]?\s*8|blood pressure\s*145\/90|goals remain unmet|objetivos.*no alcanzados)/i, value: 'notAchieved', status: 'inferred', evidence: null }
  ]
};

function runPattern(fieldId, text) {
  const patterns = FIELD_PATTERNS[fieldId] || [];
  for (const pattern of patterns) {
    if (pattern.aggregate) {
      const matches = [...text.matchAll(pattern.regex)].map((item) => item[0]);
      const aggregateResult = pattern.aggregate(matches);
      if (aggregateResult) {
        return { ...aggregateResult, status: pattern.status };
      }
      continue;
    }

    const match = text.match(pattern.regex);
    if (!match) continue;
    if (pattern.resolver) {
      const resolved = pattern.resolver(match);
      return { ...resolved, status: pattern.status };
    }
    return { value: pattern.value, status: pattern.status, evidence: pattern.evidence || match[0] };
  }
  return null;
}

const AI_EXTRACTION_PROMPT = (narrativeText) => `You are a clinical pharmacist extracting structured data from an HIV patient's \
clinical note to stratify pharmaceutical care complexity.

Extract ONLY the following fields. For each field, return ONLY one of its valid \
values. If a field cannot be determined from the text, return null.

Fields to extract (id: valid values):
- ageBand: "under50" | "over50" | "over65"
- comorbidities: "low" (1 comorbidity) | "high" (2 or more comorbidities)
- polypharmacy: "low" (fewer than 6 drugs) | "high" (6 or more drugs) — COUNT all drugs listed, including antiretroviral therapy
- complexity: "low" | "high" (high if complexity index > 11.25, or if polypharmacy is high AND multiple comorbidities)
- adherenceArt: "good" | "suboptimal"
- adherenceConcomitant: "good" | "suboptimal"
- hospitalization: "none" | "recent" (hospitalized in the past 6 months — calculate from dates if present)
- qualityOfLife: "normal" | "affected"
- depression: "no" | "yes"
- substanceUse: "no" | "yes" — IMPORTANT: only "yes" if ACTIVE use is confirmed; "No alcohol" means "no"
- neurocognitive: "no" | "yes"
- frailty: "no" | "yes"
- socioeconomic: "stable" | "vulnerable" (vulnerable if: lives alone, social problems, housing issues, poverty, food insecurity)
- viralLoad: "undetectable" | "detectable" — accept "ARN VIH indetectable", "CV indetectable", "carga viral indetectable" as undetectable
- comorbidityGoals: "achieved" | "notAchieved"
- pregnancy: "no" | "yes"

Clinical note:
${narrativeText}

Respond with ONLY a valid JSON object. No explanation, no markdown. Example:
{"ageBand": "over50", "comorbidities": "high", "polypharmacy": "high", \
 "viralLoad": "undetectable", "hospitalization": "recent", "substanceUse": "no",
 "socioeconomic": "vulnerable", "adherenceArt": "good", "depression": "no",
 "frailty": "no", "neurocognitive": "no", "qualityOfLife": "normal",
 "comorbidityGoals": "achieved", "complexity": "low", "pregnancy": "no",
 "adherenceConcomitant": "good"}`;

export function extractFromNarrative(text, fields, translate) {
  const updates = {};
  const missing = [];
  const extractionSummary = [];

  Object.keys(fields).forEach((fieldId) => {
    const result = runPattern(fieldId, text);
    if (result) {
      updates[fieldId] = {
        value: result.value,
        status: result.status,
        source: 'ai',
        evidence: result.evidence,
        clinicianConfirmed: false
      };
      extractionSummary.push({
        fieldId,
        value: result.value,
        status: result.status,
        evidence: result.evidence
      });
    } else {
      missing.push(fieldId);
    }
  });

  const explanation = extractionSummary.length
    ? translate('ai.summaryDetected', { count: extractionSummary.length })
    : translate('ai.summaryNone');

  return {
    updates,
    extractionSummary,
    missing,
    explanation
  };
}

export async function extractFromNarrativeAI(narrative, fields, fieldDefinitions, apiKey, translate) {
  // Step 1: run regex extraction first
  const regexResult = extractFromNarrative(narrative, fields, translate);

  // Step 2: nothing missing or no key — return regex result as-is
  if (!regexResult.missing.length || !apiKey) {
    return regexResult;
  }

  // Step 3: call Anthropic API for remaining missing fields
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: AI_EXTRACTION_PROMPT(narrative) }]
      })
    });

    if (!response.ok) {
      throw new Error(`API ${response.status}`);
    }

    const data = await response.json();
    const aiFields = JSON.parse(data.content[0].text);

    // Step 4: merge AI results — only fill fields that were missing after regex
    const updates = { ...regexResult.updates };
    const extractionSummary = [...regexResult.extractionSummary];
    const missing = [];
    let aiCount = 0;
    const AI_EVIDENCE = 'Extraído por IA — requiere confirmación clínica';

    for (const fieldId of regexResult.missing) {
      const aiValue = aiFields[fieldId];
      if (aiValue !== null && aiValue !== undefined) {
        updates[fieldId] = {
          value: aiValue,
          status: 'inferred',
          source: 'ai',
          evidence: AI_EVIDENCE,
          clinicianConfirmed: false
        };
        extractionSummary.push({ fieldId, value: aiValue, status: 'inferred', evidence: AI_EVIDENCE });
        aiCount++;
      } else {
        missing.push(fieldId);
      }
    }

    const regexCount = regexResult.extractionSummary.length;
    const explanation = translate('ai.summaryAI', { regex: regexCount, ai: aiCount });

    return { updates, extractionSummary, missing, explanation };
  } catch {
    // Step 5: fall back to regex-only result with warning
    return {
      ...regexResult,
      explanation: `${translate('ai.apiFallback')} ${regexResult.explanation || ''}`.trim()
    };
  }
}
