import axios from 'axios';

const MCP_SERVER = process.env.NEXT_PUBLIC_MCP_SERVER || 'http://localhost:8000';

export interface MappingCandidate {
  code: string;
  reason: string;
  matched_keywords?: string[];
  score?: number;
}

export interface MappingResult {
  candidates: MappingCandidate[];
  coverage_comment: string;
  confidence: number;
}

export interface ValidationIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  detail: string;
  suggestion: string;
}

export interface ChecklistItem {
  code: string;
  title: string;
  status: 'pass' | 'partial' | 'fail';
  issues: ValidationIssue[];
}

export interface SentenceSuggestion {
  sentence_index: number;
  sentence_text: string;
  ifrs_codes: string[];
  overall_status: 'pass' | 'partial' | 'fail';
  issues: ValidationIssue[];
}

export interface DemoAnalysisResponse {
  pdf_text: string;
  pdf_meta: { filename: string; page_index: number };
  checklist: ChecklistItem[];
  sentence_suggestions: SentenceSuggestion[];
}

export interface ElementCheckResult {
  key: string;
  label: string;
  present: boolean;
  reason: string;
}

export interface EnhanceParagraphRequest {
  paragraph: string;
  ifrs_code: string;
  industry?: string;
  user_message?: string;
}

export interface EnhanceParagraphResponse {
  ifrs_code: string;
  ifrs_title: string;
  missing_elements: ElementCheckResult[];
  completed_paragraph: string;
}

export const mcpApi = {
  mapText: async (payload: {
    raw_text: string;
    industry: string;
    jurisdiction?: string;
    mode?: 'fast' | 'accurate' | 'auto';
  }): Promise<MappingResult> => {
    const res = await axios.post(`${MCP_SERVER}/api/map`, {
      ...payload,
      jurisdiction: payload.jurisdiction || 'IFRS',
      mode: payload.mode || 'auto',
    });
    return res.data;
  },
  analyzeText: async (text: string): Promise<DemoAnalysisResponse> => {
    const res = await axios.post(`${MCP_SERVER}/api/demo/analyze-text`, {
      raw_text: text,
      industry: 'IT서비스',
      jurisdiction: 'IFRS',
    });
    return res.data;
  },
  enhanceParagraph: async (payload: {
    paragraph: string;
    ifrs_code: string;
    industry?: string;
    user_message?: string;
  }): Promise<EnhanceParagraphResponse> => {
    const res = await axios.post(`${MCP_SERVER}/api/enhance-paragraph`, {
      paragraph: payload.paragraph,
      ifrs_code: payload.ifrs_code,
      industry: payload.industry || 'IT서비스',
      user_message: payload.user_message || null,
    });
    return res.data;
  },
};

