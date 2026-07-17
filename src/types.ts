export interface OptionScore {
  option: string;
  score: number;
}

export interface Criterion {
  name: string;
  description: string;
  scores: OptionScore[];
}

export interface OptionDetail {
  name: string;
  pros: string[];
  cons: string[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface OptionValue {
  option: string;
  value: string;
}

export interface ComparisonDimension {
  dimension: string;
  values: OptionValue[];
}

export interface DecisionAnalysis {
  id: string;
  question: string;
  options: string[];
  context?: string;
  verdict: string;
  verdictExplanation: string;
  criteria: Criterion[];
  optionDetails: OptionDetail[];
  comparisonDimensions: ComparisonDimension[];
  createdAt: string;
  weights?: { [criterionName: string]: number };
}
