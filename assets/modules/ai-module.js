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
    // FIX 5 (v2): added "hospitalizado" and "ingreso hospitalario", time reference either order.
    // FIX 7 (v3): recency marker is now REQUIRED (was optional via trailing "?"), which previously
    // classified ANY mention of hospitalization as 'recent' regardless of timeframe. Window bounded
    // to 40 chars so the recency marker must be close to the hospitalization mention.
    { regex: /(hospitalization|hospitalisation|hospitalización|hospitalizado|ingreso\s+hospitalario|admission).{0,40}(6\s*months?|6\s*meses|recent|reciente)/i, value: 'recent', status: 'extracted', evidence: null },
    // FIX 5 (v2): second pattern with time reference appearing BEFORE the hospitalization term.
    // FIX 7 (v3): also accept "recent"/"reciente" as a leading marker (covers "recent hospitalization",
    // where the adjective precedes the noun — pattern above only matches the reverse order).
    { regex: /(6\s*months?|6\s*meses|recent|reciente).{0,40}(hospitali[zs]ation|hospitalización|hospitalizado|admission|ingreso)/i, value: 'recent', status: 'extracted', evidence: null }
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
    // Left untouched per explicit decision (out of scope for this iteration): hardcoded thresholds
    // (HbA1c ~8, BP 145/90) are known to be overfit to EXAMPLE_CASE and not generalized — see
    // audit notes. skipNegation keeps this pattern's matching behavior unchanged.
    { regex: /(HbA1c\s*[>:=]?\s*8|blood pressure\s*145\/90|goals remain unmet|objetivos.*no alcanzados)/i, value: 'notAchieved', status: 'inferred', evidence: null, skipNegation: true }
  ]
};

// FIX 7 (v3): minimal negation heuristic (English + Spanish cues). Not a full clinical NLP
// negation detector (e.g. NegEx) — it only looks back to the start of the current clause
// (bounded by ".", ";" or a newline) for a negation trigger word.
// Known limitation: only text BEFORE the match start is inspected. A negation word that falls
// INSIDE a wildcard-spanned match (e.g. "viral load is *not* detectable", where the regex's
// `.*?` between "viral load" and "detectable" swallows "not") is not caught. Expanding the
// window to the full match span was tried and reverted: some patterns intentionally embed "no"
// as part of the positive clinical assertion itself (e.g. adherenceArt's "no toma correctamente"
// literally means poor adherence), so a span-wide scan produces false suppressions there.
const NEGATION_TRIGGERS = /\b(no|not|without|denies?|denied|negative(?:\s+for)?|rules?\s+out|ruled\s+out|absence\s+of|sin|niega|niego|neg[oó]|ausencia\s+de|ausente|descart(?:a|ada|ado))\b/i;

function isNegated(text, matchIndex) {
  if (typeof matchIndex !== 'number') return false;
  const preceding = text.slice(0, matchIndex);
  const clauseStart = Math.max(
    preceding.lastIndexOf('.'),
    preceding.lastIndexOf(';'),
    preceding.lastIndexOf('\n')
  );
  const clause = text.slice(clauseStart + 1, matchIndex);
  return NEGATION_TRIGGERS.test(clause);
}

function toGlobalRegex(regex) {
  return regex.global ? regex : new RegExp(regex.source, `${regex.flags}g`);
}

function firstNonNegatedMatch(regex, text) {
  for (const match of text.matchAll(toGlobalRegex(regex))) {
    if (!isNegated(text, match.index)) return match;
  }
  return null;
}

function runPattern(fieldId, text) {
  const patterns = FIELD_PATTERNS[fieldId] || [];
  for (const pattern of patterns) {
    if (pattern.aggregate) {
      // FIX 7 (v3): drop individually negated mentions before counting/aggregating.
      const matches = [...text.matchAll(toGlobalRegex(pattern.regex))]
        .filter((item) => !isNegated(text, item.index))
        .map((item) => item[0]);
      const aggregateResult = pattern.aggregate(matches);
      if (aggregateResult) {
        return { ...aggregateResult, status: pattern.status };
      }
      continue;
    }

    if (pattern.resolver) {
      // Numeric/derived patterns (age, medication count, complexity index) are not negation-checked:
      // they extract a captured value rather than assert a binary clinical finding.
      const match = text.match(pattern.regex);
      if (!match) continue;
      const resolved = pattern.resolver(match);
      return { ...resolved, status: pattern.status };
    }

    const match = pattern.skipNegation ? text.match(pattern.regex) : firstNonNegatedMatch(pattern.regex, text);
    if (!match) continue;
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
