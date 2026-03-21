export const APP_VERSION = 'CMO-VIH Pro v2 — March 2026';
export const STORAGE_KEY = 'cmo-vih-pro-v2-state';

export const FIELD_DEFINITIONS = [
  {
    id: 'pregnancy',
    section: 'demographic',
    weightMap: { no: 0, yes: 0 },
    automaticPriority: { yes: 1 },
    optionKeys: ['no', 'yes'],
    optionLabelKeys: {
      no: 'options.no',
      yes: 'options.pregnancyYes'
    },
    labelKey: 'fields.pregnancy',
    missingHintKey: 'missing.pregnancy'
  },
  {
    id: 'ageBand',
    section: 'demographic',
    weightMap: { under50: 0, over50: 1, over65: 3 },
    optionKeys: ['under50', 'over50', 'over65'],
    optionLabelKeys: {
      under50: 'options.ageUnder50',
      over50: 'options.ageOver50',
      over65: 'options.ageOver65'
    },
    labelKey: 'fields.ageBand',
    missingHintKey: 'missing.ageBand'
  },
  {
    id: 'comorbidities',
    section: 'clinical',
    weightMap: { low: 0, high: 2 },
    optionKeys: ['low', 'high'],
    optionLabelKeys: {
      low: 'options.comorbLow',
      high: 'options.comorbHigh'
    },
    labelKey: 'fields.comorbidities',
    missingHintKey: 'missing.comorbidities'
  },
  {
    id: 'polypharmacy',
    section: 'pharmacotherapy',
    weightMap: { low: 0, high: 3 },
    optionKeys: ['low', 'high'],
    optionLabelKeys: {
      low: 'options.polyLow',
      high: 'options.polyHigh'
    },
    labelKey: 'fields.polypharmacy',
    missingHintKey: 'missing.polypharmacy'
  },
  {
    id: 'complexity',
    section: 'pharmacotherapy',
    weightMap: { low: 0, high: 3 },
    optionKeys: ['low', 'high'],
    optionLabelKeys: {
      low: 'options.complexityLow',
      high: 'options.complexityHigh'
    },
    labelKey: 'fields.complexity',
    missingHintKey: 'missing.complexity'
  },
  {
    id: 'adherenceArt',
    section: 'pharmacotherapy',
    weightMap: { good: 0, suboptimal: 3 },
    optionKeys: ['good', 'suboptimal'],
    optionLabelKeys: {
      good: 'options.adherenceGood',
      suboptimal: 'options.adherenceSuboptimal'
    },
    labelKey: 'fields.adherenceArt',
    missingHintKey: 'missing.adherenceArt'
  },
  {
    id: 'adherenceConcomitant',
    section: 'pharmacotherapy',
    weightMap: { good: 0, suboptimal: 2 },
    optionKeys: ['good', 'suboptimal'],
    optionLabelKeys: {
      good: 'options.adherenceGood',
      suboptimal: 'options.adherenceSuboptimal'
    },
    labelKey: 'fields.adherenceConcomitant',
    missingHintKey: 'missing.adherenceConcomitant'
  },
  {
    id: 'hospitalization',
    section: 'healthCare',
    weightMap: { none: 0, recent: 2 },
    optionKeys: ['none', 'recent'],
    optionLabelKeys: {
      none: 'options.hospitalNone',
      recent: 'options.hospitalRecent'
    },
    labelKey: 'fields.hospitalization',
    missingHintKey: 'missing.hospitalization'
  },
  {
    id: 'qualityOfLife',
    section: 'psychosocial',
    weightMap: { normal: 0, affected: 1 },
    optionKeys: ['normal', 'affected'],
    optionLabelKeys: {
      normal: 'options.qualityNormal',
      affected: 'options.qualityAffected'
    },
    labelKey: 'fields.qualityOfLife',
    missingHintKey: 'missing.qualityOfLife'
  },
  {
    id: 'depression',
    section: 'psychosocial',
    weightMap: { no: 0, yes: 2 },
    optionKeys: ['no', 'yes'],
    optionLabelKeys: {
      no: 'options.no',
      yes: 'options.yes'
    },
    labelKey: 'fields.depression',
    missingHintKey: 'missing.depression'
  },
  {
    id: 'substanceUse',
    section: 'psychosocial',
    weightMap: { no: 0, yes: 2 },
    optionKeys: ['no', 'yes'],
    optionLabelKeys: {
      no: 'options.no',
      yes: 'options.substanceYes'
    },
    labelKey: 'fields.substanceUse',
    missingHintKey: 'missing.substanceUse'
  },
  {
    id: 'neurocognitive',
    section: 'neurocognitive',
    weightMap: { no: 0, yes: 2 },
    optionKeys: ['no', 'yes'],
    optionLabelKeys: {
      no: 'options.no',
      yes: 'options.yes'
    },
    labelKey: 'fields.neurocognitive',
    missingHintKey: 'missing.neurocognitive'
  },
  {
    id: 'frailty',
    section: 'frailty',
    weightMap: { no: 0, yes: 2 },
    optionKeys: ['no', 'yes'],
    optionLabelKeys: {
      no: 'options.no',
      yes: 'options.yes'
    },
    labelKey: 'fields.frailty',
    missingHintKey: 'missing.frailty'
  },
  {
    id: 'socioeconomic',
    section: 'socioeconomic',
    weightMap: { stable: 0, vulnerable: 2 },
    optionKeys: ['stable', 'vulnerable'],
    optionLabelKeys: {
      stable: 'options.socioStable',
      vulnerable: 'options.socioVulnerable'
    },
    labelKey: 'fields.socioeconomic',
    missingHintKey: 'missing.socioeconomic'
  },
  {
    id: 'viralLoad',
    section: 'healthResults',
    weightMap: { undetectable: 0, detectable: 4 },
    optionKeys: ['undetectable', 'detectable'],
    optionLabelKeys: {
      undetectable: 'options.viralUndetectable',
      detectable: 'options.viralDetectable'
    },
    labelKey: 'fields.viralLoad',
    missingHintKey: 'missing.viralLoad'
  },
  {
    id: 'comorbidityGoals',
    section: 'healthResults',
    weightMap: { achieved: 0, notAchieved: 2 },
    optionKeys: ['achieved', 'notAchieved'],
    optionLabelKeys: {
      achieved: 'options.goalsAchieved',
      notAchieved: 'options.goalsNotAchieved'
    },
    labelKey: 'fields.comorbidityGoals',
    missingHintKey: 'missing.comorbidityGoals'
  }
];

