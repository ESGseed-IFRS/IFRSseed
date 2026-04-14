/**
 * 정성 데이터 출처 참조 인라인 표시 유틸
 * 
 * generated_text에서 used_in_sentences 매칭을 통해 각주 번호를 삽입합니다.
 */

export type CitationSource = {
  id: number;
  sentence: string;
  sourceType: string;
  sourceDetails: Record<string, unknown>;
};

/**
 * 문장 단위로 분리 (마침표 기준)
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 두 문장이 유사한지 확인 (공백·구두점 무시)
 */
function isSimilarSentence(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .replace(/[^\w\uac00-\ud7a3\u3131-\u318e]/g, '')
      .toLowerCase();
  return normalize(a) === normalize(b);
}

/**
 * 출처별 문장 → 각주 번호 매핑 생성
 */
export function buildCitationMap(
  quantitative: Array<{ used_in_sentences?: string[] }>,
  qualitative: Array<{ used_in_sentences?: string[]; source_type?: string; source_details?: Record<string, unknown> }>
): Map<string, CitationSource[]> {
  const map = new Map<string, CitationSource[]>();
  let citationId = 1;

  // 정량 데이터
  quantitative.forEach((item) => {
    item.used_in_sentences?.forEach((sentence) => {
      const normalized = sentence.trim();
      if (!map.has(normalized)) {
        map.set(normalized, []);
      }
      map.get(normalized)!.push({
        id: citationId++,
        sentence: normalized,
        sourceType: '📊 정량',
        sourceDetails: {},
      });
    });
  });

  // 정성 데이터
  qualitative.forEach((item) => {
    item.used_in_sentences?.forEach((sentence) => {
      const normalized = sentence.trim();
      if (!map.has(normalized)) {
        map.set(normalized, []);
      }
      map.get(normalized)!.push({
        id: citationId++,
        sentence: normalized,
        sourceType: item.source_type || '정성',
        sourceDetails: item.source_details || {},
      });
    });
  });

  return map;
}

/**
 * generated_text에 각주 번호 삽입
 * 
 * @returns [텍스트 with [1][2] 형태 각주, 전체 출처 목록]
 */
export function insertCitations(
  generatedText: string,
  citationMap: Map<string, CitationSource[]>
): [string, CitationSource[]] {
  const sentences = splitIntoSentences(generatedText);
  const allCitations: CitationSource[] = [];
  const annotatedSentences: string[] = [];

  sentences.forEach((sentence) => {
    let annotated = sentence;
    let citations: CitationSource[] = [];

    // 정확 매칭
    if (citationMap.has(sentence)) {
      citations = citationMap.get(sentence)!;
    } else {
      // 유사 매칭 (공백·구두점 차이 허용)
      for (const [key, sources] of citationMap.entries()) {
        if (isSimilarSentence(sentence, key)) {
          citations = sources;
          break;
        }
      }
    }

    if (citations.length > 0) {
      const refs = citations.map((c) => `[${c.id}]`).join('');
      annotated = `${sentence}${refs}`;
      allCitations.push(...citations);
    }

    annotatedSentences.push(annotated);
  });

  const textWithCitations = annotatedSentences.join(' ');
  
  // 중복 제거 (id 기준)
  const uniqueCitations = Array.from(
    new Map(allCitations.map((c) => [c.id, c])).values()
  ).sort((a, b) => a.id - b.id);

  return [textWithCitations, uniqueCitations];
}
