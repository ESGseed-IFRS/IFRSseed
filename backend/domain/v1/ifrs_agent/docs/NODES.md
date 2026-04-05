# 오케스트레이터 및 노드별 상세 설계

## 📚 관련 문서

이 문서를 읽기 전/후에 다음 문서를 함께 참고하세요:
- [REVISED_WORKFLOW.md](./REVISED_WORKFLOW.md) - **노드별 LLM·임베딩(BGE-M3) 운영 기준** (§3.1–§3.1.1)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 시스템 아키텍처 및 워크플로우 이해
- [DATA_ONTOLOGY.md](./DATA_ONTOLOGY.md) - Data Point 구조 및 온톨로지 설계
- [DATA_COLLECTION.md](./DATA_COLLECTION.md) - 데이터 수집 및 파싱 방법
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - 구현 가이드 및 테스트

---

## 1. 구성 요소 개요

| 구성 요소 | 모델 | 학습 여부 | 주요 역할 |
|----------|------|----------|----------|
| **Supervisor** | Gemini 3.1 Pro | ❌ | 감사관 페르소나, 워크플로우 제어, 검증 및 감사 통합 |
| **RAG Node** | Gemini 2.5 Pro (Tool/함수 호출) | ❌ | 데이터 추출 및 검색 (Tool Calling) |
| **Gen Node** | GPT-5 mini | ❌ | IFRS 문체 문단 생성 (고빈도 호출·비용 최적화) |
| **Design Node** | Gemini 2.5 Pro | ❌ | 시각화 디자인 추천 (핵심 노드) |
| **Embedding Model** | BGE-M3 (현행 운영) | ✅ Contrastive | ESG 전문 검색, pgvector 1024차원 정합 |

### 1.1 모델 선택 전략

| 노드 | 권장 모델 | 대안 | 선택 기준 |
|------|----------|------|----------|
| **Supervisor** | Gemini 3.1 Pro | 동급 추론 모델 | 복잡한 의사결정, 감사 및 검증 통합 |
| **RAG Node** | Gemini 2.5 Pro | 동일 제품군 Tool 지원 모델 | Tool Calling·구조화 출력 |
| **Gen Node** | GPT-5 mini | 동급 소형 생성 모델 | 호출 빈도·비용·지연 |
| **Design Node** | Gemini 2.5 Pro | 멀티모달 Pro급 | 창의적 디자인 추천 |