export const SECTION_ORDER = [
  'demographic',
  'clinical',
  'pharmacotherapy',
  'healthCare',
  'psychosocial',
  'neurocognitive',
  'frailty',
  'socioeconomic',
  'healthResults'
];

export const SECTION_LABEL_KEYS = {
  demographic: 'sections.demographic',
  clinical: 'sections.clinical',
  pharmacotherapy: 'sections.pharmacotherapy',
  healthCare: 'sections.healthCare',
  psychosocial: 'sections.psychosocial',
  neurocognitive: 'sections.neurocognitive',
  frailty: 'sections.frailty',
  socioeconomic: 'sections.socioeconomic',
  healthResults: 'sections.healthResults'
};

export const PRIORITY_CONFIG = {
  automatic: { labelKey: 'priority.priority1Auto', followUpKey: 'followup.priority1' },
  1: { labelKey: 'priority.priority1', followUpKey: 'followup.priority1' },
  2: { labelKey: 'priority.priority2', followUpKey: 'followup.priority2' },
  3: { labelKey: 'priority.priority3', followUpKey: 'followup.priority3' }
};

export const INTERVENTION_KEYS = {
  1: ['interventions.priority1.0', 'interventions.priority1.1', 'interventions.priority1.2', 'interventions.priority1.3'],
  2: ['interventions.priority2.0', 'interventions.priority2.1', 'interventions.priority2.2', 'interventions.priority2.3'],
  3: ['interventions.priority3.0', 'interventions.priority3.1', 'interventions.priority3.2']
};

export const RISK_FLAG_RULES = [
  { fieldId: 'pregnancy', value: 'yes', labelKey: 'riskFlags.pregnancy' },
  { fieldId: 'viralLoad', value: 'detectable', labelKey: 'riskFlags.viralLoad' },
  { fieldId: 'adherenceArt', value: 'suboptimal', labelKey: 'riskFlags.artAdherence' },
  { fieldId: 'hospitalization', value: 'recent', labelKey: 'riskFlags.hospitalization' },
  { fieldId: 'frailty', value: 'yes', labelKey: 'riskFlags.frailty' },
  { fieldId: 'neurocognitive', value: 'yes', labelKey: 'riskFlags.neurocognitive' }
];

export const EXAMPLE_CASE = {
  narrative: `52-year-old man living with HIV for 15 years. Currently on bictegravir/tenofovir alafenamide/emtricitabine once daily. Comorbidities include type 2 diabetes, hypertension, and dyslipidemia. He takes 8 total medications daily and reports occasional ART missed doses 2 to 3 times per month. Medication complexity index 13.2. Lives alone, has depressive symptoms, prior alcohol misuse, mild neurocognitive impairment, frailty, and one hospitalization in the past 6 months due to diabetes decompensation. Viral load is undetectable, but comorbidity goals remain unmet with HbA1c 8.2% and blood pressure 145/90 mmHg.`
};
