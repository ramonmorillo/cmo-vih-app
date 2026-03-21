const FIELD_PATTERNS = {
  pregnancy: [
    { regex: /pregnan|embaraz/i, value: 'yes', status: 'extracted', evidence: null }
  ],
  ageBand: [
    {
      regex: /(\d{2})\s*(?:years|años)/i,
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
      regex: /(diabetes|hypertension|dyslipidemia|cardiovascular|renal|liver|hepatitis)/gi,
      aggregate: (matches) => matches.length >= 2 ? { value: 'high', evidence: matches.join('; ') } : null,
      status: 'inferred'
    }
  ],
  polypharmacy: [
    {
      regex: /(\d+)\s+(?:total\s+)?medications?/i,
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
    { regex: /(missed doses|suboptimal ART adherence|olvidos.*TAR|poor adherence)/i, value: 'suboptimal', status: 'inferred', evidence: null }
  ],
  adherenceConcomitant: [
    { regex: /(concomitant adherence issue|difficulty taking other medication|medicación concomitante.*adherencia)/i, value: 'suboptimal', status: 'inferred', evidence: null }
  ],
  hospitalization: [
    { regex: /(hospitalization|hospitalisation|hospitalización|admission).*(6 months|6 meses)?/i, value: 'recent', status: 'extracted', evidence: null }
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
    { regex: /(viral load).*?(detectable)/i, value: 'detectable', status: 'extracted', evidence: null },
    { regex: /(viral load).*?(undetectable|indetectable)/i, value: 'undetectable', status: 'extracted', evidence: null }
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