**RAG Node 모델 선택 이유:**
- **Gemini 2.5 Pro**: 함수/도구 호출과 긴 컨텍스트 활용에 유리
- 검색 쿼리 최적화, DP 추출 시 구조화된 출력에 유리
- 상세 노드 분해·배치는 [REVISED_WORKFLOW.md §3.1](./REVISED_WORKFLOW.md#31-노드-구성-개요) (`c_rag`·`dp_rag`·`aggregation_node`와 동일 계열)

---

## 2. Supervisor (오케스트레이터)

### 2.1 개요

Supervisor는 **감사관(Auditor)** 페르소나로 동작하며, 전체 워크플로우를 중앙에서 제어합니다. **노드를 직접 호출하고 제어하는 진정한 오케스트레이터** 역할을 수행합니다.

**모델**: Gemini 3.1 Pro (Google AI API 등 배포 환경에 매핑)

**역할**:
- 사용자 요청 분석 및 필요 DP 식별
- **노드 직접 호출 및 제어** (핵심 기능)
  - `_call_rag_node()`: RAG Node 직접 호출
  - `_call_gen_node()`: Gen Node 직접 호출
  - `_call_design_node()`: Design Node 직접 호출
- **동적 워크플로우 결정** (LLM 기반)
  - `_decide_next_action()`: 현재 상태를 분석하여 다음 액션 결정
- 데이터 충분성 검토
- **검증 및 감사 통합** (하이브리드 접근)
  - 입력 데이터 검증
  - 생성 결과 검증
  - 그린워싱 탐지
  - IFRS 준수 검사
  - 최종 품질 감사 (Audit)

### 2.2 프롬프트 설계

```python
SUPERVISOR_SYSTEM_PROMPT = """
당신은 IFRS S1/S2 지속가능성 공시 전문 감사관입니다.

## 역할
1. 사용자의 보고서 작성 요청을 분석합니다.
2. 필요한 Data Point(DP)를 식별합니다.
3. 적절한 노드에 작업을 지시합니다.
4. 결과물의 IFRS 준수 여부를 검증합니다.

## 지표 메타화 규칙
- 모든 지표는 DP 단위로 분해합니다.
- 예: "임직원 수" → 남성/여성/장애인 비율로 세분화
- 중복 지표는 IFRS 기준으로 통합합니다.

## 검증 규칙
- 재무적 연결성(Financial Linkage)이 명시되어야 합니다.
- 정량 데이터는 출처와 기준연도가 있어야 합니다.
- 그린워싱 표현(과장, 모호한 약속)을 감지하면 경고합니다.

## 출력 형식
{
    "action": "instruct_node | review | approve | reject",
    "target_node": "rag | gen | validation",
    "instruction": "구체적인 지시사항",
    "required_dps": ["DP-001", "DP-002"],
    "validation_rules": ["rule1", "rule2"],
    "rationale": "결정 근거"
}
"""
```

### 2.2 노드 등록 및 MCP를 통한 호출

Supervisor는 **FastMCP**를 통해 노드를 호출합니다. 각 노드는 자신의 MCP 서버 기능을 포함하고 있어 독립 프로세스로 실행 가능합니다.

#### 2.2.1 노드 MCP 서버 등록

```python
# Supervisor 초기화 시 노드 MCP 서버 등록
def _init_node_servers(self):
    """노드 MCP 서버 등록 (노드 파일에 통합된 MCP 서버 사용)"""
    if not self.mcp_manager:
        return
    
    # RAG Node 서버 등록 (노드 파일에서 직접 실행)
    self.mcp_manager.register_client("rag_node", {
        "name": "rag_node_server",
        "command": "python",
        "args": ["-m", "ifrs_agent.agent.rag_node", "--mcp"],
        "env": {}
    })
    
    # Gen Node 서버 등록
    self.mcp_manager.register_client("gen_node", {
        "name": "gen_node_server",
        "command": "python",
        "args": ["-m", "ifrs_agent.agent.gen_node", "--mcp"],
        "env": {}
    })
    
    # Design Node 서버 등록
    self.mcp_manager.register_client("design_node", {
        "name": "design_node_server",
        "command": "python",
        "args": ["-m", "ifrs_agent.agent.design_node", "--mcp"],
        "env": {}
    })
```

#### 2.2.2 MCP를 통한 노드 호출

```python
# Supervisor 내부에서 MCP를 통해 노드 호출
async def orchestrate(self, state: IFRSAgentState) -> IFRSAgentState:
    # 1. 요청 분석
    state = await self.analyze(state)
    
    # 2. 반복 루프: 노드 선택 및 실행
    while True:
        decision = await self._decide_next_action(state)
        
        if decision["action"] == "call_rag_node":
            # MCP를 통해 RAG Node 호출
            state = await self._call_rag_node(state, decision)
        elif decision["action"] == "call_gen_node":
            # MCP를 통해 Gen Node 호출
            state = await self._call_gen_node(state, decision)
        elif decision["action"] == "call_design_node":
            # MCP를 통해 Design Node 호출
            state = await self._call_design_node(state, decision)
        elif decision["action"] == "complete":
            break
    
    # 3. 최종 검증 및 감사
    state = await self.validate_and_audit(state)
    return state

async def _call_rag_node(
    self,
    state: IFRSAgentState,
    decision: Dict[str, Any]
) -> IFRSAgentState:
    """RAG Node MCP 호출"""
    result = await self.mcp_manager.call_tool(
        server_name="rag_node",
        tool_name="process",
        params={
            "state": state,
            "instruction": decision.get("instruction", "")
        }
    )
    
    if result.get("success", False):
        state = result.get("state", state)
    else:
        state["errors"].append(result.get("error", "RAG Node 호출 실패"))
    
    return state
```

### 2.3 동적 워크플로우 결정

Supervisor는 LLM을 사용하여 현재 상태를 분석하고 다음 액션을 결정합니다:

```python
async def _decide_next_action(self, state: IFRSAgentState) -> Dict[str, Any]:
    """다음 액션 결정 (LLM 기반)"""
    prompt = f"""
    현재 상태를 분석하고 다음 액션을 결정하세요.
    
    - 필요한 DP: {len(required_dps)}개
    - 추출된 DP: {len(extracted_dps)}개
    - 누락된 DP: {len(missing_dps)}개
    - 생성된 섹션: {len(generated_sections)}개
    
    결정 옵션:
    1. call_rag_node: 데이터 추출 필요
    2. call_gen_node: 문단 생성 필요
    3. complete: 모든 작업 완료
    """
    
    response = await self.llm.ainvoke(messages)
    decision = self._parse_decision(response.content)
    return decision
```

### 2.4 의사결정 로직

```python
class SupervisorAgent:
    def __init__(self, llm_client: GroqClient):
        self.llm = llm_client
        self.rulebook = self._load_rulebook()
    
    def analyze_request(self, state: IFRSAgentState) -> SupervisorDecision:
        """사용자 요청 분석 및 필요 DP 식별"""
        prompt = self._build_analysis_prompt(state["query"], state["target_standards"])
        response = self.llm.generate(prompt)
        return self._parse_decision(response)
    
    def review_extraction(self, state: IFRSAgentState) -> SupervisorDecision:
        """RAG 추출 결과 검토"""
        required_dps = set(state["target_dps"])
        extracted_dps = set(fs["dp_id"] for fs in state["fact_sheets"])
        
        missing = required_dps - extracted_dps
        
        if missing:
            return SupervisorDecision(
                action="instruct_node",
                target_node="rag",
                instruction=f"다음 DP를 추가로 검색하세요: {list(missing)}",
                rationale=f"필수 DP 중 {len(missing)}개가 누락됨"
            )
        
        return SupervisorDecision(
            action="approve",
            target_node="gen",
            instruction="추출된 팩트 시트를 기반으로 문단을 생성하세요",
            rationale="모든 필수 DP가 추출됨"
        )
    
    def audit_generation(self, state: IFRSAgentState) -> SupervisorDecision:
        """생성 결과 최종 감사 (개선된 버전: 구체적 피드백 루프)"""
        validation_result = state["validation_results"][-1]
        generated_sections = state["generated_sections"]
        
        # 1. 그린워싱 체크
        if validation_result["greenwashing_risk"] > 0.7:
            return SupervisorDecision(
                action="reject",
                target_node="gen",
                instruction=self._build_greenwashing_feedback(
                    validation_result["greenwashing_issues"]
                ),
                rationale="그린워싱 위험 감지. 표현 수정 필요."
            )
        
        # 2. IFRS 준수 체크 (개선: 누락된 DP 식별)
        if validation_result["compliance_score"] < 0.8:
            # 누락된 DP 식별
            missing_dps = self._identify_missing_dps(
                generated_sections,
                state["target_dps"]
            )
            
            # 재무 연결성 부족 확인
            missing_financial_linkage = self._check_financial_linkage(
                generated_sections
            )
            
            # 구체적인 피드백 생성
            if missing_dps:
                return SupervisorDecision(
                    action="instruct_node",
                    target_node="rag",  # Gen이 아닌 RAG에 재요청
                    instruction=self._build_rag_feedback(
                        missing_dps,
                        missing_financial_linkage
                    ),
                    rationale=f"""
                    IFRS 준수 점수 미달: {validation_result['compliance_score']}
                    - 누락된 DP: {missing_dps}
                    - 재무 연결성 부족: {missing_financial_linkage}
                    → RAG Node에 누락된 DP 재검색 요청
                    """
                )
            else:
                return SupervisorDecision(
                    action="instruct_node",
                    target_node="gen",
                    instruction=self._build_gen_feedback(
                        validation_result["compliance_issues"]
                    ),
                    rationale="DP는 충분하나 문단 품질 개선 필요"
                )
        
        return SupervisorDecision(
            action="approve",
            rationale="모든 검증 통과"
        )
    
    def _build_rag_feedback(
        self,
        missing_dps: List[str],
        missing_financial_linkage: List[str]
    ) -> str:
        """RAG Node에 대한 구체적 피드백"""
        feedback = f"""
        다음 Data Point들이 누락되었거나 불충분합니다:
        
        ## 누락된 DP 목록
        {chr(10).join(f"- {dp_id}: {self._get_dp_description(dp_id)}" for dp_id in missing_dps)}
        
        ## 재무 연결성 부족 DP
        {chr(10).join(f"- {dp_id}: 재무제표 연결 정보 필요" for dp_id in missing_financial_linkage)}
        
        ## 검색 전략
        1. 벡터 DB에서 '{', '.join(missing_dps)}' 관련 문서 재검색
        2. DART 공시 데이터에서 해당 DP 값 확인
        3. 원천계(EMS/EHS)에서 직접 조회 (가능한 경우)
        4. 경쟁사 보고서에서 벤치마크 데이터 수집
        
        ## 출력 형식
        각 DP에 대해 다음 정보를 포함한 FactSheet 생성:
        - dp_id: {missing_dps[0] if missing_dps else 'N/A'}
        - values: {{2022: value, 2023: value, 2024: value}}
        - unit: 단위 명시
        - source: 출처 (DART/EMS/경쟁사 등)
        - financial_linkage: 재무 계정 연결 정보
        """
        return feedback
    
    def _build_gen_feedback(self, compliance_issues: List[str]) -> str:
        """Gen Node에 대한 구체적 피드백"""
        feedback = f"""
        생성된 문단의 IFRS 준수도를 개선해야 합니다.
        
        ## 발견된 문제점
        {chr(10).join(f"- {issue}" for issue in compliance_issues)}
        
        ## 개선 요구사항
        1. 재무적 연결성 명시: 각 ESG 지표가 재무제표의 어떤 항목과 연결되는지 구체적으로 기술
        2. 정량적 근거: 수치 데이터는 반드시 출처와 기준연도 포함
        3. 시계열 분석: 전년 대비 변화율과 추세 설명 추가
        4. IFRS 문체: 객관적이고 전문적인 어조 유지 (과장 표현 금지)
        
        ## 예시 개선 문장
        Before: "환경 성과가 개선되었습니다."
        After: "Scope 1 배출량은 2023년 대비 15% 감소한 12,345 tCO2e를 기록하였으며,
               이는 탄소배출권 구매 비용 절감(약 5억원)으로 재무제표의 '환경비용' 항목에 반영되었습니다."
        """
        return feedback
    
    def _build_greenwashing_feedback(self, issues: List[Dict]) -> str:
        """그린워싱 피드백"""
        return f"""
        다음 표현들이 그린워싱 위험이 있습니다:
        {chr(10).join(f"- '{issue['text']}': {issue['description']}" for issue in issues)}
        
        수정 요청: 구체적 수치와 인증 기준을 포함하여 객관적으로 기술하세요.
        """
    
    def _identify_missing_dps(
        self,
        generated_sections: List[Dict],
        target_dps: List[str]
    ) -> List[str]:
        """생성된 섹션에서 누락된 DP 식별"""
        referenced_dps = set()
        for section in generated_sections:
            referenced_dps.update(section.get("referenced_dps", []))
        
        return list(set(target_dps) - referenced_dps)
    
    def _check_financial_linkage(
        self,
        generated_sections: List[Dict]
    ) -> List[str]:
        """재무 연결성 부족 섹션 식별"""
        missing = []
        for section in generated_sections:
            if not section.get("financial_linkage") or len(section["financial_linkage"]) < 50:
                missing.append(section["section_id"])
        return missing
    
    def _get_dp_description(self, dp_id: str) -> str:
        """DP 설명 조회 (온톨로지에서)"""
        # 실제 구현에서는 온톨로지 저장소에서 조회
        return f"Data Point {dp_id}"
```

### 2.4 Rulebook 주입

```python
IFRS_RULEBOOK = {
    "S1": {
        "governance": {
            "required_dps": ["S1-GOV-1", "S1-GOV-2", "S1-GOV-3"],
            "validation_rules": [
                "이사회 역할 명시 필수",
                "경영진 책임 범위 정의 필수",
                "보고 주기 명시 필수"
            ]
        },
        "strategy": {
            "required_dps": ["S1-STR-1", "S1-STR-2"],
            "validation_rules": [
                "단기/중기/장기 구분 필수",
                "재무적 영향 정량화 권장"
            ]
        }
    },
    "S2": {
        "climate_risks": {
            "required_dps": ["S2-15-a", "S2-15-b", "S2-15-c"],
            "validation_rules": [
                "물리적/전환 리스크 구분 필수",
                "시나리오 분석 포함 필수",
                "재무제표 연결 명시 필수"
            ]
        }
    }
}
```

---

## 3. RAG Node (검색 및 추출)

### 3.1 개요

RAG Node는 **데이터 추출가** 페르소나로 동작하며, **구조화된 데이터와 비구조화된 데이터를 모두 수집**하여 DP 단위로 구조화합니다.

**모델**: **Gemini 2.5 Pro** (Tool/함수 호출) — [REVISED_WORKFLOW.md](./REVISED_WORKFLOW.md)의 `c_rag`·`dp_rag`·`aggregation_node`와 동일 계열

**역할**:
- **구조화된 데이터 수집**: DB에서 직접 조회 (ghg_emission_results, environmental_data 등)
- **비구조화된 데이터 수집**: 벡터 검색으로 찾기 (전년도 SR 보고서, 기준서 요구사항 등)
- 쿼리 최적화 및 재구성 (Tool Calling 활용)
- 하이브리드 검색 (Dense + Sparse)
- **FastMCP 통합**: 자동 외부 데이터 수집 (웹 검색, DART API, 뉴스)
- PDF 목차 기반 정밀 파싱
- **멀티모달 처리**: 표·이미지 추출 및 캡셔닝
- 3개년 시계열 데이터 추출
- JSON 팩트 시트 생성 (구조화 + 비구조화 데이터 통합)

**데이터 수집 우선순위**:
1. **구조화된 데이터 (최우선)**: 내부 시스템 DB 직접 조회
   - `ghg_emission_results`: GHG 배출량
   - `environmental_data`: 환경 데이터
   - `social_data`: 사회 데이터
   - `governance_data`: 지배구조 데이터
   - `sr_report_unified_data`: 통합 데이터
2. **비구조화된 데이터 (보완)**: 벡터 검색
   - 전년도/전전년도 SR 보고서 문단
   - 기준서 요구사항 (IFRS S2, GRI 등)
   - 외부 공시 문서 (DART, 뉴스 등)

### 3.2 FastMCP 통합 (루즈 커플링)

RAG Node는 **FastMCP (Model Context Protocol)**를 사용하여 LLM이 자동으로 외부 데이터를 수집할 수 있도록 구현되었습니다. MCP Tool 서버는 독립 프로세스로 실행되어 루즈 커플링을 달성합니다.

#### 3.3.1 MCP Tool 서버 구조

| Tool 서버 | 도구 | 설명 | 용도 |
|----------|------|------|------|
| **DART Tool Server** | `get_sustainability_report` | 지속가능경영보고서 조회 | 기업 공시 데이터 자동 수집 |
| | `search_disclosure` | 공시 검색 | 특정 키워드 공시 검색 |
| **Web Search Tool Server** | `duckduckgo_search` | 무료 웹 검색 | IFRS S1/S2 관련 최신 정보 검색 |
| | `tavily_search` | 정확한 웹 검색 (API 키 필요) | 더 정확한 검색 결과 필요 시 |
| **News Tool Server** | `search_news` | 뉴스 기사 검색 | 기업 ESG 관련 최신 뉴스 |

#### 3.3.2 MCP Tool 서버 초기화

```python
class RAGNode:
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        # ... 기존 초기화 ...
        
        # FastMCP Client 초기화
        from ifrs_agent.service.mcp_client import MCPClientManager
        self.mcp_manager = MCPClientManager()
        self._init_mcp_servers()
        self._mcp_tools_bound = False
    
    def _init_mcp_servers(self):
        """MCP 서버 등록"""
        # DART API Tool Server
        self.mcp_manager.register_client("dart", {
            "name": "dart_tool_server",
            "command": "python",
            "args": ["-m", "tools.dart_server"],
            "env": {
                "DART_API_KEY": self.settings.dart_api_key or ""
            }
        })
        
        # Web Search Tool Server
        self.mcp_manager.register_client("web_search", {
            "name": "web_search_tool_server",
            "command": "python",
            "args": ["-m", "tools.web_search_server"],
            "env": {
                "TAVILY_API_KEY": self.settings.tavily_api_key or ""
            }
        })
        
        # News Search Tool Server
        self.mcp_manager.register_client("news", {
            "name": "news_tool_server",
            "command": "python",
            "args": ["-m", "tools.news_server"],
            "env": {}
        })
    
    async def _bind_mcp_tools(self):
        """MCP Tools를 LLM에 바인딩"""
        all_tools = []
        
        for server_name in ["dart", "web_search", "news"]:
            client = await self.mcp_manager.get_client(server_name)
            tools = await client.list_tools()
            langchain_tools = self._convert_mcp_to_langchain_tools(tools, server_name)
            all_tools.extend(langchain_tools)
        
        if all_tools and hasattr(self.llm, 'bind_tools'):
            self.llm = self.llm.bind_tools(all_tools)
            self._mcp_tools_bound = True
            logger.info(f"✅ MCP Tools 바인딩 완료: {len(all_tools)}개 도구")
    
    async def _collect_external_data_with_llm(
        self,
        company_id: str,
        fiscal_year: int,
        query: str,
        target_dps: List[str]
    ) -> List[Dict[str, Any]]:
        """LLM이 MCP Tools를 사용하여 외부 데이터 수집
        
        LLM이 자동으로 적절한 MCP 도구를 선택하여 외부 데이터를 수집합니다.
        """
        # MCP Tools 바인딩 확인
        if not self._mcp_tools_bound:
            await self._bind_mcp_tools()
        
        prompt = f"""
        다음 정보를 수집하기 위해 적절한 도구를 사용하세요:
        
        - 회사: {company_id}
        - 연도: {fiscal_year}
        - 쿼리: {query}
        - 대상 Data Points: {', '.join(target_dps[:5])}
        
        필요한 정보:
        1. {company_id}의 {fiscal_year}년 지속가능경영보고서 (get_sustainability_report 도구 사용)
        2. {company_id}의 ESG 관련 최신 뉴스 (search_news 도구 사용)
        3. IFRS S1/S2 관련 최신 정보 (duckduckgo_search 또는 tavily_search 도구 사용)
        
        각 도구를 사용하여 정보를 수집하세요.
        """
        
        # LLM 호출 (Tool Calling 자동 처리)
        response = await self.llm.ainvoke(messages)
        
        # Tool 호출 결과 처리
        collected_data = []
        tool_calls = getattr(response, 'tool_calls', []) or []
        
        for tool_call in tool_calls:
            tool_name = tool_call.get('name', '')
            tool_input = tool_call.get('args', {})
            
            # MCP Tool 실행
            server_name = self._get_server_for_tool(tool_name)
            result = await self.mcp_manager.call_tool(
                server_name,
                tool_name,
                tool_input
            )
            
            if result and not result.get("is_error", False):
                collected_data.append({
                    "content": result.get("content", ""),
                    "source": f"mcp-tool-{tool_name}",
                    "metadata": {
                        "tool": tool_name,
                        "company_id": company_id,
                        "fiscal_year": fiscal_year
                    }
                })
        
        return collected_data
```

#### 3.3.3 외부 데이터 수집 프로세스

```
사용자 쿼리
    ↓
RAG Node Process
    ↓
벡터 DB 검색 (기존)
    ↓
외부 데이터 필요?
    ↓
LLM이 자동으로 MCP Tools 선택:
  ├─> DART Tool Server (기업 공시)
  ├─> News Tool Server (최신 뉴스)
  └─> Web Search Tool Server (IFRS S1/S2 정보)
    ↓
MCP 프로토콜을 통한 Tool 호출
    ↓
수집된 데이터를 검색 결과에 추가
    ↓
DP 추출 및 팩트 시트 생성
```

#### 3.3.4 MCP Tool 서버 구현 예시

```python
# tools/dart_server.py
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("DART API Tool Server")

@mcp.tool()
async def get_sustainability_report(
    company_id: str,
    fiscal_year: int
) -> Dict[str, Any]:
    """지속가능경영보고서 조회"""
    # DART API 호출 로직
    # ...
    return {
        "company_id": company_id,
        "fiscal_year": fiscal_year,
        "reports": reports
    }

if __name__ == "__main__":
    mcp.run()
```

#### 3.3.5 환경 변수 설정

```bash
# Tavily API 키 (선택사항, 더 정확한 웹 검색)
TAVILY_API_KEY=your_api_key_here

# DART API 키 (필수, 기업 공시 데이터)
DART_API_KEY=your_dart_api_key
```

#### 3.3.6 FastMCP의 장점

1. **표준 프로토콜**: MCP 표준을 사용하여 다른 MCP 호환 도구와 연동 가능
2. **루즈 커플링**: Tool 서버가 독립 프로세스로 실행되어 노드와 분리
3. **확장성**: 새로운 Tool 서버 추가가 용이하고 다른 프로젝트에서 재사용 가능
4. **자동 Tool 선택**: LLM이 상황에 맞는 도구를 자동으로 선택
5. **폴백 메커니즘**: MCP Tools 사용 불가 시 기존 DART API 직접 호출
6. **로깅**: 도구 선택 및 실행 과정 추적 가능

### 3.4 검색 파이프라인

```python
class RAGNode:
    def __init__(
        self,
        llm_client: GroqClient,
        embedding_model: BGEEmbedding,
        vector_store: VectorStore,
        crawler: DataCrawler,
        table_extractor: TableExtractor = None,      # 멀티모달: 표 추출
        image_processor: ImageProcessor = None        # 멀티모달: 이미지 처리
    ):
        # Tool-Use 모델 사용
        self.llm = llm_client
        self.llm.model = "llama-3.1-70b-versatile"  # Tool-Use 지원
        self.llm.tools = [self._get_search_tool(), self._get_extract_tool()]
        
        self.embedder = embedding_model
        self.vector_store = vector_store
        self.crawler = crawler
        self.table_extractor = table_extractor
        self.image_processor = image_processor
    
    def _get_search_tool(self):
        """검색 도구 정의 (Tool Calling)"""
        return {
            "type": "function",
            "function": {
                "name": "hybrid_search",
                "description": "벡터 DB + BM25 하이브리드 검색",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"},
                        "top_k": {"type": "integer", "default": 10},
                        "filters": {"type": "object"}
                    }
                }
            }
        }
    
    def _get_extract_tool(self):
        """DP 추출 도구 정의"""
        return {
            "type": "function",
            "function": {
                "name": "extract_data_point",
                "description": "검색 결과에서 Data Point 값 추출",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "dp_id": {"type": "string"},
                        "source_text": {"type": "string"},
                        "years": {"type": "array", "items": {"type": "integer"}}
                    }
                }
            }
        }
    
    async def process(self, state: IFRSAgentState) -> IFRSAgentState:
        """RAG 처리 메인 로직 (구조화 + 비구조화 데이터 통합 수집)"""
        
        fact_sheets = []
        
        for dp_id in state.get("target_dps", []):
            fact_sheet = {
                "dp_id": dp_id,
                "dp_name": self._get_dp_name(dp_id),
                "structured_data": {},
                "unstructured_data": []
            }
            
            # 1. 구조화된 데이터: DB 직접 조회 (최우선)
            structured_data = await self._query_structured_db(
                dp_id,
                state["company_id"],
                state.get("fiscal_year")
            )
            fact_sheet["structured_data"] = structured_data
            # - ghg_emission_results
            # - environmental_data
            # - social_data
            # - governance_data
            # - sr_report_unified_data
            
            # 2. 비구조화된 데이터: 벡터 검색 (보완)
            unstructured_data = await self._search_unstructured(
                dp_id,
                state["company_id"],
                state.get("fiscal_year"),
                state.get("data_sources", {})
            )
            fact_sheet["unstructured_data"] = unstructured_data
            # - 전년도/전전년도 SR 보고서 문단
            # - 기준서 요구사항 (IFRS S2, GRI 등)
            # - 외부 공시 문서 (DART, 뉴스 등)
            
            fact_sheets.append(fact_sheet)
        
        # 3. 상태 업데이트
        state["fact_sheets"] = fact_sheets
        state["yearly_data"] = self._organize_by_year(fact_sheets)
        
        return state
    
    async def _query_structured_db(
        self,
        dp_id: str,
        company_id: str,
        fiscal_year: int
    ) -> Dict:
        """구조화된 데이터 DB 직접 조회"""
        # unified_column_mappings를 통해 DP → 통합 컬럼 매핑
        unified_column = await self._get_unified_column_by_dp(dp_id)
        
        if not unified_column:
            return {}
        
        # sr_report_unified_data 테이블에서 조회
        structured_data = await self.db.query(
            """
            SELECT 
                data_value,
                data_type,
                unit,
                data_source,
                confidence_score
            FROM sr_report_unified_data
            WHERE company_id = :company_id
              AND period_year = :fiscal_year
              AND unified_column_id = :unified_column_id
              AND included_in_final_report = TRUE
            ORDER BY confidence_score DESC
            LIMIT 1
            """,
            {
                "company_id": company_id,
                "fiscal_year": fiscal_year,
                "unified_column_id": unified_column["unified_column_id"]
            }
        )
        
        if structured_data:
            return {
                "value": structured_data[0]["data_value"],
                "unit": structured_data[0]["unit"],
                "data_source": structured_data[0]["data_source"],
                "confidence": structured_data[0]["confidence_score"]
            }
        
        return {}
    
    async def _search_unstructured(
        self,
        dp_id: str,
        company_id: str,
        fiscal_year: int,
        data_sources: Dict
    ) -> List[Dict]:
        """비구조화된 데이터 벡터 검색"""
        unstructured_results = []
        
        # 1. 전년도/전전년도 SR 보고서 검색
        if data_sources.get("historical_reports"):
            historical_data = await self._search_historical_reports(
                dp_id,
                company_id,
                data_sources["historical_reports"]
            )
            unstructured_results.extend(historical_data)
        
        # 2. 기준서 요구사항 검색
        if data_sources.get("target_standards"):
            standard_data = await self._search_standards(
                dp_id,
                data_sources["target_standards"]
            )
            unstructured_results.extend(standard_data)
        
        # 3. 외부 공시 문서 검색
        if data_sources.get("external_crawling"):
            external_data = await self._search_external_docs(
                dp_id,
                company_id,
                data_sources["external_crawling"]
            )
            unstructured_results.extend(external_data)
        
        return unstructured_results
    
    async def _search_historical_reports(
        self,
        dp_id: str,
        company_id: str,
        years: List[int]
    ) -> List[Dict]:
        """전년도 SR 보고서에서 유사 문단 검색"""
        # 벡터 DB에서 전년도 보고서 임베딩 검색
        query = f"{dp_id} {self._get_dp_name(dp_id)}"
        
        results = await self.vector_store.similarity_search(
            query=query,
            filter={
                "company_id": company_id,
                "report_year": {"$in": years},
                "source_type": "historical_report"
            },
            top_k=5
        )
        
        return [
            {
                "content": result["content"],
                "source_type": "historical_report",
                "report_year": result["metadata"]["report_year"],
                "section_title": result["metadata"]["section_title"],
                "similarity": result["score"]
            }
            for result in results
        ]
    
    async def _search_standards(
        self,
        dp_id: str,
        standards: List[str]
    ) -> List[Dict]:
        """기준서 요구사항 검색"""
        query = f"{dp_id} {self._get_dp_name(dp_id)}"
        
        results = await self.vector_store.similarity_search(
            query=query,
            filter={
                "source_type": "standard",
                "standard_id": {"$in": standards}
            },
            top_k=3
        )
        
        return [
            {
                "content": result["content"],
                "source_type": "standard",
                "standard_id": result["metadata"]["standard_id"],
                "section_name": result["metadata"]["section_name"],
                "similarity": result["score"]
            }
            for result in results
        ]
    
    async def _search_external_docs(
        self,
        dp_id: str,
        company_id: str,
        sources: List[str]
    ) -> List[Dict]:
        """외부 공시 문서 검색"""
        query = f"{dp_id} {self._get_dp_name(dp_id)}"
        
        results = await self.vector_store.similarity_search(
            query=query,
            filter={
                "company_id": company_id,
                "source_type": {"$in": sources}  # ["DART", "news", "competitor"]
            },
            top_k=3
        )
        
        return [
            {
                "content": result["content"],
                "source_type": result["metadata"]["source_type"],
                "source_url": result["metadata"].get("source_url"),
                "similarity": result["score"]
            }
            for result in results
        ]
    
    async def _extract_multimodal_content(
        self,
        pdf_paths: List[str],
        target_dps: List[str]
    ) -> List[Dict]:
        """표·이미지 포함 멀티모달 추출"""
        multimodal_results = []
        
        for pdf_path in pdf_paths:
            # 1. 텍스트 추출 (기존)
            text_content = await self._extract_text(pdf_path, target_dps)
            
            # 2. 표 추출 (LlamaParse Table Extraction)
            if self.table_extractor:
                tables = await self.table_extractor.extract_tables(
                    pdf_path,
                    instruction=f"Extract tables related to: {', '.join(target_dps)}"
                )
                for table in tables:
                    multimodal_results.append({
                        "type": "table",
                        "content": table,
                        "source": pdf_path
                    })
            
            # 3. 이미지 캡셔닝 (Donut 또는 GPT-4o-mini Vision)
            if self.image_processor:
                images = await self._extract_images(pdf_path, target_dps)
                image_captions = await self.image_processor.caption_images(images)
                for caption in image_captions:
                    multimodal_results.append({
                        "type": "image",
                        "content": caption,
                        "source": pdf_path
                    })
        
        return multimodal_results
```

### 3.4 하이브리드 검색

```python
class HybridSearchEngine:
    def __init__(self, embedder: BGEEmbedding, bm25_index: BM25Index):
        self.embedder = embedder
        self.bm25 = bm25_index
        self.alpha = 0.7  # Dense 가중치
    
    async def search(
        self,
        query: str,
        top_k: int = 10,
        filters: Dict = None
    ) -> List[SearchResult]:
        """Dense + Sparse 하이브리드 검색"""
        # Dense 검색 (임베딩 기반)
        query_embedding = self.embedder.encode(query)
        dense_results = await self.vector_store.similarity_search(
            query_embedding,
            top_k=top_k * 2,
            filters=filters
        )
        
        # Sparse 검색 (BM25)
        sparse_results = self.bm25.search(query, top_k=top_k * 2)
        
        # 점수 융합 (Reciprocal Rank Fusion)
        fused_results = self._rrf_fusion(dense_results, sparse_results)
        
        return fused_results[:top_k]
    
    def _rrf_fusion(
        self,
        dense: List[SearchResult],
        sparse: List[SearchResult],
        k: int = 60
    ) -> List[SearchResult]:
        """Reciprocal Rank Fusion"""
        scores = {}
        
        for rank, result in enumerate(dense):
            doc_id = result.doc_id
            scores[doc_id] = scores.get(doc_id, 0) + self.alpha / (k + rank + 1)
        
        for rank, result in enumerate(sparse):
            doc_id = result.doc_id
            scores[doc_id] = scores.get(doc_id, 0) + (1 - self.alpha) / (k + rank + 1)
        
        sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return [self._get_result(doc_id) for doc_id, _ in sorted_docs]
```

### 3.5 PDF 섹션 추출

```python
class PDFSectionExtractor:
    """목차 기반 PDF 섹션 추출"""
    
    def __init__(self, parser: LlamaParseClient):
        self.parser = parser
    
    async def extract_sections(
        self,
        pdf_path: str,
        target_sections: List[str]
    ) -> Dict[str, str]:
        """특정 섹션만 추출"""
        # 1. 목차 파싱
        toc = await self.parser.extract_toc(pdf_path)
        
        # 2. 대상 섹션 페이지 범위 식별
        page_ranges = self._find_page_ranges(toc, target_sections)
        
        # 3. 해당 페이지만 텍스트 추출
        sections = {}
        for section_name, (start, end) in page_ranges.items():
            text = await self.parser.extract_pages(pdf_path, start, end)
            sections[section_name] = text
        
        return sections
    
    async def extract_tables(self, pdf_path: str) -> List[Dict]:
        """표 데이터 추출 (마크다운 변환)"""
        tables = await self.parser.extract_tables(pdf_path)
        return [self._table_to_markdown(t) for t in tables]
```

### 3.6 크롤링 모듈 (기존 방식, 폴백용)

```python
class DataCrawler:
    """외부 데이터 크롤링"""
    
    def __init__(self):
        self.dart_client = DARTClient()
        self.media_crawler = MediaCrawler()
    
    async def crawl_dart(
        self,
        company_code: str,
        report_types: List[str],
        years: List[int]
    ) -> List[Document]:
        """DART 공시 데이터 크롤링"""
        documents = []
        
        for year in years:
            for report_type in report_types:
                doc = await self.dart_client.fetch_report(
                    company_code,
                    report_type,
                    year
                )
                if doc:
                    documents.append(doc)
        
        return documents
    
    async def crawl_media(
        self,
        company_name: str,
        keywords: List[str],
        date_range: Tuple[datetime, datetime]
    ) -> List[Document]:
        """미디어 기사 크롤링"""
        articles = []
        
        for keyword in keywords:
            query = f"{company_name} {keyword}"
            results = await self.media_crawler.search(query, date_range)
            articles.extend(results)
        
        return articles
    
    async def crawl_competitor_reports(
        self,
        industry: str,
        year: int,
        top_n: int = 5
    ) -> List[Document]:
        """경쟁사 보고서 크롤링"""
        competitors = await self._get_industry_leaders(industry, top_n)
        reports = []
        
        for company in competitors:
            report = await self.dart_client.fetch_sustainability_report(
                company["code"],
                year
            )
            if report:
                reports.append(report)
        
        return reports
```

### 3.7 멀티모달 처리 모듈

```python
class TableExtractor:
    """LlamaParse 기반 표 추출"""
    
    def __init__(self, llama_parse_client: LlamaParseClient):
        self.client = llama_parse_client
    
    async def extract_tables(
        self,
        pdf_path: str,
        instruction: str = None
    ) -> List[Dict]:
        """목차 기반 표 추출"""
        result = await self.client.parse(
            pdf_path,
            parsing_instruction=instruction or "Extract all tables with headers",
            table_parsing_mode="markdown"
        )
        return result.tables

class ImageProcessor:
    """이미지 캡셔닝 및 OCR"""
    
    def __init__(self, model: str = "blip"):
        # BLIP 모델 사용
        from transformers import BlipProcessor, BlipForConditionalGeneration
        self.processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
        self.model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")
        self.model_type = "blip"
    
    async def caption_images(self, images: List[bytes]) -> List[Dict]:
        """이미지 캡셔닝"""
        captions = []
        for img in images:
            # BLIP 모델 사용
            from PIL import Image
            import io
            import torch
            
            image = Image.open(io.BytesIO(img)).convert("RGB")
            inputs = self.processor(image, return_tensors="pt")
            
            device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model = self.model.to(device)
            inputs = {k: v.to(device) for k, v in inputs.items()}
            
            out = self.model.generate(**inputs, max_length=200)
            caption = self.processor.decode(out[0], skip_special_tokens=True)
            
            captions.append({
                "caption": caption,
                "type": self._classify_image_type(img)  # chart/photo/diagram
            })
        return captions
    
    def _classify_image_type(self, image_bytes: bytes) -> str:
        """이미지 타입 분류"""
        # 간단한 휴리스틱 (실제로는 ML 모델 사용 권장)
        if b"chart" in image_bytes[:100] or b"graph" in image_bytes[:100]:
            return "chart"
        elif b"photo" in image_bytes[:100]:
            return "photo"
        else:
            return "diagram"
```

### 3.8 팩트 시트 생성 (구조화 + 비구조화 데이터 통합)

**변경사항**: 구조화된 데이터와 비구조화된 데이터를 모두 포함하는 통합 팩트 시트 생성

```python
class FactSheetGenerator:
    """DP 기반 팩트 시트 생성 (구조화 + 비구조화 데이터 통합)"""
    
    def __init__(self, llm_client: GroqClient, db_session, vector_store):
        self.llm = llm_client
        self.db = db_session
        self.vector_store = vector_store
    
    async def generate(
        self,
        dp_id: str,
        company_id: str,
        fiscal_year: int
    ) -> Dict[str, Any]:
        """DP별 통합 팩트 시트 생성"""
        
        fact_sheet = {
            "dp_id": dp_id,
            "dp_name": self._get_dp_name(dp_id),
            "structured_data": {},
            "unstructured_data": []
        }
        
        # 1. 구조화된 데이터: DB 직접 조회 (최우선)
        structured_data = await self._query_structured_db(
            dp_id, company_id, fiscal_year
        )
        fact_sheet["structured_data"] = structured_data
        
        # 2. 비구조화된 데이터: 벡터 검색 (보완)
        unstructured_data = await self._search_unstructured(
            dp_id, company_id, fiscal_year
        )
        fact_sheet["unstructured_data"] = unstructured_data
        
        return fact_sheet
    
    async def _query_structured_db(
        self,
        dp_id: str,
        company_id: str,
        fiscal_year: int
    ) -> Dict:
        """구조화된 데이터 DB 조회"""
        # unified_column_mappings를 통해 DP → 통합 컬럼 매핑
        unified_column = await self._get_unified_column_by_dp(dp_id)
        
        if not unified_column:
            return {}
        
        # sr_report_unified_data 테이블에서 조회
        result = await self.db.query_one(
            """
            SELECT 
                data_value,
                data_type,
                unit,
                data_source,
                confidence_score,
                source_entity_type,
                source_entity_id
            FROM sr_report_unified_data
            WHERE company_id = :company_id
              AND period_year = :fiscal_year
              AND unified_column_id = :unified_column_id
              AND included_in_final_report = TRUE
            ORDER BY confidence_score DESC
            LIMIT 1
            """,
            {
                "company_id": company_id,
                "fiscal_year": fiscal_year,
                "unified_column_id": unified_column["unified_column_id"]
            }
        )
        
        if result:
            return {
                "value": result["data_value"],
                "unit": result["unit"],
                "data_type": result["data_type"],
                "data_source": result["data_source"],
                "confidence": result["confidence_score"],
                "source_entity_type": result["source_entity_type"],
                "source_entity_id": result["source_entity_id"]
            }
        
        return {}
    
    async def _search_unstructured(
        self,
        dp_id: str,
        company_id: str,
        fiscal_year: int
    ) -> List[Dict]:
        """비구조화된 데이터 벡터 검색"""
        # 벡터 DB에서 검색
        query = f"{dp_id} {self._get_dp_name(dp_id)}"
        
        results = await self.vector_store.similarity_search(
            query=query,
            filter={
                "company_id": company_id,
                "report_year": {"$in": [fiscal_year - 1, fiscal_year - 2]}
            },
            top_k=10
        )
        
        return [
            {
                "content": result["content"],
                "source_type": result["metadata"]["source_type"],
                "source_url": result["metadata"].get("source_url"),
                "similarity": result["score"],
                "report_year": result["metadata"].get("report_year")
            }
            for result in results
        ]
```

---

## 4. Gen Node (문단 생성)

### 4.1 개요

Gen Node는 **전문 작가** 페르소나로 동작하며, IFRS 문체로 보고서 문단을 생성합니다.

**모델**: **GPT-5 mini** — 초안·재시도 등 호출 빈도가 높아 비용·지연 완화 (문체·용어는 프롬프트·스타일 가이드로 보정)

**역할**:
- IFRS 전문 문체 적용
- 재무적 연결성(Financial Linkage) 강조
- 시계열 분석 및 추세 설명
- 근거 주석 자동 생성
- 이전 년도 데이터 조합 추천

### 4.2 MCP 서버 통합

Gen Node 파일(`ai/ifrs_agent/agent/gen_node.py`)에 MCP 서버 기능이 통합되어 있습니다:

```python
# gen_node.py 하단에 MCP 서버 기능 포함
try:
    from mcp.server.fastmcp import FastMCP
    MCP_SERVER_AVAILABLE = True
except ImportError:
    MCP_SERVER_AVAILABLE = False

def get_mcp_server() -> Optional[FastMCP]:
    """MCP 서버 인스턴스 가져오기"""
    global _mcp_server
    if not MCP_SERVER_AVAILABLE:
        return None
    
    if _mcp_server is None:
        _mcp_server = FastMCP("Gen Node Server")
        
        @_mcp_server.tool()
        async def process(
            state: Dict[str, Any],
            instruction: Optional[str] = None
        ) -> Dict[str, Any]:
            """Gen Node 처리 (MCP Tool)"""
            node = get_gen_node_instance()
            result_state = await node.process(state)
            return {
                "state": result_state,
                "success": True,
                "sections_count": len(result_state.get("generated_sections", []))
            }
        
        @_mcp_server.tool()
        async def get_status() -> Dict[str, Any]:
            """Gen Node 상태 조회 (MCP Tool)"""
            return {"status": "ready"}
    
    return _mcp_server

# MCP 서버 실행 진입점
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--mcp":
        server = get_mcp_server()
        if server:
            server.run()
```

**실행 방법**:
```bash
# Gen Node를 MCP 서버로 실행
python -m ifrs_agent.agent.gen_node --mcp
```

### 4.3 기업별 LoRA 학습 (온프레미스)

#### 4.3.1 학습 데이터 생성: DART API → PDF → JSONL

**온프레미스 환경 특성**:
- 각 기업이 시스템을 구매하여 자체 서버에 설치
- 기업의 전년도/전전년도 SR 보고서를 DART API로 가져와 학습 데이터로 활용
- 기업별 문체와 표현 방식을 학습하여 일관성 유지

**DART API 응답 형태**:
```python
# 1단계: 보고서 목록 조회 (JSON)
GET https://opendart.fss.or.kr/api/list.json
Response: JSON
{
  "status": "000",
  "message": "정상",
  "list": [
    {
      "rcept_no": "20240101000001",  # 접수번호
      "corp_name": "삼성전자",
      "corp_code": "00126380",
      "report_nm": "지속가능경영보고서",
      "rcept_dt": "20240331"
    }
  ]
}

# 2단계: 보고서 원문 다운로드 (PDF)
GET https://opendart.fss.or.kr/api/document/{rcept_no}
Response: PDF 파일 (바이너리)
```

**PDF → JSONL 변환 파이프라인**:
```python
class TrainingDataGenerator:
    """기업별 학습 데이터 생성 (DART API → PDF → JSONL)"""
    
    def __init__(self, dart_api_key: str):
        self.dart_client = DARTClient(dart_api_key)
        self.pdf_parser = PDFParser()  # LlamaParse 또는 Unstructured
    
    async def generate_training_data(
        self,
        company_id: str,
        years: List[int]  # [2023, 2022, 2021]
    ) -> List[Dict]:
        """전년도 SR 보고서로 학습 데이터 생성"""
        
        all_jsonl = []
        
        for year in years:
            # 1. DART API로 SR 보고서 목록 조회
            report_list = await self.dart_client.get_report_list(
                company_id=company_id,
                report_type="지속가능경영보고서",
                year=year
            )
            
            for report_info in report_list:
                # 2. PDF 다운로드
                pdf_bytes = await self.dart_client.download_report(
                    report_info["rcept_no"]
                )
                
                # 3. PDF 파싱 (LlamaParse 또는 Unstructured)
                parsed_doc = await self.pdf_parser.parse(pdf_bytes)
                
                # 4. 섹션별 추출
                sections = self._extract_sections(parsed_doc)
                
                # 5. DP 매핑 및 JSONL 변환
                for section in sections:
                    # 섹션 제목 → DP 매핑
                    related_dps = self._map_section_to_dps(section["title"])
                    
                    # 6. JSONL 형식으로 변환
                    jsonl_entry = {
                        "instruction": self._build_instruction(
                            section["title"],
                            related_dps
                        ),
                        "input": {
                            "dp_ids": related_dps,
                            "quantitative_data": section["numbers"],
                            "historical_context": await self._get_historical_context(
                                company_id, year
                            ),
                            "company_info": await self._get_company_info(company_id),
                            "internal_systems_data": await self._get_internal_data(
                                company_id, year
                            )
                        },
                        "output": section["content"],  # 실제 보고서 문단
                        "metadata": {
                            "company_id": company_id,
                            "report_year": year,
                            "section_title": section["title"],
                            "source": "dart_sr_report",
                            "rcept_no": report_info["rcept_no"]
                        }
                    }
                    
                    all_jsonl.append(jsonl_entry)
        
        return all_jsonl
    
    def _build_instruction(
        self,
        section_title: str,
        dp_ids: List[str]
    ) -> str:
        """학습용 instruction 생성"""
        return f"""
        다음 정보를 기반으로 {section_title} 섹션을 IFRS S2 기준으로 작성하세요.
        
        필수 포함 Data Points:
        {', '.join(dp_ids)}
        
        작성 규칙:
        1. 전년도 보고서와 일관된 문체 유지
        2. 정량 데이터는 출처와 기준연도 명시
        3. IFRS S2 요구사항 준수
        4. 재무적 연결성 강조
        5. 내부 시스템 데이터(EMS, EHS, PLM, SRM, HR, MDG) 우선 반영
        """
    
    def _extract_sections(self, parsed_doc: Dict) -> List[Dict]:
        """PDF에서 섹션별 추출"""
        sections = []
        
        # 목차 기반 섹션 추출
        toc = parsed_doc.get("table_of_contents", [])
        
        for toc_item in toc:
            section = {
                "title": toc_item["title"],
                "content": self._extract_section_content(
                    parsed_doc, 
                    toc_item["start_page"],
                    toc_item["end_page"]
                ),
                "numbers": self._extract_numbers(
                    parsed_doc,
                    toc_item["start_page"],
                    toc_item["end_page"]
                )
            }
            sections.append(section)
        
        return sections
```

**JSONL 형식 예시**:
```jsonl
{"instruction": "온실가스 배출량 섹션을 IFRS S2 기준으로 작성하세요.", "input": {"dp_ids": ["S2-29-a", "S2-29-b"], "quantitative_data": {"scope1": 1234.5, "scope2": 567.8}, "historical_context": {"2022": {"scope1": 1100.0}, "2023": {"scope1": 1150.0}}, "company_info": {"name": "삼성전자", "industry": "전자"}, "internal_systems_data": {"ems": {"energy_usage": 50000.0}, "ehs": {"waste_generated": 1200.0}}}, "output": "본사는 2024년 기준 Scope 1 배출량 1,234.5 tCO2e, Scope 2 배출량 567.8 tCO2e를 기록했습니다. 전년 대비 Scope 1은 7.3% 증가했으며, 이는 생산량 증가에 따른 것으로 분석됩니다.", "metadata": {"company_id": "company-001", "report_year": 2024, "section_title": "온실가스 배출량", "source": "dart_sr_report"}}
{"instruction": "에너지 사용량 섹션을 IFRS S2 기준으로 작성하세요.", "input": {"dp_ids": ["S2-30-a"], "quantitative_data": {"total_energy": 50000.0, "renewable_ratio": 15.5}, "historical_context": {"2022": {"renewable_ratio": 12.0}, "2023": {"renewable_ratio": 14.0}}, "company_info": {"name": "삼성전자", "industry": "전자"}, "internal_systems_data": {"ems": {"energy_usage": 50000.0, "renewable_ratio": 15.5}}}, "output": "2024년 총 에너지 사용량은 50,000 MWh이며, 재생에너지 비율은 15.5%를 기록했습니다. 전년 대비 1.5%p 증가했으며, 태양광 패널 설치 확대로 인한 것으로 분석됩니다.", "metadata": {"company_id": "company-001", "report_year": 2024, "section_title": "에너지 사용량", "source": "dart_sr_report"}}
```

#### 4.3.2 온프레미스 LoRA 학습 설정

```python
# LoRA 학습 설정 (Unsloth + QLoRA)
LORA_CONFIG = {
    "base_model": "LGAI-EXAONE/EXAONE-3.0-7.8B-Instruct",
    "lora_r": 16,
    "lora_alpha": 32,
    "lora_dropout": 0.05,
    "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"],
    "quantization": "4bit",  # RTX 4070 Super 12GB 대응
    "max_seq_length": 4096,
    "learning_rate": 2e-4,
    "num_train_epochs": 3,
    "per_device_train_batch_size": 2,
    "gradient_accumulation_steps": 4
}

class OnPremiseLoRATrainer:
    """온프레미스 환경 기업별 LoRA 학습"""
    
    def __init__(self, company_id: str):
        self.company_id = company_id
        self.model_path = "exaone-3.0-7.8b"
        self.output_path = f"./models/{company_id}/lora"
    
    async def train_company_specific_lora(
        self,
        jsonl_data: List[Dict],
        epochs: int = 3
    ):
        """기업별 LoRA 학습 실행"""
        
        # 1. 학습 데이터 검증
        if len(jsonl_data) < 50:
            logger.warning(
                f"학습 데이터가 부족합니다 ({len(jsonl_data)}개). "
                "최소 50개 이상 권장합니다."
            )
        
        # 2. JSONL 파일 저장
        jsonl_file = f"./data/{self.company_id}/training_data.jsonl"
        os.makedirs(os.path.dirname(jsonl_file), exist_ok=True)
        
        with open(jsonl_file, 'w', encoding='utf-8') as f:
            for entry in jsonl_data:
                f.write(json.dumps(entry, ensure_ascii=False) + '\n')
        
        # 3. LoRA 학습 실행
        training_config = {
            "model_name": self.model_path,
            "train_data": jsonl_file,
            "output_dir": self.output_path,
            "num_train_epochs": epochs,
            "per_device_train_batch_size": 4,
            "gradient_accumulation_steps": 4,
            "learning_rate": 2e-4,
            "lora_r": 16,
            "lora_alpha": 32,
            "max_seq_length": 4096
        }
        
        # 학습 실행 (PEFT, Transformers 사용)
        await self._run_lora_training(training_config)
        
        logger.info(f"✅ {self.company_id} 기업별 LoRA 학습 완료")
        logger.info(f"📁 모델 저장 경로: {self.output_path}")
```

#### 4.3.3 학습 프로세스

**Phase 1: 초기 설정 (한 번만 실행)**:
```python
# 1. DART API로 전년도/전전년도 SR 보고서 다운로드
generator = TrainingDataGenerator(dart_api_key="your-key")
jsonl_data = await generator.generate_training_data(
    company_id="company-001",
    years=[2023, 2022, 2021]  # 전년도, 전전년도, 전전전년도
)

# 2. 기업별 LoRA 학습
trainer = OnPremiseLoRATrainer(company_id="company-001")
await trainer.train_company_specific_lora(jsonl_data, epochs=3)

# 3. 학습된 모델 저장
# ./models/company-001/lora/ 디렉토리에 저장됨
```

**Phase 2: 보고서 작성 시 (매번 실행)**:
```python
# Gen Node 초기화 시 기업별 LoRA 모델 로드
gen_node = GenNode(
    model_path="./models/company-001/lora"  # 기업별 학습된 모델
)
```

### 4.4 문단 생성 로직

**변경사항**: RAG Node가 구조화된 데이터와 비구조화된 데이터를 모두 수집하도록 변경됨

```python
class GenNode:
    def __init__(self, model_path: str, company_id: str):
        """Gen Node 초기화
        
        Args:
            model_path: 기업별 학습된 LoRA 모델 경로
            company_id: 기업 ID (모델 경로 결정용)
        """
        # 기업별 학습된 LoRA 모델 로드
        self.model = self._load_lora_model(model_path)
        self.tokenizer = self._load_tokenizer(model_path)
        self.company_id = company_id
    
    async def process(self, state: IFRSAgentState) -> IFRSAgentState:
        """문단 생성 메인 로직
        
        RAG Node에서 수집한 데이터:
        - fact_sheets[].structured_data: DB에서 조회한 구조화된 데이터
        - fact_sheets[].unstructured_data: 벡터 검색으로 찾은 비구조화된 데이터
        """
        generated_sections = []
        
        for fact_sheet in state.get("fact_sheets", []):
            dp_id = fact_sheet.get("dp_id")
            
            # 해당 DP에 대한 섹션 생성
            section = await self._generate_section(
                fact_sheet,
                state
            )
            
            generated_sections.append(section)
        
        state["generated_sections"] = generated_sections
        return state
    
    async def _generate_section(
        self,
        fact_sheet: Dict[str, Any],
        state: IFRSAgentState
    ) -> Dict[str, Any]:
        """섹션 생성 (RAG Node에서 받은 통합 데이터 활용)"""
        
        # 1. 구조화된 데이터 (DB에서 조회한 데이터)
        structured_data = fact_sheet.get("structured_data", {})
        # - ghg_emission_results
        # - environmental_data
        # - social_data
        # - governance_data
        
        # 2. 비구조화된 데이터 (벡터 검색 결과)
        unstructured_data = fact_sheet.get("unstructured_data", [])
        # - 전년도 SR 보고서 문단
        # - 기준서 요구사항
        # - 외부 공시 문서
        
        # 3. 프롬프트 구성
        prompt = self._build_generation_prompt(
            fact_sheet,
            structured_data,
            unstructured_data,
            state
        )
        
        # 4. 기업별 학습된 LoRA 모델로 문단 생성
        paragraph = await self._generate_with_lora(prompt)
        
        # 5. 근거 주석 추가
        paragraph_with_sources = self._add_source_annotations(
            paragraph,
            structured_data,
            unstructured_data
        )
        
        return {
            "section_id": fact_sheet.get("dp_id"),
            "section_name": fact_sheet.get("dp_name"),
            "content": paragraph_with_sources,
            "sources": self._extract_sources(structured_data, unstructured_data),
            "data_quality": self._assess_data_quality(structured_data, unstructured_data),
            "financial_linkage": self._extract_financial_linkage(paragraph),
            "historical_consistency": self._check_historical_consistency(
                structured_data,
                unstructured_data
            )
        }
    
    def _build_generation_prompt(
        self,
        fact_sheet: Dict[str, Any],
        structured_data: Dict,
        unstructured_data: List[Dict],
        state: IFRSAgentState
    ) -> str:
        """생성 프롬프트 구성"""
        
        # 전년도 보고서 참고 문단 추출
        historical_refs = [
            item["content"] 
            for item in unstructured_data 
            if item.get("source_type") == "historical_report"
        ]
        
        # 기준서 요구사항 추출
        standard_reqs = [
            item["content"]
            for item in unstructured_data
            if item.get("source_type") == "standard"
        ]
        
        prompt = f"""
        다음 정보를 기반으로 IFRS S2 문체로 보고서 페이지를 작성하세요.
        
        ## 선택된 DP
        {fact_sheet.get('dp_id')}: {fact_sheet.get('dp_name')}
        
        ## 내부 시스템 데이터 (최신, 신뢰도 높음)
        {self._format_structured_data(structured_data)}
        
        ## 전년도 SR 보고서 참고
        {self._format_historical_references(historical_refs)}
        
        ## 기준서 요구사항
        {self._format_standard_requirements(standard_reqs)}
        
        ## 외부 공시 데이터 (검증용)
        {self._format_external_data(unstructured_data)}
        
        ## 작성 규칙
        1. 전년도 보고서와 일관성 유지
        2. 내부 시스템 데이터를 우선 반영
        3. 외부 공시 데이터와 불일치 시 주석 추가
        4. IFRS S2 기준 준수
        5. 재무적 연결성 강조
        """
        
        return prompt
    
    async def _generate_with_lora(self, prompt: str) -> str:
        """기업별 학습된 LoRA 모델로 문단 생성"""
        inputs = self.tokenizer(prompt, return_tensors="pt")
        
        outputs = self.model.generate(
            **inputs,
            max_new_tokens=1024,
            temperature=0.7,
            do_sample=True,
            top_p=0.9,
            repetition_penalty=1.1
        )
        
        return self.tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    def _assess_data_quality(
        self,
        structured_data: Dict,
        unstructured_data: List[Dict]
    ) -> str:
        """데이터 품질 평가"""
        # 우선순위: 내부 시스템 > 전년도 보고서 > 외부 크롤링
        if structured_data:
            return "high"  # 내부 시스템 데이터 있음
        elif any(item.get("source_type") == "historical_report" for item in unstructured_data):
            return "medium"  # 전년도 보고서만 있음
        else:
            return "low"  # 외부 크롤링만 있음
    
    def _check_historical_consistency(
        self,
        structured_data: Dict,
        unstructured_data: List[Dict]
    ) -> Dict[str, Any]:
        """전년도와의 일관성 검사"""
        historical_refs = [
            item for item in unstructured_data
            if item.get("source_type") == "historical_report"
        ]
        
        if not historical_refs or not structured_data:
            return {"consistent": True, "notes": []}
        
        # 전년도 값과 현재 값 비교
        current_value = structured_data.get("value")
        historical_value = historical_refs[0].get("value")
        
        if current_value and historical_value:
            change_pct = abs((current_value - historical_value) / historical_value * 100)
            
            if change_pct > 50:
                return {
                    "consistent": False,
                    "notes": [f"전년 대비 {change_pct:.1f}% 급격한 변화 - 확인 필요"]
                }
        
        return {"consistent": True, "notes": []}
```

### 4.5 생성 프롬프트 설계

**변경사항**: RAG Node에서 받은 구조화/비구조화 데이터를 모두 활용하는 프롬프트로 업데이트

```python
GEN_NODE_PROMPT_TEMPLATE = """
당신은 IFRS S1/S2 지속가능성 공시 전문 작가입니다.
이 기업의 전년도 보고서 문체와 표현 방식을 학습한 모델입니다.

## 작성 규칙
1. **전년도 일관성**: 전년도 보고서와 일관된 문체와 표현 방식 유지
2. **재무적 연결성**: 모든 ESG 지표는 재무제표와의 연결성을 명시합니다.
3. **정량적 근거**: 수치 데이터는 반드시 출처와 기준연도를 포함합니다.
4. **시계열 분석**: 전년 대비 변화를 설명하고 추세를 분석합니다.
5. **IFRS 문체**: 객관적이고 전문적인 어조를 유지합니다.
6. **데이터 우선순위**: 내부 시스템 데이터 > 전년도 보고서 > 외부 공시 데이터

## 입력 데이터

### 1. 내부 시스템 데이터 (최우선, 신뢰도 높음)
{structured_data}
- EMS: 에너지 사용량
- EHS: 폐기물, 안전보건
- ERP: 연료, 구매
- PLM: 제품 생명주기
- SRM: 공급망
- HR: 임직원, 교육
- MDG: 기준정보

### 2. 전년도/전전년도 SR 보고서 참고
{historical_references}
- 전년도 보고서에서 유사한 문단 참고
- 일관된 문체 유지
- 표현 방식 통일

### 3. 기준서 요구사항
{standard_requirements}
- IFRS S2 요구사항
- GRI Standards 요구사항
- 기타 공시 기준서

### 4. 외부 공시 데이터 (검증용)
{external_data}
- DART 공시 데이터
- 경쟁사 보고서
- 업계 평균

### 작성 대상
- 기준서: {target_standard}
- 섹션: {section_name}
- 필수 DP: {required_dps}
- 기업: {company_name}

## 출력 형식
다음 형식으로 문단을 작성하세요:

[문단 내용]

---
**재무적 영향**: [재무제표 연결 설명]
**출처**: [참조 출처 목록]
**데이터 품질**: [high/medium/low]
**전년도 일관성**: [일관/부분일관/불일치]
**추천 시각화**: [차트/표 추천]
"""

def format_structured_data(structured_data: Dict) -> str:
    """구조화된 데이터 포맷팅"""
    if not structured_data:
        return "내부 시스템 데이터 없음"
    
    formatted = []
    for key, value in structured_data.items():
        if isinstance(value, dict):
            formatted.append(f"- {key}: {json.dumps(value, ensure_ascii=False)}")
        else:
            formatted.append(f"- {key}: {value}")
    
    return "\n".join(formatted)

def format_historical_references(historical_refs: List[Dict]) -> str:
    """전년도 보고서 참고 문단 포맷팅"""
    if not historical_refs:
        return "전년도 보고서 참고 없음"
    
    formatted = []
    for ref in historical_refs:
        formatted.append(f"""
### {ref.get('report_year', 'N/A')}년 보고서
{ref.get('content', '')}
        """)
    
    return "\n".join(formatted)
```

### 4.6 이전 년도 데이터 조합 추천

```python
class YearlyDataRecommender:
    """이전 년도 데이터 조합 추천"""
    
    def recommend(
        self,
        current_value: float,
        historical_values: Dict[int, float],
        dp_type: str
    ) -> Dict:
        """추세 기반 추천"""
        years = sorted(historical_values.keys())
        values = [historical_values[y] for y in years]
        
        # 추세 계산
        trend = self._calculate_trend(values)
        
        # 추천 생성
        recommendation = {
            "trend": trend,
            "trend_description": self._describe_trend(trend),
            "suggested_narrative": self._generate_narrative(
                current_value,
                historical_values,
                trend
            ),
            "comparison_points": self._get_comparison_points(
                current_value,
                historical_values
            )
        }
        
        return recommendation
    
    def _generate_narrative(
        self,
        current: float,
        historical: Dict[int, float],
        trend: str
    ) -> str:
        """서술 문장 추천"""
        last_year = max(historical.keys())
        last_value = historical[last_year]
        change_pct = ((current - last_value) / last_value) * 100
        
        if trend == "increasing":
            return f"전년 대비 {abs(change_pct):.1f}% 증가하여 지속적인 개선 추세를 보이고 있습니다."
        elif trend == "decreasing":
            return f"전년 대비 {abs(change_pct):.1f}% 감소하였으며, 이는 [원인]에 기인합니다."
        else:
            return f"전년과 유사한 수준을 유지하고 있습니다."
```

---

## 5. Supervisor 검증 및 감사 통합 (하이브리드 접근)

### 5.1 개요

**⚠️ 변경사항**: Validation Node가 Supervisor에 통합되었습니다. (하이브리드 접근 방식)

**하이브리드 접근 방식**:
- **워크플로우 레벨**: Validation Node 제거, Supervisor가 검증 및 감사 통합 수행
- **코드 레벨**: 검증 로직과 감사 로직을 메서드 단위로 분리하여 모듈화 유지
- **Star Topology 완성**: 모든 노드가 Supervisor를 통해서만 통신

**모델**:
- **Gemini 3.1 Pro** — 감사·검증 판정 품질(그린워싱·일관성 등). [REVISED_WORKFLOW.md](./REVISED_WORKFLOW.md)의 `validator_node`와 동급 역할 시 동일 선택
- (구현 변형) Supervisor에 검증이 통합된 경우에도 동일 고역량 모델 권장

**역할**:
- 입력 데이터 범위 검증
- 생성 결과 검증
- 그린워싱 표현 탐지
- IFRS 준수 여부 확인
- 최종 품질 감사 (Audit)

### 5.2 검증 및 감사 통합 로직

```python
class SupervisorAgent:
    def validate_and_audit(self, state: IFRSAgentState) -> IFRSAgentState:
        """검증 + 감사 통합 메서드 (하이브리드 접근)
        
        워크플로우 레벨에서는 하나의 노드이지만,
        내부적으로는 검증과 감사를 분리하여 처리
        """
        logger.info("Supervisor: 검증 및 감사 시작")
        
        # 1단계: 검증 수행 (Validation 로직)
        validation_result = self._perform_validation(state)
        state["validation_results"].append(validation_result)
        
        # 2단계: 감사 수행 (Audit 로직)
        audit_result = self._perform_audit(state, validation_result)
        state["audit_log"].append(audit_result)
        
        # 상태 업데이트
        state["current_node"] = "validating_and_auditing"
        state["status"] = audit_result.get("status", "auditing")
        
        return state
    
    def _perform_validation(self, state: IFRSAgentState) -> Dict[str, Any]:
        """검증 수행 (Validation Node의 process 메서드 로직)
        
        Validation Node의 기능을 그대로 Supervisor로 이동
        책임은 분리되어 있지만, 같은 클래스 내부에 존재
        """
        validation_results = []
        
        # 1. 입력 데이터 검증
        data_validation = self._validate_input_data(state.get("fact_sheets", []))
        
        # 2. 생성 결과 검증
        for section in state.get("generated_sections", []):
            section_validation = self._validate_section(section)
            validation_results.append(section_validation)
        
        # 3. 그린워싱 검사
        greenwashing_check = self._check_greenwashing(state.get("generated_sections", []))
        
        # 4. IFRS 준수 검사
        compliance_check = self._check_ifrs_compliance(
            state.get("generated_sections", []),
            state.get("target_standards", [])
        )
        
        return {
            "data_validation": data_validation,
            "section_validations": validation_results,
            "greenwashing_risk": greenwashing_check["risk_score"],
            "greenwashing_issues": greenwashing_check["issues"],
            "compliance_score": compliance_check["score"],
            "compliance_issues": compliance_check["issues"],
            "is_valid": (
                data_validation["is_valid"] and
                greenwashing_check["risk_score"] < 0.7 and
                compliance_check["score"] >= 0.8
            )
        }
    
    def _perform_audit(self, state: IFRSAgentState, validation_result: Dict[str, Any]) -> Dict[str, Any]:
        """감사 수행 (기존 audit 메서드 로직)
        
        검증 결과를 바탕으로 최종 결정을 내림
        """
        # 그린워싱 체크
        greenwashing_risk = validation_result.get("greenwashing_risk", 0.0)
        if greenwashing_risk > 0.7:
            return {
                "action": "reject",
                "reason": "greenwashing_risk",
                "status": "rejected"
            }
        
        # IFRS 준수 체크
        compliance_score = validation_result.get("compliance_score", 1.0)
        if compliance_score < 0.8:
            return {
                "action": "request_revision",
                "status": "needs_revision"
            }
        else:
            return {
                "action": "approve",
                "status": "approved"
            }
```

### 5.3 범위 검증 규칙

```python
VALIDATION_RULES = {
    "percentage": {
        "min": 0,
        "max": 100,
        "error_message": "백분율은 0-100 범위여야 합니다."
    },
    "employee_count": {
        "min": 1,
        "max": 10000000,
        "error_message": "임직원 수가 비정상적입니다."
    },
    "emission_intensity": {
        "min": 0,
        "max": 1000,
        "unit": "tCO2e/억원",
        "error_message": "배출 집약도가 비정상적입니다."
    },
    "gender_ratio": {
        "sum_check": True,
        "expected_sum": 100,
        "error_message": "성별 비율 합계가 100%가 아닙니다."
    }
}

class DataValidator:
    def validate(self, fact_sheet: FactSheet) -> ValidationResult:
        """팩트 시트 데이터 검증"""
        dp_type = self._get_dp_type(fact_sheet.dp_id)
        rule = VALIDATION_RULES.get(dp_type)
        
        if not rule:
            return ValidationResult(is_valid=True)
        
        errors = []
        
        for year, value in fact_sheet.values.items():
            # 범위 검사
            if "min" in rule and value < rule["min"]:
                errors.append(f"{year}년 값({value})이 최소값 미만입니다.")
            if "max" in rule and value > rule["max"]:
                errors.append(f"{year}년 값({value})이 최대값 초과입니다.")
        
        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors
        )
```

### 5.4 그린워싱 탐지

```python
GREENWASHING_PATTERNS = [
    {
        "pattern": r"(세계 최고|업계 최초|완벽한|100% 친환경)",
        "risk": "high",
        "description": "과장된 표현"
    },
    {
        "pattern": r"(노력할 예정|추진 중|검토 중)(?!.*구체적)",
        "risk": "medium",
        "description": "모호한 약속"
    },
    {
        "pattern": r"(친환경|그린|에코)(?!.*인증|.*기준)",
        "risk": "medium",
        "description": "근거 없는 친환경 주장"
    }
]

class GreenwashingDetector:
    def __init__(self, llm_client: GroqClient):
        self.llm = llm_client
        self.patterns = GREENWASHING_PATTERNS
    
    async def detect(self, content: str) -> Dict:
        """그린워싱 표현 탐지"""
        issues = []
        
        # 1. 패턴 기반 탐지
        for pattern_config in self.patterns:
            matches = re.findall(pattern_config["pattern"], content)
            for match in matches:
                issues.append({
                    "text": match,
                    "risk": pattern_config["risk"],
                    "description": pattern_config["description"]
                })
        
        # 2. LLM 기반 심층 분석
        llm_analysis = await self._llm_analyze(content)
        issues.extend(llm_analysis["issues"])
        
        # 3. 위험 점수 계산
        risk_score = self._calculate_risk_score(issues)
        
        return {
            "risk_score": risk_score,
            "issues": issues,
            "recommendation": self._get_recommendation(issues)
        }
```

### 5.5 공시 데이터 비교

```python
class DisclosureComparator:
    """기존 공시 데이터와 비교 검증"""
    
    def __init__(self, dart_client: DARTClient):
        self.dart = dart_client
    
    async def compare(
        self,
        company_id: str,
        fact_sheets: List[FactSheet]
    ) -> List[DiscrepancyReport]:
        """공시 데이터와 비교"""
        discrepancies = []
        
        # 기존 공시 데이터 조회
        disclosed_data = await self.dart.get_disclosed_metrics(company_id)
        
        for fact_sheet in fact_sheets:
            if fact_sheet.dp_id in disclosed_data:
                disclosed_value = disclosed_data[fact_sheet.dp_id]
                input_value = fact_sheet.values.get(max(fact_sheet.values.keys()))
                
                # 차이 계산
                if disclosed_value != 0:
                    diff_pct = abs(input_value - disclosed_value) / disclosed_value * 100
                    
                    if diff_pct > 10:  # 10% 이상 차이
                        discrepancies.append(DiscrepancyReport(
                            dp_id=fact_sheet.dp_id,
                            input_value=input_value,
                            disclosed_value=disclosed_value,
                            difference_percent=diff_pct,
                            severity="high" if diff_pct > 30 else "medium"
                        ))
        
        return discrepancies
```

---

## 6. Design Recommendation Node (디자인 추천)

### 6.1 개요

Design Node는 **브랜드 디자이너** 페르소나로 동작하며, 기업 BI/CI를 반영한 시각화 가이드를 제공합니다.

**모델**: Gemini 2.5 Pro

**역할**:
- 기업 BI 컬러/스타일 분석
- IFRS 구조에 맞는 차트 타입 추천
- 경쟁사 벤치마킹 기반 디자인 가이드

### 6.2 MCP 서버 통합

Design Node 파일(`ai/ifrs_agent/agent/design_node.py`)에 MCP 서버 기능이 통합되어 있습니다:

```python
# design_node.py 하단에 MCP 서버 기능 포함
try:
    from mcp.server.fastmcp import FastMCP
    MCP_SERVER_AVAILABLE = True
except ImportError:
    MCP_SERVER_AVAILABLE = False

def get_mcp_server() -> Optional[FastMCP]:
    """MCP 서버 인스턴스 가져오기"""
    global _mcp_server
    if not MCP_SERVER_AVAILABLE:
        return None
    
    if _mcp_server is None:
        _mcp_server = FastMCP("Design Node Server")
        
        @_mcp_server.tool()
        async def process(
            state: Dict[str, Any],
            instruction: Optional[str] = None
        ) -> Dict[str, Any]:
            """Design Node 처리 (MCP Tool)"""
            design_node = get_design_node_instance()
            if design_node is None:
                return {
                    "state": state,
                    "success": False,
                    "error": "Design Node 인스턴스를 생성할 수 없습니다"
                }
            
            result_state = await design_node.process(state)
            return {
                "state": result_state,
                "success": True
            }
        
        @_mcp_server.tool()
        async def get_status() -> Dict[str, Any]:
            """Design Node 상태 조회 (MCP Tool)"""
            design_node = get_design_node_instance()
            if design_node is None:
                return {"status": "unavailable"}
            return {"status": "ready"}
    
    return _mcp_server

# MCP 서버 실행 진입점
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--mcp":
        server = get_mcp_server()
        if server:
            server.run()
```

**실행 방법**:
```bash
# Design Node를 MCP 서버로 실행
python -m ifrs_agent.agent.design_node --mcp
```

### 6.3 구현 예시

```python
class DesignRecommendationNode(BaseNode):
    """디자인 추천 노드"""
    
    def __init__(self, llm_client: GroqClient, competitor_analyzer: CompetitorAnalyzer):
        self.llm = llm_client
        self.competitor_analyzer = competitor_analyzer
    
    async def process(self, state: IFRSAgentState) -> IFRSAgentState:
        """디자인 추천 생성"""
        # 1. 기업 BI 추출
        corporate_identity = state["corporate_identity"]
        
        # 2. 경쟁사 분석
        competitor_designs = await self._analyze_competitors(
            state["company_id"],
            state["fiscal_year"]
        )
        
        # 3. 섹션별 디자인 추천 생성
        design_recommendations = []
        for section in state["generated_sections"]:
            recommendation = await self._generate_design_guide(
                section,
                corporate_identity,
                competitor_designs
            )
            design_recommendations.append(recommendation)
        
        state["design_recommendations"] = design_recommendations
        return state
    
    async def _generate_design_guide(
        self,
        section: Dict,
        corporate_identity: Dict,
        competitor_designs: List[Dict]
    ) -> Dict:
        """섹션별 디자인 가이드 생성"""
        
        prompt = f"""
당신은 IFRS 보고서 전문 디자이너입니다.

## 기업 브랜드
- 주요 컬러: {corporate_identity.get("primary_colors", [])}
- 스타일: {corporate_identity.get("style", "professional")}

## 섹션 정보
- 섹션: {section["section_name"]}
- DP 타입: {section.get("dp_type", "quantitative")}
- 데이터: {section.get("data_summary", "")}

## 경쟁사 벤치마크
{self._format_competitor_designs(competitor_designs)}

## 요구사항
IFRS S2의 논리 구조에 맞으면서, 기업 브랜드를 유지하는 시각화를 추천하세요.

출력 형식:
{{
    "chart_type": "waterfall|bar|line|scatter|heatmap",
    "color_scheme": {{
        "primary": "#HEX",
        "secondary": "#HEX",
        "accent": "#HEX"
    }},
    "rationale": "왜 이 차트 타입이 IFRS 구조에 적합한지 설명",
    "brand_alignment": "브랜드 컬러와의 조화 설명",
    "competitor_insight": "경쟁사 대비 차별화 포인트"
}}
"""
        
        response = await self.llm.generate(prompt)
        return self._parse_design_recommendation(response)
    
    async def _analyze_competitors(
        self,
        company_id: str,
        year: int
    ) -> List[Dict]:
        """경쟁사 디자인 분석"""
        # 경쟁사 보고서 수집
        competitors = await self.competitor_analyzer.collect_competitor_reports(
            industry=self._get_industry(company_id),
            year=year,
            top_n=5
        )
        
        # 디자인 요소 추출
        designs = []
        for report in competitors:
            design = {
                "company": report["company_name"],
                "colors": report["corporate_identity"]["primary_colors"],
                "chart_types": self._extract_chart_types(report),
                "style": report["corporate_identity"]["style"]
            }
            designs.append(design)
        
        return designs
    
    def _format_competitor_designs(self, designs: List[Dict]) -> str:
        """경쟁사 디자인 포맷팅"""
        formatted = []
        for d in designs:
            formatted.append(f"- {d['company']}: {d['chart_types']}, 컬러: {d['colors']}")
        return "\n".join(formatted)

# 사용 예시
design_recommendation = {{
    "section_id": "S2-15-a",
    "chart_type": "waterfall",
    "color_scheme": {{
        "primary": "#F15A22",  # SK하이닉스 주황색
        "secondary": "#003366",
        "accent": "#FFD700"
    }},
    "rationale": """
    폭포형 차트는 IFRS S2의 '재무적 영향' 구조에 최적입니다.
    - 기반값(베이스라인) → 리스크 요인별 영향 → 최종 영향
    이 논리 흐름을 시각적으로 명확히 표현할 수 있습니다.
    """,
    "brand_alignment": "SK하이닉스의 주황색(#F15A22)을 primary로 사용하여 브랜드 일관성 유지",
    "competitor_insight": "경쟁사 대부분이 막대 그래프를 사용하나, 폭포형은 IFRS 구조를 더 잘 반영"
}}
```

---

## 7. Embedding Model (BGE-M3)

### 6.1 개요

BGE-M3는 ESG 전문 용어에 최적화된 임베딩 모델이며, **현행 운영**에서 Dense 벡터 생성에 사용한다.

**모델**: BAAI/bge-m3 (Contrastive Learning 튜닝, **현행** · pgvector `VECTOR(1024)` 정합)

**역할**:
- RAG 하이브리드 검색의 Dense 벡터 생성
- ESG 전문 용어 동의어 처리
- 다국어 지원 (한국어/영어)

### 6.2 튜닝 설정

```python
# Contrastive Learning 튜닝 설정
EMBEDDING_TUNING_CONFIG = {
    "base_model": "BAAI/bge-m3",
    "training_data": {
        "positive_pairs": 500,  # Q&A 쌍
        "source": "GRI Glossary, IFRS S1/S2 용어집"
    },
    "loss_function": "InfoNCE",
    "temperature": 0.05,
    "batch_size": 32,
    "epochs": 10,
    "learning_rate": 2e-5
}

# 동의어 쌍 예시
SYNONYM_PAIRS = [
    ("Scope 3 배출량", "공급망 배출량"),
    ("탄소중립", "넷제로"),
    ("기후 리스크", "기후변화 위험"),
    ("전환 리스크", "저탄소 전환 위험"),
    ("물리적 리스크", "기후 물리적 영향"),
    ("TCFD", "기후관련 재무정보공개"),
    ("ESG", "환경·사회·지배구조"),
    ("GHG", "온실가스")
]
```

### 6.3 임베딩 서비스

```python
class ESGEmbeddingService:
    def __init__(self, model_path: str):
        self.model = SentenceTransformer(model_path)
        self.synonym_map = self._load_synonyms()
    
    def encode(
        self,
        texts: Union[str, List[str]],
        normalize: bool = True
    ) -> np.ndarray:
        """텍스트 임베딩 생성"""
        if isinstance(texts, str):
            texts = [texts]
        
        # 동의어 확장
        expanded_texts = [self._expand_synonyms(t) for t in texts]
        
        # 임베딩 생성
        embeddings = self.model.encode(
            expanded_texts,
            normalize_embeddings=normalize
        )
        
        return embeddings
    
    def _expand_synonyms(self, text: str) -> str:
        """동의어 확장"""
        for term, synonym in self.synonym_map.items():
            if term in text:
                text = f"{text} {synonym}"
        return text
```

---

## 7. 노드 간 통신

### 7.1 메시지 형식

```python
class NodeMessage(BaseModel):
    """노드 간 통신 메시지"""
    from_node: str
    to_node: str
    message_type: Literal["instruction", "result", "error", "feedback"]
    payload: Dict[str, Any]
    timestamp: datetime
    correlation_id: str  # 요청 추적용

# 예시: Supervisor → RAG Node
instruction_message = NodeMessage(
    from_node="supervisor",
    to_node="rag_node",
    message_type="instruction",
    payload={
        "action": "search",
        "target_dps": ["S2-15-a", "S2-15-b"],
        "years": [2022, 2023, 2024],
        "sources": ["internal", "dart", "media"]
    },
    timestamp=datetime.now(),
    correlation_id="req-001"
)

# 예시: RAG Node → Supervisor
result_message = NodeMessage(
    from_node="rag_node",
    to_node="supervisor",
    message_type="result",
    payload={
        "fact_sheets": [...],
        "search_metadata": {
            "total_documents": 150,
            "relevant_documents": 23,
            "processing_time": 2.5
        }
    },
    timestamp=datetime.now(),
    correlation_id="req-001"
)
```

### 7.2 에러 전파

```python
class NodeError(BaseModel):
    """노드 에러 정보"""
    error_type: str
    error_message: str
    recoverable: bool
    suggested_action: str

# 에러 메시지 예시
error_message = NodeMessage(
    from_node="rag_node",
    to_node="supervisor",
    message_type="error",
    payload={
        "error": NodeError(
            error_type="DataNotFound",
            error_message="S2-15-c DP에 대한 데이터를 찾을 수 없습니다.",
            recoverable=True,
            suggested_action="external_crawl"
        )
    },
    timestamp=datetime.now(),
    correlation_id="req-001"
)
```

