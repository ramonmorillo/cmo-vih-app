/* ============================================================
   Extraction status model
   ------------------------------------------------------------
   Every field resolves to one of:
     - PRESENT (status 'extracted' | 'inferred'): the concept is asserted
       in the text; `value` holds the model's option value.
     - ABSENT  (status 'absent'): the text explicitly denies/rules out the
       concept (or states the safe alternative, e.g. explicit male sex for
       pregnancy). `value` holds the model's *safe* option value — this is
       real, high-confidence clinical information, not a guess.
     - REVIEW  (status 'review', needsReview: true): a plausible but
       non-definitive signal (soft narrative cue, a historical/past-tense
       mention of a "current status" concept, or two contradictory
       mentions of the same concept). `value` is intentionally left empty
       so it is never silently scored; `suggestedValue` carries the
       tentative reading for the clinician to confirm.
     - UNKNOWN (no entry in `updates`, field stays unset): the concept is
       simply never mentioned. This is NEVER treated as a negative/ABSENT
       finding — that equivalence is exactly what this module must avoid.
   ============================================================ */

const FIELD_PATTERNS = {
  pregnancy: [
    { regex: /pregnan|embaraz/i, value: 'yes', status: 'extracted', negatedValue: 'no' },
    // No pregnancy-related term at all, but an explicit male-sex statement:
    // pregnancy is absent by definition, not merely undocumented.
    {
      regex: /\b(var[oó]n|hombre|male\s+patient|paciente\s+masculino|sexo\s+masculino)\b/i,
      value: 'no',
      presence: 'absent',
      evidence: null
    }
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
      // added: dislipidemia (distinct standard spelling from dislipemia), esteatosis hepática / hígado graso.
      regex: /(diabetes|hypertension|dyslipidemia|dislipidemia|cardiovascular|renal|liver|hepatitis|hepatopat[ií]a|esteatosis\s+hep[aá]tica|h[ií]gado\s+graso|hipertensi[oó]n|dislipemia|insuficiencia\s+renal|obesidad|EPOC)/gi,
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
    },
    {
      // Real notes usually list concurrent medications under a heading rather than stating a
      // total count. Count bullet/numbered lines under such a heading as a fallback signal.
      regex: /(?:Tratamiento\s+habitual|Medicaci[oó]n\s+(?:actual|habitual|concomitante)|Current\s+medications?)\s*:?[ \t]*\n([\s\S]*?)(?:\n[ \t]*\n|$)/i,
      resolver: (match) => {
        const lines = match[1]
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => /^(?:[-•*]|\d+[.)])\s*\S/.test(line));
        if (!lines.length) return null;
        const evidence = `${lines.length} · ${lines.slice(0, 3).join('; ')}${lines.length > 3 ? '…' : ''}`;
        return lines.length >= 6 ? { value: 'high', evidence } : { value: 'low', evidence };
      },
      status: 'inferred'
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
    { regex: /(missed doses|suboptimal ART adherence|olvidos.*TAR|poor adherence|olvida\s+tomas|no\s+toma\s+correctamente|mal\s+cumplimiento|incumplimiento\s+TAR|adherencia\s+sub[oó]ptima)/i, value: 'suboptimal', status: 'inferred', evidence: null, negatedValue: 'good' },
    {
      // Narrative admission of missed ART doses not covered by a fixed phrase above (e.g. "omitió
      // dos dosis del tratamiento antirretroviral"), anchored to an ART/TAR mention nearby so it
      // doesn't fire on missed doses of an unrelated concomitant drug.
      regex: /(?:(?:\bTAR\b|tratamiento\s+antirretroviral|antirretroviral|\bART\b)[^.;\n]{0,60}(?:omit(?:e|i[oó]|ido)|olvid\w*)\s+(?:\w+\s+){0,3}dosis|(?:omit(?:e|i[oó]|ido)|olvid\w*)\s+(?:\w+\s+){0,3}dosis[^.;\n]{0,60}(?:\bTAR\b|tratamiento\s+antirretroviral|antirretroviral|\bART\b))/i,
      value: 'suboptimal',
      status: 'extracted',
      evidence: null
    }
  ],
  adherenceConcomitant: [
    // FIX 6: added Spanish variants for concomitant adherence issues
    { regex: /(concomitant adherence issue|difficulty taking other medication|medicaci[oó]n concomitante.*adherencia|adherencia.*medicaci[oó]n concomitante)/i, value: 'suboptimal', status: 'inferred', evidence: null, negatedValue: 'good' }
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
    { regex: /(6\s*months?|6\s*meses|recent|reciente).{0,40}(hospitali[zs]ation|hospitalización|hospitalizado|admission|ingreso)/i, value: 'recent', status: 'extracted', evidence: null },
    // Explicit denial of any recent admission — a real ABSENT finding, distinct from simply not
    // mentioning hospitalization at all.
    {
      regex: /(no\s+(?:ha\s+(?:tenido|presentado)\s+)?ingresos?\s+hospitalarios?|sin\s+hospitalizaciones?|no\s+hospitalizations?|denies?\s+hospitalization)/i,
      value: 'none',
      presence: 'absent',
      evidence: null
    }
  ],
  qualityOfLife: [
    { regex: /(fatigue|quality of life affected|calidad de vida afectada|functional limitation)/i, value: 'affected', status: 'inferred', evidence: null, negatedValue: 'normal' },
    {
      // Softer mood/energy narrative cues without a formal instrument on file (no PHQ-9/EQ-5D):
      // relevant, but not confident enough to auto-classify — surfaced for clinician review.
      regex: /(cansancio\s+frecuente|fatiga\s+frecuente|poca\s+motivaci[oó]n|dificultad\s+para\s+dormir|insomnio|algo\s+desanimado|bajo\s+de\s+[aá]nimo|desmotivad[oa])/i,
      value: 'affected',
      presence: 'review',
      evidence: null
    }
  ],
  depression: [
    // checkTemporality: a past/resolved episode ("hace 4 años", "antecedente de") must not be
    // silently read as CURRENT depression — it is flagged for review instead.
    { regex: /(depressive symptoms|depression|depresi)/i, value: 'yes', status: 'extracted', evidence: null, negatedValue: 'no', checkTemporality: true }
  ],
  substanceUse: [
    { regex: /(alcohol\s+misuse|substance\s+use|abuso\s+de\s+sustancias|drug\s+use|\bcannabis\b|\bmarihuana\b|\bcoca[ií]na\b|\bhero[ií]na\b)/i, value: 'yes', status: 'extracted', evidence: null, negatedValue: 'no' }
  ],
  neurocognitive: [
    { regex: /(neurocognitive|cognitive impairment|deterioro cognitivo)/i, value: 'yes', status: 'extracted', evidence: null, negatedValue: 'no' }
  ],
  frailty: [
    { regex: /(frailty|frágil|fragilidad)/i, value: 'yes', status: 'extracted', evidence: null, negatedValue: 'no' }
  ],
  socioeconomic: [
    { regex: /(lives\s+alone|homeless|housing\s+insecurity|vive\s+solo|social\s+isolation|pension|preocupaci[oó]n\s+econ[oó]mica|dificultades?\s+econ[oó]micas?|situaci[oó]n\s+econ[oó]mica\s+(?:precaria|dif[ií]cil)|financial\s+(?:hardship|insecurity))/i, value: 'vulnerable', status: 'inferred', evidence: null, negatedValue: 'stable' }
  ],
  viralLoad: [
    // "<20 copias/mL" style reporting: below the assay's quantification limit is, by definition,
    // undetectable. No clinical threshold is invented here — the "<" symbol already means that.
    {
      regex: /(?:viral\s+load|carga\s+viral|RNA\s+VIH|RNA\s+HIV)\D{0,15}<\s*(\d{1,4})\s*(?:copias?|copies)?/i,
      resolver: (match) => ({ value: 'undetectable', evidence: match[0].trim() }),
      status: 'extracted'
    },
    // A plain quantified count (no "<") is by definition detectable.
    {
      regex: /(?:viral\s+load|carga\s+viral|RNA\s+VIH|RNA\s+HIV)\D{0,15}(\d{2,7})\s*(?:copias?|copies)\b/i,
      resolver: (match) => ({ value: 'detectable', evidence: match[0].trim() }),
      status: 'extracted'
    },
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

// Marks a mention as historical/resolved rather than current (e.g. "episodio depresivo hace 4
// años"). Scoped to the same clause as the match, on either side of it, since the marker can
// precede ("previamente...") or trail ("...hace 4 años") the concept it qualifies.
const HISTORICAL_TRIGGERS = /\b(hace\s+\d+\s+(?:a[ñn]os?|meses)|\d+\s+years?\s+ago|antecedente(?:s)?\s+de|history\s+of|previo(?:s)?\s+a|sin\s+seguimiento\s+actual|resuelt[oa])\b/i;

function clauseBefore(text, matchIndex) {
  const preceding = text.slice(0, matchIndex);
  const clauseStart = Math.max(
    preceding.lastIndexOf('.'),
    preceding.lastIndexOf(';'),
    preceding.lastIndexOf('\n')
  );
  return text.slice(clauseStart + 1, matchIndex);
}

function clauseAround(text, matchIndex, matchLength) {
  const before = text.slice(0, matchIndex);
  const after = text.slice(matchIndex + matchLength);
  const startBoundary = Math.max(before.lastIndexOf('.'), before.lastIndexOf(';'), before.lastIndexOf('\n'));
  const endOffsets = ['.', ';', '\n'].map((marker) => after.indexOf(marker)).filter((index) => index !== -1);
  const endBoundary = endOffsets.length ? Math.min(...endOffsets) : after.length;
  return text.slice(startBoundary + 1, matchIndex + matchLength + endBoundary);
}

function isNegated(text, matchIndex) {
  if (typeof matchIndex !== 'number') return false;
  return NEGATION_TRIGGERS.test(clauseBefore(text, matchIndex));
}

function isHistorical(text, match) {
  return HISTORICAL_TRIGGERS.test(clauseAround(text, match.index, match[0].length));
}

// A mention of a concept immediately after "escala de"/"cuestionario de"/"scale for" etc. names
// an ASSESSMENT INSTRUMENT, not a finding about the patient (e.g. "no se ha realizado ... escala
// de depresión" is about whether a PHQ-9-style tool was used, not about the patient's mood). Such
// mentions must not resolve PRESENT, ABSENT, or REVIEW — the module must not invent a value from
// an instrument's name the way it must not invent one from an uncalculated score.
const INSTRUMENT_MENTION = /\b(escala|cuestionario|scale|questionnaire)\b/i;

function isInstrumentMention(text, matchIndex) {
  return INSTRUMENT_MENTION.test(text.slice(Math.max(0, matchIndex - 25), matchIndex));
}

function toGlobalRegex(regex) {
  return regex.global ? regex : new RegExp(regex.source, `${regex.flags}g`);
}

function evaluateAggregatePattern(pattern, text) {
  const matches = [...text.matchAll(toGlobalRegex(pattern.regex))]
    .filter((item) => !isNegated(text, item.index))
    .map((item) => item[0]);
  const aggregateResult = pattern.aggregate(matches);
  return aggregateResult ? { ...aggregateResult, status: pattern.status, needsReview: false } : null;
}

function evaluateResolverPattern(pattern, text) {
  const match = text.match(pattern.regex);
  if (!match) return null;
  const resolved = pattern.resolver(match);
  return resolved ? { ...resolved, status: pattern.status, needsReview: false } : null;
}

function evaluateSkipNegationPattern(pattern, text) {
  const match = text.match(pattern.regex);
  if (!match) return null;
  return { value: pattern.value, status: pattern.status, evidence: pattern.evidence || match[0], needsReview: false };
}

// `presence: 'absent'` (an explicit denial phrase, e.g. "no ingresos hospitalarios") or
// `presence: 'review'` (a soft, non-definitive cue) resolve directly from a single match —
// they don't go through the PRESENT/negation partitioning below.
function evaluatePresencePattern(pattern, text) {
  const match = text.match(pattern.regex);
  if (!match) return null;
  return {
    value: pattern.presence === 'review' ? '' : pattern.value,
    suggestedValue: pattern.presence === 'review' ? pattern.value : undefined,
    status: pattern.presence,
    evidence: pattern.evidence || match[0],
    needsReview: pattern.presence === 'review'
  };
}

function evaluateAssertionPattern(pattern, text) {
  const matches = [...text.matchAll(toGlobalRegex(pattern.regex))]
    .filter((match) => !isInstrumentMention(text, match.index));
  if (!matches.length) return null;

  const nonNegated = [];
  const negated = [];
  matches.forEach((match) => (isNegated(text, match.index) ? negated : nonNegated).push(match));

  if (nonNegated.length) {
    // The same literal concept explicitly negated elsewhere in the text is a genuine
    // contradiction; a *different* concept sharing this field's regex (e.g. "cannabis" present
    // while "cocaine" is denied under substanceUse) is not — that's just this field's normal
    // any-of-these-counts-as-yes semantics.
    const affirmedTexts = new Set(nonNegated.map((match) => match[0].toLowerCase()));
    const conflicting = negated.find((match) => affirmedTexts.has(match[0].toLowerCase()));
    if (conflicting) {
      return {
        value: '',
        suggestedValue: pattern.value,
        status: 'review',
        evidence: `${nonNegated[0][0]} / ${conflicting[0]}`,
        needsReview: true
      };
    }

    const match = nonNegated[0];
    if (pattern.checkTemporality && isHistorical(text, match)) {
      return {
        value: '',
        suggestedValue: pattern.value,
        status: 'review',
        evidence: pattern.evidence || match[0],
        needsReview: true
      };
    }

    return { value: pattern.value, status: pattern.status, evidence: pattern.evidence || match[0], needsReview: false };
  }

  if (pattern.negatedValue !== undefined) {
    return { value: pattern.negatedValue, status: 'absent', evidence: negated[0][0], needsReview: false };
  }

  return null;
}

function runPattern(fieldId, text) {
  const patterns = FIELD_PATTERNS[fieldId] || [];
  for (const pattern of patterns) {
    let result = null;
    if (pattern.aggregate) result = evaluateAggregatePattern(pattern, text);
    else if (pattern.resolver) result = evaluateResolverPattern(pattern, text);
    else if (pattern.skipNegation) result = evaluateSkipNegationPattern(pattern, text);
    else if (pattern.presence) result = evaluatePresencePattern(pattern, text);
    else result = evaluateAssertionPattern(pattern, text);
    if (result) return result;
  }
  return null;
}

export function extractFromNarrative(text, fields, translate) {
  const updates = {};
  const missing = [];
  const extractionSummary = [];
  const counts = { present: 0, absent: 0, review: 0, unknown: 0 };

  Object.keys(fields).forEach((fieldId) => {
    const result = runPattern(fieldId, text);
    if (!result) {
      missing.push(fieldId);
      counts.unknown += 1;
      return;
    }

    updates[fieldId] = {
      value: result.value,
      status: result.status,
      source: 'ai',
      evidence: result.evidence,
      needsReview: Boolean(result.needsReview),
      suggestedValue: result.suggestedValue ?? null,
      clinicianConfirmed: false
    };

    extractionSummary.push({ fieldId, value: result.value, status: result.status, evidence: result.evidence });

    if (result.status === 'absent') counts.absent += 1;
    else if (result.status === 'review') counts.review += 1;
    else counts.present += 1;
  });

  const explanationLines = [
    translate('ai.summaryPresent', { count: counts.present }),
    translate('ai.summaryAbsent', { count: counts.absent }),
    translate('ai.summaryUnknown', { count: counts.unknown })
  ];
  if (counts.review) {
    explanationLines.push(translate('ai.summaryReview', { count: counts.review }));
  }

  return {
    updates,
    extractionSummary,
    missing,
    counts,
    explanation: explanationLines.join('\n')
  };
}
