/**
 * 데이터 출처 필드명 한글 레이블 매핑
 * 
 * 개발자용 영문 필드명을 일반 사용자가 읽기 편한 한글로 변환합니다.
 */

/** source_type 한글 변환 */
export function sourceTypeKo(sourceType: string | undefined): string {
  if (!sourceType) return '—';
  
  const map: Record<string, string> = {
    'subsidiary_data': '🏢 계열사 기여 데이터',
    'external_data': '🌐 외부 데이터',
    'feedback_correction': '✅ 피드백 보정',
    'category': '🔍 카테고리 매칭',
    'dp_related': '🔗 DP 연관',
    'vector_search': '🔎 벡터 검색',
    'manual_input': '✏️ 수동 입력',
    'erp_integration': '💼 ERP 연동',
    'sr_body': '📄 SR 본문',
    'governance': '⚖️ 거버넌스',
  };
  
  return map[sourceType] || sourceType;
}

/** source_details 필드명 한글 변환 */
export function sourceDetailFieldKo(fieldName: string): string {
  const map: Record<string, string> = {
    // subsidiary_data_contributions
    'subsidiary_name': '🏢 출처 법인/사업장',
    'facility_name': '🏭 시설명',
    'description': '📝 상세 설명',
    'category': '📂 카테고리',
    'report_year': '📅 보고 연도',
    'data_source': '📚 데이터 출처',
    'related_dp_ids': '🔗 연관 DP',
    'quantitative_data': '📊 정량 데이터',
    
    // external_company_data
    'title': '📰 제목',
    'body_excerpt': '📄 본문 발췌',
    'body_text': '📄 본문',
    'source_url': '🔗 출처 URL',
    'published_date': '📅 발행일',
    'content_type': '📑 콘텐츠 유형',
    'anchor_company_id': '🏢 앵커 회사',
    
    // feedback/correction
    'matched_via': '🔍 매칭 방식',
    'correction_type': '🔧 보정 유형',
    'feedback_id': '💬 피드백 ID',
    
    // sr_report_body
    'sr_year': '📅 SR 연도',
    'page_number': '📄 페이지',
    'chunk_text': '📄 본문 조각',
    'similarity': '📊 유사도',
    'reference_location_ko': '📍 참조 본문 위치 (문장·문자 구간)',
    'sr_reference_anchors': '📌 참조 본문 매칭 상세',
    'ref_sentence_index_1based': '🔢 참조 본문 문장 번호(페이지 내)',
    'ref_char_start': '⬅️ 본문 시작 문자 위치',
    'ref_char_end': '➡️ 본문 끝 문자 위치',
    'match_quality': '✔️ 매칭 방식',
    'ref_block': '📚 참조 연도 블록(ref_2024/ref_2023)',
    'ref_sentence_excerpt': '📄 참조 문장 발췌',
    'used_sentence_preview': '✍️ 인용한 생성 문장(일부)',
    
    // governance
    'meeting_date': '📅 회의 일자',
    'board_type': '👔 이사회 유형',
    'agenda': '📋 안건',
    
    // 공통
    'value': '📊 값',
    'unit': '📏 단위',
    'year': '📅 연도',
    'methodology': '🔬 방법론',
    'created_at': '🕒 생성일',
    'updated_at': '🕒 수정일',
  };
  
  return map[fieldName] || fieldName;
}

/** matched_via 한글 변환 */
export function matchedViaKo(matchedVia: string | undefined): string {
  if (!matchedVia) return '—';
  
  const map: Record<string, string> = {
    'feedback_correction': '✅ 피드백 보정',
    'category_exact': '🎯 카테고리 정확 매칭',
    'category_vector': '🔎 카테고리 벡터 검색',
    'dp_related_intersection': '🔗 DP 교차 매칭',
    'year_only': '📅 연도별 검색',
    'fallback': '🔄 폴백 검색',
  };
  
  return map[matchedVia] || matchedVia;
}

/** 값 포맷팅 (숫자, 문자열, 배열 등) */
export function formatSourceValue(value: unknown): string {
  if (value == null) return '—';
  
  if (typeof value === 'number') {
    return value.toLocaleString('ko-KR');
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (value.length <= 3) return value.join(', ');
    return `${value.slice(0, 3).join(', ')} 외 ${value.length - 3}건`;
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  
  return String(value);
}
