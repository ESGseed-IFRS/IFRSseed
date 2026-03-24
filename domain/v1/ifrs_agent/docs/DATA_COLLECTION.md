# 데이터 수집 전략 및 출처

## 📚 관련 문서

이 문서를 읽기 전/후에 다음 문서를 함께 참고하세요:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 시스템 아키텍처 이해
- [NODES.md](./NODES.md) - RAG Node의 데이터 추출 방법
- [DATA_ONTOLOGY.md](./DATA_ONTOLOGY.md) - Data Point 구조 이해
- [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) - 구현 가이드
- [IMAGE_PARSING.md](./IMAGE_PARSING.md) - 이미지 파싱 및 처리 가이드

---

## 1. 데이터 수집 개요

### 1.1 데이터 분류

| 구분 | 설명 | 예시 |
|------|------|------|
| **외부 데이터 (규칙)** | 공시 기준서, 표준, 가이드라인 | IFRS S1/S2, GRI, SASB |
| **내부 데이터 (팩트)** | 기업별 실제 데이터 | SR 보고서, 재무제표, 원천계 데이터 |
| **참조 데이터** | 벤치마크, 비교 데이터 | 경쟁사 보고서, 산업 평균 |

### 1.2 수집 원칙

1. **공시 데이터 우선**: 검증된 공시 데이터 활용
2. **출처 명시**: 모든 데이터에 출처와 기준일 기록
3. **법적 준수**: 저작권 및 이용약관 준수
4. **NDA 준수**: 기업 내부 데이터 보안 유지
5. **버전 관리**: 기준서 업데이트 추적

---

## 2. 외부 데이터 (기준서 및 표준)

### 2.1 IFRS 지속가능성 공시 기준서

| 기준서 | 출처 | 수집 방법 | 갱신 주기 |
|--------|------|----------|----------|
| **IFRS S1** | ifrs.org | PDF 다운로드 | 연 1회 |
| **IFRS S2** | ifrs.org | PDF 다운로드 | 연 1회 |
| **ISSB 가이던스** | ifrs.org | PDF 다운로드 | 수시 |

**수집 URL:**
```
https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/
```

**파싱 전략:**
```python
class IFRSDocumentParser:
    """IFRS 기준서 PDF 파싱"""
    
    def __init__(self, parser: LlamaParseClient):
        self.parser = parser
    
    async def parse_standard(self, pdf_path: str) -> Dict:
        """기준서 구조화 파싱"""
        # 1. 목차 추출
        toc = await self.parser.extract_toc(pdf_path)
        
        # 2. 섹션별 텍스트 추출
        sections = {}
        for section in toc:
            text = await self.parser.extract_section(
                pdf_path,
                section["start_page"],
                section["end_page"]
            )
            sections[section["title"]] = {
                "content": text,
                "requirements": self._extract_requirements(text),
                "examples": self._extract_examples(text)
            }
        
        # 3. DP 추출
        dps = self._extract_data_points(sections)
        
        return {
            "standard": self._identify_standard(pdf_path),
            "version": self._extract_version(pdf_path),
            "sections": sections,
            "data_points": dps
        }
    
    def _extract_requirements(self, text: str) -> List[str]:
        """요구사항 추출 (shall, must 등)"""
        patterns = [
            r"(?:shall|must|requires?)\s+([^.]+\.)",
            r"(?:기업은|보고기업은)\s+([^.]+(?:하여야|해야)\s*한다\.)"
        ]
        requirements = []
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            requirements.extend(matches)
        return requirements
```

### 2.2 GRI Standards

| 문서 | 출처 | 수집 방법 |
|------|------|----------|
| **GRI Universal Standards** | globalreporting.org | ZIP 다운로드 |
| **GRI Sector Standards** | globalreporting.org | PDF 다운로드 |
| **GRI Topic Standards** | globalreporting.org | PDF 다운로드 |
| **GRI Glossary** | globalreporting.org | PDF 다운로드 |

**수집 URL:**
```
https://www.globalreporting.org/standards/download-the-standards/
```

**GRI 지표 파싱:**
```python
class GRIParser:
    """GRI Standards 파싱"""
    
    INDICATOR_PATTERN = r"(GRI\s+\d+-\d+)"
    
    async def parse_gri_standards(self, zip_path: str) -> List[DataPoint]:
        """GRI 전체 표준 파싱"""
        dps = []
        
        # ZIP 압축 해제
        with zipfile.ZipFile(zip_path, 'r') as z:
            for filename in z.namelist():
                if filename.endswith('.pdf'):
                    content = await self._parse_pdf(z.read(filename))
                    indicators = self._extract_indicators(content)
                    dps.extend(indicators)
        
        return dps
    
    def _extract_indicators(self, content: str) -> List[DataPoint]:
        """GRI 지표 추출"""
        indicators = []
        matches = re.findall(self.INDICATOR_PATTERN, content)
        
        for match in matches:
            dp = self._create_dp_from_indicator(match, content)
            if dp:
                indicators.append(dp)
        
        return indicators
```

### 2.3 SASB Standards

| 문서 | 출처 | 수집 방법 |
|------|------|----------|
| **SASB Conceptual Framework** | sasb.ifrs.org | PDF 다운로드 |
| **Industry Standards** | sasb.ifrs.org | PDF/Excel 다운로드 |
| **Materiality Map** | sasb.ifrs.org | Interactive/CSV |

**수집 URL:**
```
https://sasb.ifrs.org/standards/download/
```

### 2.4 TCFD Recommendations

| 문서 | 출처 | 수집 방법 |
|------|------|----------|
| **TCFD Recommendations** | fsb-tcfd.org | PDF 다운로드 |
| **Implementation Guidance** | fsb-tcfd.org | PDF 다운로드 |
| **Technical Supplement** | fsb-tcfd.org | PDF 다운로드 |

**수집 URL:**
```
https://www.fsb-tcfd.org/recommendations/
```

### 2.5 ESRS (EU 기준)

| 문서 | 출처 | 수집 방법 |
|------|------|----------|
| **ESRS Set 1** | efrag.org | PDF 다운로드 |
| **ESRS Implementation** | efrag.org | PDF 다운로드 |

**수집 URL:**
```
https://www.efrag.org/lab6
```

### 2.6 한국 기준 (KSSB, KCGS)

| 문서 | 출처 | 수집 방법 |
|------|------|----------|
| **KSSB 지속가능성 공시기준** | kasb.or.kr | PDF 다운로드 |
| **KCGS ESG 평가기준** | cgs.or.kr | PDF 다운로드 |
| **KRX ESG 정보공개 가이던스** | krx.co.kr | PDF 다운로드 |

**수집 URL:**
```
한국회계기준원: https://www.kasb.or.kr/
한국기업지배구조원: https://www.cgs.or.kr/
한국거래소: https://esg.krx.co.kr/
```

---

## 3. 내부 데이터 (기업 데이터)

### 3.1 DART 전자공시

**수집 대상:**
- 사업보고서 (연간/반기/분기)
- 지속가능경영보고서
- 기업지배구조보고서
- 온실가스 배출량 및 에너지 사용량 정보

**수집 방법:**

```python
class DARTCrawler:
    """DART 전자공시 크롤러"""
    
    BASE_URL = "https://opendart.fss.or.kr"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = aiohttp.ClientSession()
    
    async def fetch_company_reports(
        self,
        corp_code: str,
        report_types: List[str],
        years: List[int]
    ) -> List[Document]:
        """기업 보고서 수집"""
        reports = []
        
        for year in years:
            for report_type in report_types:
                # 보고서 목록 조회
                report_list = await self._get_report_list(
                    corp_code, report_type, year
                )
                
                for report_info in report_list:
                    # 보고서 원문 다운로드
                    content = await self._download_report(report_info["rcept_no"])
                    
                    reports.append(Document(
                        source="DART",
                        corp_code=corp_code,
                        report_type=report_type,
                        fiscal_year=year,
                        content=content,
                        metadata=report_info
                    ))
        
        return reports
    
    async def _get_report_list(
        self,
        corp_code: str,
        report_type: str,
        year: int
    ) -> List[Dict]:
        """보고서 목록 API 호출"""
        params = {
            "crtfc_key": self.api_key,
            "corp_code": corp_code,
            "bgn_de": f"{year}0101",
            "end_de": f"{year}1231",
            "pblntf_ty": report_type
        }
        
        async with self.session.get(
            f"{self.BASE_URL}/api/list.json",
            params=params
        ) as response:
            data = await response.json()
            return data.get("list", [])
    
    async def fetch_sustainability_report(
        self,
        corp_code: str,
        year: int
    ) -> Optional[Document]:
        """지속가능경영보고서 수집"""
        # 지속가능경영보고서는 별도 검색 필요
        search_result = await self._search_sustainability_report(corp_code, year)
        
        if search_result:
            return await self._download_and_parse(search_result)
        
        return None
    
    async def extract_financial_data(
        self,
        corp_code: str,
        year: int
    ) -> Dict:
        """재무제표 데이터 추출"""
        # 재무제표 API 호출
        params = {
            "crtfc_key": self.api_key,
            "corp_code": corp_code,
            "bsns_year": str(year),
            "reprt_code": "11011"  # 사업보고서
        }
        
        async with self.session.get(
            f"{self.BASE_URL}/api/fnlttSinglAcntAll.json",
            params=params
        ) as response:
            data = await response.json()
            return self._parse_financial_data(data)
```

### 3.2 기업 홈페이지 크롤링

**수집 대상:**
- IR/ESG 섹션
- 지속가능경영보고서 (PDF)
- 기업 BI/CI 정보 (컬러, 로고)

**크롤링 구현:**

```python
class CompanyWebCrawler:
    """기업 홈페이지 크롤러"""
    
    def __init__(self):
        self.browser = None
    
    async def initialize(self):
        """Playwright 브라우저 초기화"""
        from playwright.async_api import async_playwright
        
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
    
    async def crawl_esg_section(self, company_url: str) -> Dict:
        """ESG 섹션 크롤링"""
        page = await self.browser.new_page()
        
        try:
            await page.goto(company_url)
            
            # ESG/지속가능경영 링크 탐색
            esg_links = await page.query_selector_all(
                'a:has-text("ESG"), a:has-text("지속가능"), a:has-text("sustainability")'
            )
            
            esg_content = {}
            for link in esg_links:
                href = await link.get_attribute("href")
                if href:
                    content = await self._crawl_page(href)
                    esg_content[href] = content
            
            # PDF 링크 추출
            pdf_links = await self._extract_pdf_links(page)
            
            return {
                "esg_content": esg_content,
                "pdf_links": pdf_links
            }
        
        finally:
            await page.close()
    
    async def extract_corporate_identity(self, company_url: str) -> Dict:
        """기업 BI/CI 추출"""
        page = await self.browser.new_page()
        
        try:
            await page.goto(company_url)
            
            # 주요 컬러 추출
            colors = await self._extract_colors(page)
            
            # 로고 추출
            logo_url = await self._extract_logo(page)
            
            return {
                "primary_colors": colors,
                "logo_url": logo_url
            }
        
        finally:
            await page.close()
    
    async def _extract_colors(self, page) -> List[str]:
        """페이지 주요 컬러 추출"""
        colors = await page.evaluate("""
            () => {
                const elements = document.querySelectorAll('*');
                const colorMap = {};
                
                elements.forEach(el => {
                    const style = window.getComputedStyle(el);
                    const bgColor = style.backgroundColor;
                    const color = style.color;
                    
                    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
                        colorMap[bgColor] = (colorMap[bgColor] || 0) + 1;
                    }
                });
                
                return Object.entries(colorMap)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([color]) => color);
            }
        """)
        return colors
```

### 3.3 원천계 연동 (ERP/EMS/HRIS/BI)

**연동 대상:**
- **ERP 시스템** (전사적 자원 관리): 재무, 인사, 구매, 에너지 데이터, **공급망 데이터**
- **환경관리시스템 (EMS)**: 배출량, 에너지 사용량, 물, 폐기물
- **환경안전보건시스템 (EHS)**: 산업재해, 안전 데이터
- **HRIS (인사정보 시스템)**: 임직원 현황, 다양성 데이터, 교육
- **BI/DW (데이터웨어하우스)**: 통합 KPI 데이터
- **공급망 관리 시스템 (SCM)**: 협력업체 정보, 구매 데이터, 물류 데이터

**공급망 데이터의 중요성:**
- **Scope 3 배출량 계산 필수**: 많은 기업에서 Scope 3가 전체 배출의 70-90%를 차지
- **IFRS S2 필수 공시**: Scope 3 배출량 공시가 필수/권장 사항
- **공급망 리스크 관리**: 협력업체 ESG 평가 및 리스크 관리
- **공급망 투명성**: 투자자 및 이해관계자 요구사항

**실제 기업들의 ESG-ERP 통합 현황:**

**글로벌 기업 사례:**
- **SAP 기업**: SAP Sustainability Control Tower를 통한 ERP 데이터 → ESG 지표 자동 변환
- **Oracle 기업**: Oracle Cloud ERP + Oracle Sustainability Cloud 통합 솔루션
- **대기업**: ERP에 ESG 전용 모듈 추가 설치, 실시간 ESG 대시보드 운영

**국내 기업 사례:**
- **대기업**: SAP/Oracle ERP에 ESG 모듈 추가, ERP 데이터를 ESG 플랫폼으로 자동 전송
- **중견기업**: ERP 데이터를 Excel로 추출 → ESG 플랫폼에 수동 업로드 (주기적 동기화)
- **중소기업**: ERP 미보유 또는 소규모 ERP 사용, Excel 기반 수동 입력

**API 연동 구현:**

```python
class SourceSystemConnector:
    """원천계 시스템 연동 (ERP/EMS/HRIS/BI)"""
    
    def __init__(self, config: Dict):
        self.config = config
        # ERP 시스템 클라이언트
        self.erp_clients = {
            "sap": SAPERPClient(config.get("sap", {})),
            "oracle": OracleERPClient(config.get("oracle", {})),
            "deajoong": DeajoongERPClient(config.get("deajoong", {}))
        }
        # EMS/EHS/HRIS 클라이언트
        self.ems_client = EMSClient(config.get("ems", {}))
        self.ehs_client = EHSClient(config.get("ehs", {}))
        self.hris_client = HRISClient(config.get("hris", {}))
        self.bi_client = BIClient(config.get("bi", {}))
    
    async def fetch_emission_data(
        self,
        company_id: str,
        year: int,
        scope: Literal["scope1", "scope2", "scope3"]
    ) -> Dict:
        """배출량 데이터 조회"""
        data = await self.ems_client.get_emissions(
            company_id=company_id,
            year=year,
            scope=scope
        )
        
        return {
            "dp_id": f"S2-29-{'abc'[int(scope[-1])-1]}",
            "value": data["total_emissions"],
            "unit": "tCO2e",
            "breakdown": data["breakdown"],
            "source": "EMS",
            "timestamp": data["timestamp"]
        }
    
    async def fetch_energy_data(
        self,
        company_id: str,
        year: int
    ) -> Dict:
        """에너지 사용량 데이터 조회"""
        data = await self.ems_client.get_energy_consumption(
            company_id=company_id,
            year=year
        )
        
        return {
            "total_energy": data["total"],
            "renewable_energy": data["renewable"],
            "renewable_ratio": data["renewable"] / data["total"] * 100,
            "breakdown_by_source": data["by_source"],
            "source": "EMS"
        }
    
    async def fetch_safety_data(
        self,
        company_id: str,
        year: int
    ) -> Dict:
        """산업안전 데이터 조회"""
        data = await self.ehs_client.get_safety_metrics(
            company_id=company_id,
            year=year
        )
        
        return {
            "ltir": data["lost_time_injury_rate"],
            "trir": data["total_recordable_injury_rate"],
            "fatalities": data["fatalities"],
            "near_misses": data["near_misses"],
            "source": "EHS"
        }
    
    async def fetch_employee_data(
        self,
        company_id: str,
        year: int
    ) -> Dict:
        """임직원 현황 데이터 조회"""
        data = await self.hr_client.get_employee_metrics(
            company_id=company_id,
            year=year
        )
        
        return {
            "total_employees": data["total"],
            "gender_breakdown": {
                "male": data["male"],
                "female": data["female"],
                "male_ratio": data["male"] / data["total"] * 100,
                "female_ratio": data["female"] / data["total"] * 100
            },
            "employment_type": {
                "permanent": data["permanent"],
                "temporary": data["temporary"]
            },
            "diversity": {
                "disabled": data["disabled"],
                "veterans": data["veterans"]
            },
            "source": "HR"
        }
    
    async def fetch_erp_data(
        self,
        company_id: str,
        year: int,
        erp_type: str = "sap"
    ) -> Dict:
        """ERP 시스템에서 ESG 관련 데이터 조회"""
        erp_client = self.erp_clients.get(erp_type)
        if not erp_client:
            raise ValueError(f"Unsupported ERP type: {erp_type}")
        
        # 재무 데이터
        financial_data = await erp_client.get_financial_data(
            company_id=company_id,
            year=year
        )
        
        # 에너지 데이터
        energy_data = await erp_client.get_energy_consumption(
            company_id=company_id,
            year=year
        )
        
        # 인사 데이터
        hr_data = await erp_client.get_hr_data(
            company_id=company_id,
            year=year
        )
        
        # 구매 데이터 (Scope 3 계산용)
        procurement_data = await erp_client.get_procurement_data(
            company_id=company_id,
            year=year
        )
        
        # 공급망 데이터 (협력업체 정보 및 Scope 3 계산용)
        supply_chain_data = await erp_client.get_supply_chain_data(
            company_id=company_id,
            year=year
        )
        
        return {
            "financial": {
                "revenue": financial_data.get("revenue"),
                "esg_investment": financial_data.get("esg_investment"),
                "source": f"{erp_type.upper()}_ERP"
            },
            "energy": {
                "total_energy_mwh": energy_data.get("total_energy"),
                "renewable_energy_mwh": energy_data.get("renewable_energy"),
                "renewable_ratio": energy_data.get("renewable_ratio"),
                "source": f"{erp_type.upper()}_ERP"
            },
            "hr": {
                "total_employees": hr_data.get("total_employees"),
                "gender_breakdown": hr_data.get("gender_breakdown"),
                "diversity": hr_data.get("diversity"),
                "source": f"{erp_type.upper()}_ERP"
            },
            "procurement": {
                "supplier_count": procurement_data.get("supplier_count"),
                "supplier_esg_evaluated": procurement_data.get("esg_evaluated_count"),
                "scope3_emissions": procurement_data.get("scope3_emissions"),
                "source": f"{erp_type.upper()}_ERP"
            },
            "supply_chain": {
                "supplier_list": supply_chain_data.get("supplier_list", []),
                "supplier_esg_scores": supply_chain_data.get("esg_scores", {}),
                "purchase_amount_by_category": supply_chain_data.get("purchase_by_category", {}),
                "logistics_data": supply_chain_data.get("logistics", {}),
                "scope3_calculation_data": supply_chain_data.get("scope3_data", {}),
                "source": f"{erp_type.upper()}_ERP"
            }
        }
    
    async def fetch_governance_data_from_erp(
        self,
        company_id: str,
        year: int,
        erp_type: str = "sap"
    ) -> Dict:
        """ERP 시스템에서 지배구조 데이터 조회"""
        erp_client = self.erp_clients.get(erp_type)
        if not erp_client:
            raise ValueError(f"Unsupported ERP type: {erp_type}")
        
        governance_data = await erp_client.get_governance_data(
            company_id=company_id,
            year=year
        )
        
        return {
            "board": {
                "total_members": governance_data.get("board_total"),
                "independent_directors": governance_data.get("independent_count"),
                "female_directors": governance_data.get("female_count"),
                "esg_committee": governance_data.get("esg_committee_exists"),
                "meetings_per_year": governance_data.get("meetings_count"),
                "source": f"{erp_type.upper()}_ERP"
            },
            "internal_control": {
                "audit_conducted": governance_data.get("audit_conducted"),
                "audit_team_size": governance_data.get("audit_team_size"),
                "independence": governance_data.get("audit_independence"),
                "source": f"{erp_type.upper()}_ERP"
            },
            "ethics": {
                "code_of_conduct": governance_data.get("code_exists"),
                "ethics_training_hours": governance_data.get("training_hours"),
                "violations": governance_data.get("violations_count"),
                "whistleblower_system": governance_data.get("whistleblower_exists"),
                "source": f"{erp_type.upper()}_ERP"
            },
            "risk_management": {
                "climate_risk_assessed": governance_data.get("climate_risk_assessed"),
                "cybersecurity_investment": governance_data.get("cyber_investment"),
                "data_breaches": governance_data.get("data_breaches"),
                "source": f"{erp_type.upper()}_ERP"
            }
        }
```

**ERP 시스템별 연동 방법:**

**1. SAP ERP 연동**
```python
class SAPERPClient:
    """SAP ERP 시스템 연동 클라이언트"""
    
    def __init__(self, config: Dict):
        self.endpoint = config["endpoint"]
        self.auth_token = config["auth_token"]
        self.odata_base = f"{self.endpoint}/sap/opu/odata/sap"
    
    async def get_energy_consumption(
        self,
        company_id: str,
        year: int
    ) -> Dict:
        """SAP에서 에너지 사용량 조회 (OData API)"""
        url = f"{self.odata_base}/ENERGY_CONSUMPTION_SRV"
        params = {
            "$filter": f"CompanyId eq '{company_id}' and Year eq {year}",
            "$select": "TotalEnergyMWh,RenewableEnergyMWh"
        }
        
        async with aiohttp.ClientSession() as session:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            async with session.get(url, params=params, headers=headers) as response:
                data = await response.json()
                return data.get("d", {}).get("results", [{}])[0]
    
    async def get_hr_data(self, company_id: str, year: int) -> Dict:
        """SAP HCM에서 인사 데이터 조회"""
        url = f"{self.odata_base}/HCM_EMPLOYEE_SRV"
        params = {
            "$filter": f"CompanyId eq '{company_id}' and Year eq {year}",
            "$select": "TotalEmployees,MaleCount,FemaleCount,DisabledCount"
        }
        
        async with aiohttp.ClientSession() as session:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            async with session.get(url, params=params, headers=headers) as response:
                data = await response.json()
                return data.get("d", {}).get("results", [{}])[0]
    
    async def get_supply_chain_data(
        self,
        company_id: str,
        year: int
    ) -> Dict:
        """SAP에서 공급망 데이터 조회
        
        SAP Supplier Relationship Management (SRM) 또는 SAP Ariba에서
        공급망 데이터를 조회합니다.
        """
        # 1. 협력업체 목록 조회
        supplier_url = f"{self.odata_base}/SUPPLIER_SRV"
        supplier_params = {
            "$filter": f"CompanyId eq '{company_id}' and Year eq {year}",
            "$select": "SupplierId,SupplierName,Industry,Country,PurchaseAmount,Category"
        }
        
        async with aiohttp.ClientSession() as session:
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # 협력업체 목록
            async with session.get(supplier_url, params=supplier_params, headers=headers) as response:
                supplier_data = await response.json()
                suppliers = supplier_data.get("d", {}).get("results", [])
            
            # 2. 협력업체 ESG 평가 결과 조회
            esg_scores = {}
            for supplier in suppliers:
                supplier_id = supplier.get("SupplierId")
                esg_url = f"{self.odata_base}/SUPPLIER_ESG_SRV"
                esg_params = {
                    "$filter": f"SupplierId eq '{supplier_id}' and Year eq {year}",
                    "$select": "ESGScore,EnvironmentalScore,SocialScore,GovernanceScore,EvaluationDate"
                }
                
                async with session.get(esg_url, params=esg_params, headers=headers) as response:
                    esg_data = await response.json()
                    esg_result = esg_data.get("d", {}).get("results", [{}])[0]
                    if esg_result:
                        esg_scores[supplier_id] = esg_result
            
            # 3. 구매 데이터 조회 (Scope 3 계산용)
            purchase_url = f"{self.odata_base}/PURCHASE_ORDER_SRV"
            purchase_params = {
                "$filter": f"CompanyId eq '{company_id}' and Year eq {year}",
                "$select": "Category,PurchaseAmount,Quantity,Unit,SupplierId,OriginCountry,DestinationCountry"
            }
            
            async with session.get(purchase_url, params=purchase_params, headers=headers) as response:
                purchase_data = await response.json()
                purchases = purchase_data.get("d", {}).get("results", [])
            
            # 4. 물류 데이터 조회 (운송 거리, 운송 수단)
            logistics_url = f"{self.odata_base}/LOGISTICS_SRV"
            logistics_params = {
                "$filter": f"CompanyId eq '{company_id}' and Year eq {year}",
                "$select": "SupplierId,OriginCountry,DestinationCountry,DistanceKm,TransportMode,CO2Emissions"
            }
            
            async with session.get(logistics_url, params=logistics_params, headers=headers) as response:
                logistics_data = await response.json()
                logistics = logistics_data.get("d", {}).get("results", [])
            
            return {
                "supplier_list": suppliers,
                "esg_scores": esg_scores,
                "purchase_by_category": self._aggregate_purchases_by_category(purchases),
                "logistics": logistics,
                "scope3_data": self._prepare_scope3_calculation_data(purchases, logistics)
            }
    
    def _aggregate_purchases_by_category(self, purchases: List[Dict]) -> Dict:
        """카테고리별 구매 데이터 집계"""
        aggregated = {}
        for purchase in purchases:
            category = purchase.get("Category", "unknown")
            if category not in aggregated:
                aggregated[category] = {
                    "total_amount": 0,
                    "total_quantity": 0,
                    "supplier_count": set()
                }
            aggregated[category]["total_amount"] += purchase.get("PurchaseAmount", 0)
            aggregated[category]["total_quantity"] += purchase.get("Quantity", 0)
            aggregated[category]["supplier_count"].add(purchase.get("SupplierId"))
        
        # set을 count로 변환
        for category in aggregated:
            aggregated[category]["supplier_count"] = len(aggregated[category]["supplier_count"])
        
        return aggregated
    
    def _prepare_scope3_calculation_data(
        self,
        purchases: List[Dict],
        logistics: List[Dict]
    ) -> Dict:
        """Scope 3 계산용 데이터 준비"""
        return {
            "purchases": purchases,
            "logistics": logistics,
            "calculation_method": "spend_based",  # 또는 "distance_based", "supplier_specific"
            "emission_factors": {
                # 카테고리별 배출 계수 (예시)
                "raw_materials": 0.5,  # tCO2e/백만원
                "components": 0.3,
                "services": 0.1,
                "logistics": 0.2
            }
        }
```

**2. Oracle ERP 연동**
```python
class OracleERPClient:
    """Oracle ERP 시스템 연동 클라이언트"""
    
    def __init__(self, config: Dict):
        self.endpoint = config["endpoint"]
        self.client_id = config["client_id"]
        self.client_secret = config["client_secret"]
        self.token = None
    
    async def authenticate(self):
        """OAuth 2.0 인증"""
        url = f"{self.endpoint}/oauth/token"
        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, data=data) as response:
                result = await response.json()
                self.token = result["access_token"]
    
    async def get_energy_data(self, company_id: str, year: int) -> Dict:
        """Oracle Cloud ERP에서 에너지 데이터 조회 (REST API)"""
        if not self.token:
            await self.authenticate()
        
        url = f"{self.endpoint}/fscmRestApi/resources/11.13.18.05.0/energyData"
        params = {
            "companyId": company_id,
            "year": year
        }
        headers = {"Authorization": f"Bearer {self.token}"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, headers=headers) as response:
                return await response.json()
```

**3. 더존 ERP 연동 (국내)**
```python
class DeajoongERPClient:
    """더존 ERP 시스템 연동 클라이언트"""
    
    def __init__(self, config: Dict):
        self.endpoint = config["endpoint"]
        self.api_key = config["api_key"]
        self.api_secret = config["api_secret"]
    
    async def get_energy_data(self, company_id: str, year: int) -> Dict:
        """더존 ERP에서 에너지 데이터 조회 (REST API)"""
        url = f"{self.endpoint}/api/v1/energy"
        params = {
            "company_id": company_id,
            "year": year
        }
        headers = {
            "X-API-Key": self.api_key,
            "X-API-Secret": self.api_secret
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, headers=headers) as response:
                data = await response.json()
                # 한국어 필드명을 영어로 변환
                return {
                    "total_energy_mwh": data.get("총에너지사용량_MWh"),
                    "renewable_energy_mwh": data.get("재생에너지_MWh"),
                    "renewable_ratio": data.get("재생에너지비율_퍼센트")
                }
```

**4. 공급망 데이터 수집 상세**

공급망 데이터는 Scope 3 배출량 계산과 협력업체 ESG 관리에 필수적입니다.

**수집해야 할 공급망 데이터:**

1. **협력업체 기본 정보**:
   - 업체명, 업종, 국가, 거래 금액
   - 거래 물량, 거래 기간
   - 계약 유형 (직접/간접 공급업체)

2. **협력업체 ESG 평가 결과**:
   - ESG 평가 점수 (환경/사회/지배구조)
   - 평가 항목별 점수
   - 평가 시기 및 평가 기관

3. **구매 데이터 (Scope 3 계산용)**:
   - 구매 물량 (카테고리별: 원자재, 부품, 서비스 등)
   - 구매 금액 (Spend-based 계산용)
   - 구매 국가 (국가별 배출 계수 적용)

4. **물류 데이터 (Scope 3 계산용)**:
   - 운송 거리 (출발지 → 도착지)
   - 운송 수단 (선박, 항공, 트럭, 철도)
   - 운송 배출량 (이미 계산된 경우)

5. **공급망 리스크 데이터**:
   - 리스크 등급 (높음/중간/낮음)
   - 리스크 유형 (환경/사회/지배구조)
   - 리스크 완화 조치

**SAP ERP 공급망 데이터 수집 예시:**

```python
async def get_supply_chain_data(
    self, company_id: str, year: int
) -> Dict:
    """SAP에서 공급망 데이터 조회
    
    SAP Supplier Relationship Management (SRM) 또는 SAP Ariba에서
    공급망 데이터를 조회합니다.
    """
    # 1. 협력업체 목록 조회
    supplier_url = f"{self.odata_base}/SUPPLIER_SRV"
    supplier_params = {
        "$filter": f"CompanyId eq '{company_id}' and Year eq {year}",
        "$select": "SupplierId,SupplierName,Industry,Country,PurchaseAmount,Category"
    }
    
    # 2. 협력업체 ESG 평가 결과 조회
    esg_url = f"{self.odata_base}/SUPPLIER_ESG_SRV"
    
    # 3. 구매 데이터 조회 (Scope 3 계산용)
    purchase_url = f"{self.odata_base}/PURCHASE_ORDER_SRV"
    
    # 4. 물류 데이터 조회 (운송 거리, 운송 수단)
    logistics_url = f"{self.odata_base}/LOGISTICS_SRV"
    
    return {
        "supplier_list": suppliers,
        "esg_scores": esg_scores,
        "purchase_by_category": aggregated_purchases,
        "logistics": logistics,
        "scope3_calculation_data": scope3_data
    }
```

**5. 데이터 매핑 자동화**
```python
class ERPFieldMapper:
    """ERP 필드를 IFRS S2/GRI Data Point로 자동 매핑"""
    
    def __init__(self, mapping_service):
        self.mapping_service = mapping_service
    
    async def auto_map_erp_fields(
        self,
        erp_fields: List[str],
        target_standard: str = "IFRS_S2"
    ) -> Dict[str, str]:
        """ERP 필드명을 IFRS/GRI Data Point로 자동 매핑"""
        mappings = {}
        
        for erp_field in erp_fields:
            # 벡터 검색 + 구조적 매핑
            suggested_dp = await self.mapping_service.suggest_mapping(
                source=erp_field,
                target_standard=target_standard,
                vector_threshold=0.70,
                structural_threshold=0.50
            )
            
            if suggested_dp and suggested_dp["final_score"] >= 0.75:
                mappings[erp_field] = suggested_dp["target_dp_id"]
        
        return mappings
```

**5. 배치 동기화 스케줄러**
```python
class ERPSyncScheduler:
    """ERP 데이터 동기화 스케줄러"""
    
    def __init__(self, connector: SourceSystemConnector):
        self.connector = connector
        self.scheduler = AsyncIOScheduler()
    
    def setup_sync_schedule(
        self,
        company_id: str,
        sync_frequency: str = "monthly",
        sync_time: str = "09:00"
    ):
        """동기화 스케줄 설정"""
        if sync_frequency == "daily":
            self.scheduler.add_job(
                self._sync_daily,
                'cron',
                hour=int(sync_time.split(":")[0]),
                minute=int(sync_time.split(":")[1]),
                args=[company_id]
            )
        elif sync_frequency == "monthly":
            self.scheduler.add_job(
                self._sync_monthly,
                'cron',
                day=1,
                hour=int(sync_time.split(":")[0]),
                minute=int(sync_time.split(":")[1]),
                args=[company_id]
            )
    
    async def _sync_daily(self, company_id: str):
        """일일 동기화"""
        year = datetime.now().year
        data = await self.connector.fetch_erp_data(company_id, year)
        # 플랫폼에 저장
        await self._save_to_platform(data)
    
    async def _sync_monthly(self, company_id: str):
        """월간 동기화"""
        year = datetime.now().year
        data = await self.connector.fetch_erp_data(company_id, year)
        await self._save_to_platform(data)
```

### 3.4 범위 지정 파싱 (Targeted Section Parsing)

LlamaParse의 Instruction 기능을 활용하여 특정 섹션만 핀포인트로 추출합니다.

```python
class TargetedPDFParser:
    """범위 지정 PDF 파서"""
    
    def __init__(self, llama_parse_client: LlamaParseClient):
        self.client = llama_parse_client
    
    async def extract_section_by_toc(
        self,
        pdf_path: str,
        section_keywords: List[str],
        content_types: List[str] = ["text", "table"]
    ) -> Dict:
        """목차 기반 섹션 추출"""
        
        # 1. 목차 추출
        toc = await self.client.extract_toc(pdf_path)
        
        # 2. 대상 섹션 페이지 범위 식별
        target_pages = self._find_section_pages(toc, section_keywords)
        
        if not target_pages:
            return {"error": "Section not found"}
        
        # 3. Instruction 생성
        instruction = self._build_instruction(
            section_keywords,
            content_types
        )
        
        # 4. 범위 지정 파싱
        result = await self.client.parse(
            pdf_path,
            parsing_instruction=instruction,
            page_range=(target_pages["start"], target_pages["end"]),
            table_parsing_mode="markdown" if "table" in content_types else None
        )
        
        return {
            "section": section_keywords,
            "pages": target_pages,
            "content": result.text,
            "tables": result.tables if "table" in content_types else []
        }
    
    def _build_instruction(
        self,
        keywords: List[str],
        content_types: List[str]
    ) -> str:
        """파싱 Instruction 생성"""
        instruction = f"""
        Extract content from sections containing: {', '.join(keywords)}
        
        Requirements:
        - Extract: {', '.join(content_types)}
        - For tables: Convert to markdown format with headers
        - For text: Preserve paragraph structure
        - Include page numbers for citations
        
        Example instruction:
        "Extract all tables from pages containing 'Governance' in the table of contents.
        Convert tables to markdown format with clear headers."
        """
        return instruction
    
    def _find_section_pages(
        self,
        toc: List[Dict],
        keywords: List[str]
    ) -> Optional[Dict]:
        """목차에서 섹션 페이지 범위 찾기"""
        for entry in toc:
            title_lower = entry["title"].lower()
            if any(kw.lower() in title_lower for kw in keywords):
                return {
                    "start": entry["start_page"],
                    "end": entry["end_page"],
                    "title": entry["title"]
                }
        return None

# 사용 예시
parser = TargetedPDFParser(llama_parse_client)

# Governance 섹션의 표만 추출
governance_tables = await parser.extract_section_by_toc(
    pdf_path="sr_report_2024.pdf",
    section_keywords=["Governance", "지배구조"],
    content_types=["table"]
)

# 기후 리스크 섹션의 텍스트와 표 모두 추출
climate_section = await parser.extract_section_by_toc(
    pdf_path="sr_report_2024.pdf",
    section_keywords=["Climate Risk", "기후 리스크"],
    content_types=["text", "table"]
)
```

### 3.5 데이터북 크롤링

**수집 대상:**
- SR 보고서 데이터북 (정량 데이터 표)
- ESG 데이터 시트

**파싱 구현:**

```python
class DataBookParser:
    """SR 보고서 데이터북 파싱"""
    
    def __init__(self, parser: LlamaParseClient):
        self.parser = parser
    
    async def parse_databook(self, pdf_path: str) -> List[Dict]:
        """데이터북 표 추출"""
        # 1. 표 추출
        tables = await self.parser.extract_tables(pdf_path)
        
        # 2. 표 구조화
        structured_data = []
        for table in tables:
            parsed = self._parse_table(table)
            if parsed:
                structured_data.append(parsed)
        
        return structured_data
    
    def _parse_table(self, table: Dict) -> Optional[Dict]:
        """표 데이터 구조화"""
        # 헤더 분석
        headers = table.get("headers", [])
        rows = table.get("rows", [])
        
        if not headers or not rows:
            return None
        
        # 연도 컬럼 식별
        year_columns = self._identify_year_columns(headers)
        
        # 지표 컬럼 식별
        indicator_column = self._identify_indicator_column(headers)
        
        # 데이터 추출
        data = []
        for row in rows:
            indicator_name = row[indicator_column]
            values = {}
            
            for year, col_idx in year_columns.items():
                if col_idx < len(row):
                    values[year] = self._parse_value(row[col_idx])
            
            data.append({
                "indicator": indicator_name,
                "values": values,
                "unit": self._extract_unit(indicator_name)
            })
        
        return {
            "table_title": table.get("title"),
            "data": data
        }
    
    def _identify_year_columns(self, headers: List[str]) -> Dict[int, int]:
        """연도 컬럼 식별"""
        year_pattern = r"20\d{2}"
        year_columns = {}
        
        for idx, header in enumerate(headers):
            match = re.search(year_pattern, header)
            if match:
                year = int(match.group())
                year_columns[year] = idx
        
        return year_columns
```

---

## 4. 참조 데이터 (벤치마크)

### 4.1 미디어 크롤링

**수집 대상:**
- 기업 관련 ESG 뉴스
- 중대 이슈 기사
- 그린워싱 관련 보도

**구현:**

```python
class MediaCrawler:
    """미디어 기사 크롤러"""
    
    NEWS_SOURCES = [
        {"name": "네이버뉴스", "url": "https://search.naver.com/search.naver"},
        {"name": "구글뉴스", "url": "https://news.google.com/search"}
    ]
    
    async def search_news(
        self,
        company_name: str,
        keywords: List[str],
        date_range: Tuple[datetime, datetime]
    ) -> List[Dict]:
        """뉴스 검색"""
        articles = []
        
        for source in self.NEWS_SOURCES:
            results = await self._search_source(
                source,
                company_name,
                keywords,
                date_range
            )
            articles.extend(results)
        
        # 중복 제거
        articles = self._deduplicate(articles)
        
        # 감성 분석
        for article in articles:
            article["sentiment"] = await self._analyze_sentiment(article["content"])
        
        return articles
    
    async def identify_material_issues(
        self,
        company_name: str,
        year: int
    ) -> List[Dict]:
        """중대 이슈 식별"""
        # ESG 키워드로 뉴스 검색
        esg_keywords = [
            "환경오염", "탄소배출", "기후변화",
            "노동", "인권", "산업재해",
            "지배구조", "횡령", "배임"
        ]
        
        articles = await self.search_news(
            company_name,
            esg_keywords,
            (datetime(year, 1, 1), datetime(year, 12, 31))
        )
        
        # 이슈 클러스터링
        issues = self._cluster_issues(articles)
        
        # 중대성 평가
        material_issues = []
        for issue in issues:
            materiality = self._assess_materiality(issue)
            if materiality > 0.5:
                material_issues.append({
                    "issue": issue["topic"],
                    "articles": issue["articles"],
                    "materiality_score": materiality,
                    "category": issue["category"]
                })
        
        return material_issues
```

### 4.2 경쟁사 보고서 수집

```python
class CompetitorAnalyzer:
    """경쟁사 분석"""
    
    def __init__(self, dart_crawler: DARTCrawler):
        self.dart = dart_crawler
    
    async def collect_competitor_reports(
        self,
        industry: str,
        year: int,
        top_n: int = 5
    ) -> List[Document]:
        """경쟁사 SR 보고서 수집"""
        # 산업별 주요 기업 조회
        competitors = await self._get_industry_leaders(industry, top_n)
        
        reports = []
        for company in competitors:
            report = await self.dart.fetch_sustainability_report(
                company["corp_code"],
                year
            )
            if report:
                reports.append(report)
        
        return reports
    
    async def benchmark_metrics(
        self,
        company_data: Dict,
        competitor_reports: List[Document],
        metrics: List[str]
    ) -> Dict:
        """지표 벤치마킹"""
        benchmark = {}
        
        for metric in metrics:
            company_value = company_data.get(metric)
            competitor_values = []
            
            for report in competitor_reports:
                value = self._extract_metric(report, metric)
                if value:
                    competitor_values.append(value)
            
            if competitor_values:
                benchmark[metric] = {
                    "company_value": company_value,
                    "industry_avg": sum(competitor_values) / len(competitor_values),
                    "industry_min": min(competitor_values),
                    "industry_max": max(competitor_values),
                    "percentile": self._calculate_percentile(
                        company_value, competitor_values
                    )
                }
        
        return benchmark
```

---

## 5. 데이터 파이프라인

### 5.1 수집 파이프라인 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                     Data Collection Pipeline                     │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   Standards   │      │   Corporate   │      │   Reference   │
│   Collector   │      │   Collector   │      │   Collector   │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│    Parser     │      │    Parser     │      │    Parser     │
│  (PDF/HTML)   │      │  (PDF/Excel)  │      │  (News/Web)   │
└───────┬───────┘      └───────┬───────┘      └───────┬───────┘
        │                      │                      │
        │                      │                      │
        │         ┌─────────────┴─────────────┐        │
        │         │                           │        │
        │         ▼                           ▼        │
        │  ┌───────────────┐        ┌───────────────┐│
        │  │ ERP/EMS/HRIS  │        │  File Upload  ││
        │  │   Connector   │        │   (FTP/Cloud) ││
        │  └───────┬───────┘        └───────┬───────┘│
        │          │                         │        │
        └──────────┼─────────────────────────┼────────┘
                   │                         │
                   └───────────┬─────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Data Validator    │
                    │  (Schema Check)     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Data Enricher     │
                    │  (DP Mapping)       │
                    │  (ERP Field → DP)   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Vector Store      │
                    │  (Embedding)        │
                    └─────────────────────┘
```

### 5.2 파이프라인 구현

```python
class DataCollectionPipeline:
    """데이터 수집 파이프라인"""
    
    def __init__(
        self,
        standards_collector: StandardsCollector,
        corporate_collector: CorporateCollector,
        reference_collector: ReferenceCollector,
        parser: DocumentParser,
        validator: DataValidator,
        enricher: DataEnricher,
        vector_store: VectorStore,
        erp_connector: SourceSystemConnector = None  # ERP 연동 추가
    ):
        self.standards = standards_collector
        self.corporate = corporate_collector
        self.reference = reference_collector
        self.parser = parser
        self.validator = validator
        self.enricher = enricher
        self.vector_store = vector_store
        self.erp_connector = erp_connector  # ERP 연동 클라이언트
    
    async def run_full_pipeline(
        self,
        company_id: str,
        year: int
    ) -> PipelineResult:
        """전체 파이프라인 실행"""
        results = PipelineResult()
        
        # 1. 데이터 수집
        standards_docs = await self.standards.collect_all()
        corporate_docs = await self.corporate.collect(company_id, year)
        reference_docs = await self.reference.collect(company_id, year)
        
        # ERP/EMS/HRIS 시스템 데이터 수집 (연동 설정된 경우)
        erp_docs = []
        if self.erp_connector:
            try:
                erp_data = await self.erp_connector.fetch_erp_data(company_id, year)
                governance_data = await self.erp_connector.fetch_governance_data_from_erp(company_id, year)
                ems_data = await self.erp_connector.fetch_emission_data(company_id, year, "scope1")
                hr_data = await self.erp_connector.fetch_employee_data(company_id, year)
                
                # ERP 데이터를 Document 형식으로 변환
                erp_docs = self._convert_erp_data_to_documents(
                    erp_data, governance_data, ems_data, hr_data
                )
            except Exception as e:
                results.add_warning(f"ERP data collection failed: {e}")
        
        all_docs = standards_docs + corporate_docs + reference_docs + erp_docs
        
        # 2. 파싱
        parsed_docs = []
        for doc in all_docs:
            try:
                parsed = await self.parser.parse(doc)
                parsed_docs.append(parsed)
            except Exception as e:
                results.add_error(f"Parsing failed for {doc.source}: {e}")
        
        # 3. 검증
        validated_docs = []
        for doc in parsed_docs:
            validation_result = self.validator.validate(doc)
            if validation_result.is_valid:
                validated_docs.append(doc)
            else:
                results.add_warning(
                    f"Validation issues for {doc.source}: {validation_result.issues}"
                )
        
        # 4. 데이터 보강 (DP 매핑)
        enriched_docs = []
        for doc in validated_docs:
            enriched = self.enricher.enrich(doc)
            enriched_docs.append(enriched)
        
        # 5. 벡터 저장소 저장
        await self.vector_store.upsert(enriched_docs)
        
        results.documents_processed = len(enriched_docs)
        results.success = True
        
        return results
    
    def _convert_erp_data_to_documents(
        self,
        erp_data: Dict,
        governance_data: Dict,
        ems_data: Dict,
        hr_data: Dict
    ) -> List[Document]:
        """ERP 데이터를 Document 형식으로 변환"""
        documents = []
        
        # 재무 데이터
        if erp_data.get("financial"):
            documents.append(Document(
                source="ERP",
                content=json.dumps(erp_data["financial"]),
                metadata={"type": "financial", "source": "ERP"}
            ))
        
        # 에너지 데이터
        if erp_data.get("energy"):
            documents.append(Document(
                source="ERP",
                content=json.dumps(erp_data["energy"]),
                metadata={"type": "energy", "source": "ERP"}
            ))
        
        # 지배구조 데이터
        if governance_data:
            documents.append(Document(
                source="ERP",
                content=json.dumps(governance_data),
                metadata={"type": "governance", "source": "ERP"}
            ))
        
        # 환경 데이터 (EMS)
        if ems_data:
            documents.append(Document(
                source="EMS",
                content=json.dumps(ems_data),
                metadata={"type": "emission", "source": "EMS"}
            ))
        
        # 인사 데이터 (HRIS)
        if hr_data:
            documents.append(Document(
                source="HRIS",
                content=json.dumps(hr_data),
                metadata={"type": "hr", "source": "HRIS"}
            ))
        
        return documents
    
    async def run_incremental_update(
        self,
        company_id: str,
        since: datetime
    ) -> PipelineResult:
        """증분 업데이트"""
        # 변경된 문서만 수집
        changed_docs = await self._get_changed_documents(company_id, since)
        
        # 파이프라인 실행
        return await self._process_documents(changed_docs)
```

### 5.3 스케줄링

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

class DataCollectionScheduler:
    """데이터 수집 스케줄러"""
    
    def __init__(self, pipeline: DataCollectionPipeline):
        self.pipeline = pipeline
        self.scheduler = AsyncIOScheduler()
    
    def setup_schedules(self):
        """스케줄 설정"""
        # 기준서 업데이트: 월 1회
        self.scheduler.add_job(
            self._update_standards,
            'cron',
            day=1,
            hour=2
        )
        
        # DART 공시: 일 1회
        self.scheduler.add_job(
            self._update_dart,
            'cron',
            hour=6
        )
        
        # 미디어 크롤링: 6시간마다
        self.scheduler.add_job(
            self._update_media,
            'interval',
            hours=6
        )
        
        # ERP 데이터 동기화: 사용자 설정에 따라 (일일/주간/월간)
        # 동기화 주기는 사용자가 플랫폼에서 설정한 값에 따라 동적 설정
        # 예: 매월 1일 09:00
        self.scheduler.add_job(
            self._sync_erp_data,
            'cron',
            day=1,
            hour=9
        )
    
    def start(self):
        """스케줄러 시작"""
        self.scheduler.start()
    
    async def _sync_erp_data(self):
        """ERP 데이터 동기화 (스케줄 실행)"""
        # 모든 연동된 기업에 대해 ERP 데이터 동기화
        companies = await self._get_connected_companies()
        
        for company_id in companies:
            try:
                year = datetime.now().year
                await self.pipeline.run_incremental_update(
                    company_id=company_id,
                    since=datetime.now() - timedelta(days=30)
                )
            except Exception as e:
                logger.error(f"ERP sync failed for {company_id}: {e}")
```

---

## 6. 데이터 품질 관리

### 6.1 ERP 데이터 검증 및 수정 요청 파이프라인

ERP 시스템에서 ESG 플랫폼으로 데이터가 들어올 때, 전처리, 검증, 이상 탐지 및 수정 요청을 자동화하는 파이프라인입니다.

**실제 기업들의 표준 방식:**
- **SAP Green Ledger**: ERP 트랜잭션 기반 데이터 수집 → 재무 수준의 정확성 검증 → 이상 탐지
- **SAP Sustainability Control Tower**: 데이터 정확성 검증, 완전성 점검, 워크플로우, 기결산 프로세스
- **Oracle Fusion Cloud Sustainability**: 자동 수집 → 자동 검증 → 감사 가능한 데이터 기록

**우리 플랫폼의 고도화된 접근:**
- 전처리: Python 로직 (빠르고 정확)
- 검증: Python 로직 + 규칙 기반 (표준 방식)
  - 시계열 기반 이상치 탐지 (다년도 추세 분석, 계절성 분석, Isolation Forest, LSTM 예측)
  - 물리적 임계치 검증 (에너지 효율 한계, 배출 강도 최소값, Scope 3 합리성)
  - 다차원 상관관계 검증 (매출-배출량, 임직원수-에너지, 생산량-배출량, 매출-ESG투자)
- 이상 탐지: 전년도 비교 + 시계열 분석 + 상관관계 분석 + LLM 기반 맥락 분석 (고도화)
- 수정 요청: LLM 기반 지능형 요청 생성 (고도화)

#### 6.1.1 전체 파이프라인 흐름

```
ERP 시스템 (SAP/Oracle/더존)
    ↓
[1. 데이터 수집] (SourceSystemConnector)
    ↓
[2. 전처리] (ERPDataPreprocessor - Python 로직)
    - 데이터 타입 변환
    - 단위 통일 (kWh → MWh, kg → t)
    - 필드명 매핑 (ERP 필드 → ESG 필드)
    - 누락값 처리
    - 중복 제거
    ↓
[3. 검증] (ERPDataValidator - Python 로직)
    - 필수 필드 검증
    - 범위 검증 (0-100%, 최소/최대값)
    - 일관성 검증 (합계, 비율)
    - 전년도 비교 (이상 수치 탐지)
    - 업계 평균 비교
    - 시계열 기반 이상치 탐지 (다년도 추세 분석, 계절성 분석, Isolation Forest, LSTM 예측)
    - 물리적 임계치 검증 (에너지 효율 한계, 배출 강도 최소값, Scope 3 합리성)
    - 다차원 상관관계 검증 (매출-배출량, 임직원수-에너지, 생산량-배출량, 매출-ESG투자)
    ↓
[4. 이상 탐지 에이전트] (AnomalyDetectionAgent - LLM)
    - 전년도 대비 급격한 변화 분석
    - 맥락 기반 정상/오류 구분
    - 원인 추론
    - 확인/수정 필요 여부 판단
    ↓
[5. 수정 요청 에이전트] (CorrectionRequestAgent - LLM)
    - 구체적이고 실행 가능한 수정 요청 생성
    - 심각도 분류 (critical/high/medium/low)
    - 수정 방법 제안
    - 기한 설정
    ↓
[6. 사용자 알림 및 처리] (4단계 역할 구조 기반)
    - 이메일/앱 알림
    - 플랫폼에서 확인/수정
    - Workflow 승인 프로세스:
      • 현업팀 (역할 3) → 데이터 입력 및 검토 요청
      • ESG팀 (역할 2) → 데이터 검토 및 승인 요청
      • 최종 승인권자 (역할 1) → 최종 승인 및 저장
```

#### 6.1.2 전처리 모듈 (Python 로직)

```python
class ERPDataPreprocessor:
    """ERP 데이터 전처리 (Python 로직)"""
    
    def preprocess(self, raw_data: Dict) -> Dict:
        """ERP 원시 데이터 전처리"""
        # 1. 데이터 타입 변환
        processed = self._convert_data_types(raw_data)
        
        # 2. 단위 통일 (kWh → MWh, kg → t, m³ → cubic_meter)
        processed = self._normalize_units(processed)
        
        # 3. 필드명 매핑 (ERP 필드 → ESG 필드)
        processed = self._map_fields(processed)
        
        # 4. 누락값 처리 (전년도 값으로 채우기)
        processed = self._handle_missing_values(processed)
        
        # 5. 중복 제거
        processed = self._deduplicate(processed)
        
        return processed
```

#### 6.1.3 검증 모듈 (Python 로직)

```python
class ERPDataValidator:
    """ERP 데이터 검증 (Python 로직)"""
    
    def validate(self, processed_data: Dict, company_id: str, year: int) -> Dict:
        """데이터 검증"""
        validation_result = {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "anomalies": []
        }
        
        # 1. 필수 필드 검증
        missing_fields = self._check_required_fields(processed_data)
        
        # 2. 범위 검증 (0-100%, 최소/최대값)
        range_errors = self._check_value_ranges(processed_data)
        
        # 3. 일관성 검증 (합계, 비율)
        consistency_errors = self._check_consistency(processed_data)
        
        # 4. 전년도 비교 (이상 수치 탐지)
        anomalies = self._compare_with_previous_year(
            processed_data, company_id, year
        )
        
        # 5. 업계 평균 비교
        industry_comparison = self._compare_with_industry_average(
            processed_data, company_id, year
        )
        
        # 6. 시계열 기반 이상치 탐지 (다년도 추세 분석)
        time_series_anomalies = self._detect_time_series_anomalies(
            processed_data, company_id, year
        )
        validation_result["anomalies"].extend(time_series_anomalies)
        
        # 7. 물리적 임계치 검증
        physical_threshold_errors = self._validate_physical_thresholds(
            processed_data, company_id
        )
        validation_result["errors"].extend(physical_threshold_errors)
        
        # 8. 다차원 상관관계 검증
        correlation_anomalies = self._validate_multi_dimensional_correlations(
            processed_data, company_id, year
        )
        validation_result["anomalies"].extend(correlation_anomalies)
        
        return validation_result
    
    def _compare_with_previous_year(
        self, data: Dict, company_id: str, year: int
    ) -> List[Dict]:
        """전년도와 비교하여 이상 수치 탐지"""
        anomalies = []
        previous_year = year - 1
        prev_data = self._get_previous_year_data(company_id, previous_year)
        
        for field, current_value in data.items():
            if not isinstance(current_value, (int, float)):
                continue
            
            prev_value = prev_data.get(field)
            if prev_value is None or prev_value == 0:
                continue
            
            # 변화율 계산
            change_rate = ((current_value - prev_value) / prev_value) * 100
            
            # 이상 수치 기준 (필드별 임계값)
            threshold = self._get_anomaly_threshold(field)
            
            if abs(change_rate) > threshold:
                anomalies.append({
                    "field": field,
                    "current_value": current_value,
                    "previous_value": prev_value,
                    "change_rate": change_rate,
                    "threshold": threshold,
                    "severity": "high" if abs(change_rate) > threshold * 2 else "medium"
                })
        
        return anomalies
    
    def _detect_time_series_anomalies(
        self,
        data: Dict,
        company_id: str,
        year: int
    ) -> List[Dict]:
        """시계열 기반 이상치 탐지 (다년도 추세 분석)"""
        anomalies = []
        
        # 과거 3-5년 데이터 조회
        historical_data = self._get_historical_data(company_id, year, years_back=5)
        
        if len(historical_data) < 3:
            return anomalies  # 데이터가 부족하면 스킵
        
        for field, current_value in data.items():
            if not isinstance(current_value, (int, float)):
                continue
            
            # 시계열 데이터 추출
            time_series = [
                {"year": d["year"], "value": d.get(field, 0)}
                for d in historical_data
            ]
            time_series.append({"year": year, "value": current_value})
            
            # 1. 추세 분석 (선형 회귀)
            trend = self._analyze_trend(time_series, field)
            if trend["is_anomalous"]:
                anomalies.append({
                    "field": field,
                    "type": "trend_anomaly",
                    "current_value": current_value,
                    "expected_value": trend["expected_value"],
                    "trend": trend["direction"],
                    "severity": "medium",
                    "description": f"{field}의 추세가 과거 패턴과 크게 벗어남"
                })
            
            # 2. 계절성 분석 (분기별, 월별 패턴)
            seasonality = self._analyze_seasonality(time_series, field)
            if seasonality["is_anomalous"]:
                anomalies.append({
                    "field": field,
                    "type": "seasonality_anomaly",
                    "current_value": current_value,
                    "expected_seasonal_value": seasonality["expected_value"],
                    "severity": "low",
                    "description": f"{field}가 계절적 패턴과 다름"
                })
            
            # 3. Isolation Forest 기반 이상치 탐지
            isolation_anomalies = self._isolation_forest_detection(time_series, field)
            anomalies.extend(isolation_anomalies)
            
            # 4. LSTM 기반 예측과 실제값 비교
            if len(time_series) >= 4:  # 최소 4년 데이터 필요
                predicted = self._lstm_predict(time_series[:-1], field)  # 마지막 제외하고 예측
                prediction_error = abs(current_value - predicted) / predicted if predicted > 0 else 0
                
                if prediction_error > 0.3:  # 30% 이상 차이
                    anomalies.append({
                        "field": field,
                        "type": "prediction_anomaly",
                        "current_value": current_value,
                        "predicted_value": predicted,
                        "prediction_error": prediction_error,
                        "severity": "high",
                        "description": f"{field}가 시계열 예측값과 크게 다름"
                    })
        
        return anomalies
    
    def _validate_physical_thresholds(
        self,
        data: Dict,
        company_id: str
    ) -> List[str]:
        """물리적 임계치 검증"""
        errors = []
        
        # 회사 정보 조회 (업종 등)
        company_info = self._get_company_info(company_id)
        industry = company_info.get("industry", "unknown")
        
        # 물리적 한계 정의
        physical_limits = self._get_physical_limits(industry)
        
        # 1. 에너지 효율 검증
        if "energy_efficiency" in data:
            efficiency = data["energy_efficiency"]
            max_efficiency = physical_limits.get("energy_efficiency", {}).get("max", 0.95)
            
            if efficiency > max_efficiency:
                errors.append(
                    f"에너지 효율({efficiency:.2%})이 물리적 최대값({max_efficiency:.2%})을 초과합니다. "
                    f"(카르노 효율 한계)"
                )
        
        # 2. 재생에너지 비율 검증
        if "renewable_energy_ratio" in data:
            ratio = data["renewable_energy_ratio"]
            if ratio < 0 or ratio > 1.0:
                errors.append(
                    f"재생에너지 비율({ratio:.2%})이 물리적 범위(0-100%)를 벗어났습니다."
                )
        
        # 3. 배출 강도 검증 (업종별 물리적 최소값)
        if "emission_intensity" in data:
            intensity = data["emission_intensity"]
            min_intensity = physical_limits.get("emission_intensity", {}).get("min", 0)
            
            if intensity < min_intensity:
                errors.append(
                    f"배출 강도({intensity:.2f} tCO2e/단위)가 업종별 물리적 최소값({min_intensity:.2f})보다 작습니다. "
                    f"데이터 오류 가능성이 높습니다."
                )
        
        # 4. Scope 3 배출량 합리성 검증
        if "scope3_emissions" in data and "revenue" in data:
            scope3 = data["scope3_emissions"]
            revenue = data["revenue"]
            
            # 일반적으로 Scope 3는 매출의 0.1-5% 범위의 배출량을 가짐
            # (업종에 따라 다르지만, 물리적으로 불가능한 값은 아님)
            # 다만 Scope 3가 Scope 1+2의 10배를 초과하면 이상
            if "scope1_emissions" in data and "scope2_emissions" in data:
                scope1_2 = data["scope1_emissions"] + data["scope2_emissions"]
                if scope1_2 > 0 and scope3 / scope1_2 > 10:
                    errors.append(
                        f"Scope 3 배출량({scope3:.2f})이 Scope 1+2({scope1_2:.2f})의 10배를 초과합니다. "
                        f"일반적으로 Scope 3는 Scope 1+2의 3-5배 범위입니다."
                    )
        
        return errors
    
    def _validate_multi_dimensional_correlations(
        self,
        data: Dict,
        company_id: str,
        year: int
    ) -> List[Dict]:
        """다차원 상관관계 검증"""
        anomalies = []
        
        # 과거 데이터로 상관관계 모델 학습
        historical_data = self._get_historical_data(company_id, year, years_back=5)
        
        if len(historical_data) < 3:
            return anomalies  # 데이터가 부족하면 스킵
        
        # 1. 매출과 배출량의 상관관계
        if "revenue" in data and "total_emissions" in data:
            revenue = data["revenue"]
            emissions = data["total_emissions"]
            
            # 과거 데이터로 선형 회귀 모델 학습
            revenue_emissions_model = self._build_correlation_model(
                historical_data, "revenue", "total_emissions"
            )
            
            if revenue_emissions_model:
                expected_emissions = revenue_emissions_model.predict(revenue)
                error_rate = abs(emissions - expected_emissions) / expected_emissions if expected_emissions > 0 else 0
                
                if error_rate > 0.3:  # 30% 이상 차이
                    anomalies.append({
                        "type": "correlation_anomaly",
                        "fields": ["revenue", "total_emissions"],
                        "current_values": {"revenue": revenue, "emissions": emissions},
                        "expected_emissions": expected_emissions,
                        "error_rate": error_rate,
                        "severity": "high",
                        "description": "매출 대비 배출량이 과거 상관관계 패턴과 크게 벗어남"
                    })
        
        # 2. 임직원 수와 에너지 사용량의 상관관계
        if "total_employees" in data and "total_energy_mwh" in data:
            employees = data["total_employees"]
            energy = data["total_energy_mwh"]
            
            employees_energy_model = self._build_correlation_model(
                historical_data, "total_employees", "total_energy_mwh"
            )
            
            if employees_energy_model:
                expected_energy = employees_energy_model.predict(employees)
                error_rate = abs(energy - expected_energy) / expected_energy if expected_energy > 0 else 0
                
                if error_rate > 0.3:
                    anomalies.append({
                        "type": "correlation_anomaly",
                        "fields": ["total_employees", "total_energy_mwh"],
                        "current_values": {"employees": employees, "energy": energy},
                        "expected_energy": expected_energy,
                        "error_rate": error_rate,
                        "severity": "medium",
                        "description": "임직원 수 대비 에너지 사용량이 과거 상관관계 패턴과 벗어남"
                    })
        
        # 3. 생산량과 배출량의 상관관계
        if "production_volume" in data and "total_emissions" in data:
            production = data["production_volume"]
            emissions = data["total_emissions"]
            
            production_emissions_model = self._build_correlation_model(
                historical_data, "production_volume", "total_emissions"
            )
            
            if production_emissions_model:
                expected_emissions = production_emissions_model.predict(production)
                error_rate = abs(emissions - expected_emissions) / expected_emissions if expected_emissions > 0 else 0
                
                if error_rate > 0.3:
                    anomalies.append({
                        "type": "correlation_anomaly",
                        "fields": ["production_volume", "total_emissions"],
                        "current_values": {"production": production, "emissions": emissions},
                        "expected_emissions": expected_emissions,
                        "error_rate": error_rate,
                        "severity": "high",
                        "description": "생산량 대비 배출량이 과거 상관관계 패턴과 크게 벗어남"
                    })
        
        # 4. 매출과 ESG 투자액의 상관관계
        if "revenue" in data and "esg_investment" in data:
            revenue = data["revenue"]
            esg_investment = data["esg_investment"]
            
            # 일반적으로 ESG 투자는 매출의 0.1-5% 범위
            expected_esg_investment_min = revenue * 0.001
            expected_esg_investment_max = revenue * 0.05
            
            if esg_investment < expected_esg_investment_min:
                anomalies.append({
                    "type": "correlation_anomaly",
                    "fields": ["revenue", "esg_investment"],
                    "current_values": {"revenue": revenue, "esg_investment": esg_investment},
                    "expected_range": {
                        "min": expected_esg_investment_min,
                        "max": expected_esg_investment_max
                    },
                    "severity": "low",
                    "description": "매출 대비 ESG 투자액이 일반적인 범위보다 낮음"
                })
            elif esg_investment > expected_esg_investment_max:
                anomalies.append({
                    "type": "correlation_anomaly",
                    "fields": ["revenue", "esg_investment"],
                    "current_values": {"revenue": revenue, "esg_investment": esg_investment},
                    "expected_range": {
                        "min": expected_esg_investment_min,
                        "max": expected_esg_investment_max
                    },
                    "severity": "medium",
                    "description": "매출 대비 ESG 투자액이 일반적인 범위보다 높음 (데이터 오류 가능성)"
                })
        
        return anomalies
    
    def _analyze_trend(self, time_series: List[Dict], field: str) -> Dict:
        """시계열 추세 분석"""
        import numpy as np
        from sklearn.linear_model import LinearRegression
        
        if len(time_series) < 3:
            return {"is_anomalous": False}
        
        years = np.array([d["year"] for d in time_series]).reshape(-1, 1)
        values = np.array([d["value"] for d in time_series])
        
        # 선형 회귀로 추세 분석
        model = LinearRegression()
        model.fit(years, values)
        
        # 마지막 값 예측
        last_year = years[-1][0]
        expected_value = model.predict([[last_year]])[0]
        
        # 실제값과 예측값 비교
        actual_value = values[-1]
        error_rate = abs(actual_value - expected_value) / abs(expected_value) if expected_value != 0 else 0
        
        return {
            "is_anomalous": error_rate > 0.3,  # 30% 이상 차이
            "expected_value": expected_value,
            "actual_value": actual_value,
            "direction": "increasing" if model.coef_[0] > 0 else "decreasing",
            "error_rate": error_rate
        }
    
    def _analyze_seasonality(self, time_series: List[Dict], field: str) -> Dict:
        """계절성 분석 (분기별, 월별 패턴)"""
        # 간단한 계절성 분석 (연도별 평균과 비교)
        if len(time_series) < 4:
            return {"is_anomalous": False}
        
        values = [d["value"] for d in time_series]
        mean_value = sum(values[:-1]) / len(values[:-1])  # 마지막 제외
        std_value = (sum((v - mean_value) ** 2 for v in values[:-1]) / len(values[:-1])) ** 0.5
        
        last_value = values[-1]
        z_score = abs(last_value - mean_value) / std_value if std_value > 0 else 0
        
        return {
            "is_anomalous": z_score > 2,  # 2 표준편차 이상
            "expected_value": mean_value,
            "actual_value": last_value,
            "z_score": z_score
        }
    
    def _isolation_forest_detection(
        self,
        time_series: List[Dict],
        field: str
    ) -> List[Dict]:
        """Isolation Forest 기반 이상치 탐지"""
        from sklearn.ensemble import IsolationForest
        import numpy as np
        
        if len(time_series) < 4:
            return []
        
        values = np.array([d["value"] for d in time_series]).reshape(-1, 1)
        
        # Isolation Forest 모델 학습
        iso_forest = IsolationForest(contamination=0.1, random_state=42)
        predictions = iso_forest.fit_predict(values)
        
        anomalies = []
        for i, pred in enumerate(predictions):
            if pred == -1:  # 이상치로 판단
                anomalies.append({
                    "field": field,
                    "type": "isolation_forest_anomaly",
                    "year": time_series[i]["year"],
                    "value": time_series[i]["value"],
                    "severity": "medium",
                    "description": f"{field}가 Isolation Forest 알고리즘으로 이상치로 탐지됨"
                })
        
        return anomalies
    
    def _lstm_predict(self, time_series: List[Dict], field: str) -> float:
        """LSTM 기반 시계열 예측"""
        # 간단한 구현 (실제로는 더 복잡한 LSTM 모델 사용)
        # 여기서는 선형 추세 기반 예측으로 대체
        if len(time_series) < 3:
            return time_series[-1]["value"] if time_series else 0
        
        # 마지막 3개 값의 평균 변화율로 예측
        values = [d["value"] for d in time_series[-3:]]
        if len(values) >= 2:
            avg_change = (values[-1] - values[0]) / (len(values) - 1)
            predicted = values[-1] + avg_change
            return predicted
        
        return values[-1]
    
    def _get_physical_limits(self, industry: str) -> Dict:
        """업종별 물리적 한계 조회"""
        return {
            "energy_efficiency": {
                "max": 0.95,  # 카르노 효율 한계
                "industry": {
                    "manufacturing": 0.85,
                    "service": 0.70,
                    "steel": 0.80,
                    "cement": 0.75
                }
            },
            "renewable_energy_ratio": {
                "min": 0.0,
                "max": 1.0
            },
            "emission_intensity": {
                "min": {
                    "steel": 1.2,  # tCO2e/톤 강철 (이론적 최소)
                    "cement": 0.4,  # tCO2e/톤 시멘트
                    "power": 0.0,   # 재생에너지만 사용 시
                    "manufacturing": 0.1
                }
            }
        }
    
    def _build_correlation_model(
        self,
        historical_data: List[Dict],
        x_field: str,
        y_field: str
    ):
        """상관관계 모델 구축 (선형 회귀)"""
        from sklearn.linear_model import LinearRegression
        import numpy as np
        
        x_values = []
        y_values = []
        
        for data in historical_data:
            x_val = data.get(x_field)
            y_val = data.get(y_field)
            if x_val is not None and y_val is not None:
                x_values.append(x_val)
                y_values.append(y_val)
        
        if len(x_values) < 3:
            return None
        
        X = np.array(x_values).reshape(-1, 1)
        y = np.array(y_values)
        
        model = LinearRegression()
        model.fit(X, y)
        
        return model
```

#### 6.1.4 이상 탐지 에이전트 (LLM 기반)

```python
class AnomalyDetectionAgent:
    """이상 수치 탐지 및 분석 에이전트 (LLM 기반)"""
    
    def __init__(self, llm):
        self.llm = llm
        self.system_prompt = """당신은 ESG 데이터 품질 관리 전문가입니다.

## 역할
1. ERP에서 수집된 데이터의 이상 수치를 분석합니다.
2. 전년도 대비 급격한 변화의 원인을 추론합니다.
3. 데이터 오류 가능성과 정상적인 변화를 구분합니다.

## 분석 기준
- 전년도 대비 변화율이 비정상적으로 큰 경우
- 업계 평균과 크게 다른 경우
- 논리적으로 불가능한 값 (예: 재생에너지 비율 150%)
- 다른 지표와의 일관성 부족

## 출력 형식
JSON 형식으로 응답하세요:
{
    "is_anomaly": true/false,
    "anomaly_type": "sudden_change|outlier|inconsistency|error",
    "confidence": 0.0-1.0,
    "analysis": "이상 수치에 대한 분석",
    "possible_causes": ["원인1", "원인2"],
    "recommendation": "수정 요청 또는 확인 요청"
}
"""
    
    async def analyze_anomaly(
        self, field: str, current_value: float, previous_value: float,
        change_rate: float, context: Dict
    ) -> Dict:
        """이상 수치 분석"""
        # LLM을 통한 맥락 기반 분석
        # 정상 변화와 오류를 구분
        # 원인 추론 및 권장 사항 제시
        pass
```

#### 6.1.5 수정 요청 에이전트 (LLM 기반)

```python
class CorrectionRequestAgent:
    """수정 요청 생성 에이전트 (LLM 기반)"""
    
    async def generate_correction_requests(
        self, validation_result: Dict, anomalies: List[Dict], company_id: str
    ) -> Dict:
        """수정 요청 생성"""
        # 검증 결과를 바탕으로
        # 구체적이고 실행 가능한 수정 요청 생성
        # 심각도 분류 및 기한 설정
        pass
```

#### 6.1.6 공급망 데이터 전처리 및 검증

공급망 데이터는 Scope 3 배출량 계산과 협력업체 ESG 관리에 필수적이므로, 별도의 전처리 및 검증이 필요합니다.

**공급망 데이터 전처리:**

```python
class SupplyChainDataPreprocessor:
    """공급망 데이터 전처리"""
    
    def preprocess(self, raw_supply_chain_data: Dict) -> Dict:
        """공급망 데이터 전처리"""
        processed = {}
        
        # 1. 협력업체 데이터 정규화
        processed["suppliers"] = self._normalize_supplier_data(
            raw_supply_chain_data.get("supplier_list", [])
        )
        
        # 2. 구매 데이터 집계 및 카테고리 분류
        processed["purchases"] = self._aggregate_and_classify_purchases(
            raw_supply_chain_data.get("purchases", [])
        )
        
        # 3. 물류 데이터 정규화 (거리, 운송 수단)
        processed["logistics"] = self._normalize_logistics_data(
            raw_supply_chain_data.get("logistics", [])
        )
        
        # 4. Scope 3 계산용 데이터 준비
        processed["scope3_calculation"] = self._prepare_scope3_data(
            processed["purchases"],
            processed["logistics"]
        )
        
        return processed
    
    def _normalize_supplier_data(self, suppliers: List[Dict]) -> List[Dict]:
        """협력업체 데이터 정규화"""
        normalized = []
        
        for supplier in suppliers:
            # 국가 코드 정규화 (예: "Korea" → "KR")
            country_code = self._normalize_country_code(
                supplier.get("Country", "")
            )
            
            # 업종 코드 정규화 (예: "Manufacturing" → "C")
            industry_code = self._normalize_industry_code(
                supplier.get("Industry", "")
            )
            
            normalized.append({
                "supplier_id": supplier.get("SupplierId"),
                "supplier_name": supplier.get("SupplierName"),
                "country_code": country_code,
                "industry_code": industry_code,
                "purchase_amount": float(supplier.get("PurchaseAmount", 0)),
                "category": supplier.get("Category", "unknown")
            })
        
        return normalized
    
    def _prepare_scope3_data(
        self,
        purchases: List[Dict],
        logistics: List[Dict]
    ) -> Dict:
        """Scope 3 계산용 데이터 준비"""
        # Spend-based 방법: 구매 금액 × 배출 계수
        scope3_by_category = {}
        
        for purchase in purchases:
            category = purchase.get("category")
            amount = purchase.get("purchase_amount", 0)
            
            # 배출 계수 조회 (카테고리별, 국가별)
            emission_factor = self._get_emission_factor(
                category,
                purchase.get("origin_country")
            )
            
            # Scope 3 배출량 계산
            scope3_emissions = amount * emission_factor / 1000000  # 백만원 단위
            scope3_by_category[category] = scope3_emissions
        
        return {
            "scope3_by_category": scope3_by_category,
            "total_scope3": sum(scope3_by_category.values()),
            "calculation_method": "spend_based"
        }
```

**공급망 데이터 검증:**

```python
class SupplyChainDataValidator:
    """공급망 데이터 검증"""
    
    def validate(self, supply_chain_data: Dict, company_id: str, year: int) -> Dict:
        """공급망 데이터 검증"""
        validation_result = {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "anomalies": []
        }
        
        # 1. 협력업체 데이터 완전성 검증
        supplier_errors = self._validate_supplier_completeness(
            supply_chain_data.get("suppliers", [])
        )
        validation_result["errors"].extend(supplier_errors)
        
        # 2. Scope 3 계산 데이터 검증
        scope3_errors = self._validate_scope3_data(
            supply_chain_data.get("scope3_calculation", {})
        )
        validation_result["errors"].extend(scope3_errors)
        
        # 3. 협력업체 ESG 평가 데이터 검증
        esg_errors = self._validate_esg_scores(
            supply_chain_data.get("esg_scores", {})
        )
        validation_result["errors"].extend(esg_errors)
        
        # 4. 전년도 비교 (공급망 구조 변화)
        anomalies = self._compare_supply_chain_structure(
            supply_chain_data, company_id, year
        )
        validation_result["anomalies"] = anomalies
        
        # 5. Scope 3 배출량 합리성 검증
        scope3_anomalies = self._validate_scope3_reasonableness(
            supply_chain_data.get("scope3_calculation", {})
        )
        validation_result["anomalies"].extend(scope3_anomalies)
        
        validation_result["is_valid"] = len(validation_result["errors"]) == 0
        
        return validation_result
    
    def _compare_supply_chain_structure(
        self,
        current_data: Dict,
        company_id: str,
        year: int
    ) -> List[Dict]:
        """공급망 구조 변화 비교"""
        anomalies = []
        previous_year = year - 1
        
        # 전년도 공급망 데이터 조회
        prev_data = self._get_previous_year_supply_chain_data(company_id, previous_year)
        
        if not prev_data:
            return anomalies
        
        # 협력업체 수 변화
        current_supplier_count = len(current_data.get("suppliers", []))
        prev_supplier_count = len(prev_data.get("suppliers", []))
        
        if current_supplier_count > 0 and prev_supplier_count > 0:
            change_rate = ((current_supplier_count - prev_supplier_count) / prev_supplier_count) * 100
            
            # 50% 이상 변화 시 이상 수치
            if abs(change_rate) > 50:
                anomalies.append({
                    "field": "supplier_count",
                    "current_value": current_supplier_count,
                    "previous_value": prev_supplier_count,
                    "change_rate": change_rate,
                    "threshold": 50.0,
                    "severity": "medium",
                    "description": "협력업체 수가 전년도 대비 급격히 변화했습니다."
                })
        
        return anomalies
```

#### 6.1.7 통합 파이프라인

```python
class ERPDataPipeline:
    """ERP 데이터 수집 및 검증 파이프라인"""
    
    async def process_erp_data(
        self, company_id: str, year: int, erp_type: str = "sap"
    ) -> Dict:
        """ERP 데이터 처리 파이프라인"""
        # 1. ERP에서 데이터 수집
        raw_data = await self.connector.fetch_erp_data(company_id, year, erp_type)
        
        # 2. 전처리 (Python 로직)
        processed_data = self.preprocessor.preprocess(raw_data)
        
        # 3. 검증 (Python 로직)
        validation_result = self.validator.validate(processed_data, company_id, year)
        
        # 4. 이상 수치가 있으면 LLM으로 분석
        if validation_result.get("anomalies"):
            for anomaly in validation_result["anomalies"]:
                analysis = await self.anomaly_agent.analyze_anomaly(...)
                anomaly["llm_analysis"] = analysis
        
        # 5. 오류나 이상 수치가 있으면 수정 요청 생성
        if validation_result.get("errors") or validation_result.get("anomalies"):
            correction_requests = await self.correction_agent.generate_correction_requests(
                validation_result, validation_result.get("anomalies", []), company_id
            )
        
            # 6. 공급망 데이터 별도 처리
            if processed_data.get("supply_chain"):
                supply_chain_processed = self.supply_chain_preprocessor.preprocess(
                    processed_data["supply_chain"]
                )
                supply_chain_validation = self.supply_chain_validator.validate(
                    supply_chain_processed, company_id, year
                )
                
                # 공급망 데이터 이상 수치 분석
                if supply_chain_validation.get("anomalies"):
                    for anomaly in supply_chain_validation["anomalies"]:
                        analysis = await self.anomaly_agent.analyze_anomaly(
                            field=anomaly["field"],
                            current_value=anomaly["current_value"],
                            previous_value=anomaly.get("previous_value"),
                            change_rate=anomaly.get("change_rate", 0),
                            context={
                                "company_id": company_id,
                                "year": year,
                                "data_type": "supply_chain"
                            }
                        )
                        anomaly["llm_analysis"] = analysis
                
                result["supply_chain_validation"] = supply_chain_validation
                result["supply_chain_data"] = supply_chain_processed
            
            # 7. 검증 통과 시 DB 저장
            if validation_result.get("is_valid"):
                await self._save_to_database(processed_data, company_id, year)
                
                # 공급망 데이터도 별도 저장
                if supply_chain_validation.get("is_valid"):
                    await self._save_supply_chain_to_database(
                        supply_chain_processed, company_id, year
                    )
            
        return result
```

#### 6.1.7 실제 기업 방식과의 비교

| 구성 요소 | 실제 기업 방식 (SAP/Oracle) | 우리 플랫폼 방식 | 차별점 |
|----------|---------------------------|----------------|--------|
| **전처리** | Python/Java 로직 | Python 로직 | ✅ 일치 |
| **데이터 검증** | 규칙 기반 검증 | 규칙 기반 검증 | ✅ 일치 |
| **이상 탐지** | 통계적 방법 (전년도 비교) | 전년도 비교 + LLM 분석 | ✅ 고도화 |
| **수정 요청** | 워크플로우 시스템 | LLM 기반 수정 요청 생성 | ✅ 고도화 |
| **감사 추적** | 데이터 리니지 추적 | 데이터 리니지 추적 | ✅ 일치 |

**우리 플랫폼의 차별점:**
- LLM 기반 이상 수치 분석: 맥락을 고려하여 정상 변화와 오류를 정확히 구분
- 지능형 수정 요청 생성: 상황에 맞는 구체적이고 실행 가능한 수정 요청 자동 생성

### 6.2 검증 규칙

```python
class DataQualityRules:
    """데이터 품질 검증 규칙"""
    
    RULES = {
        "completeness": {
            "required_fields": ["source", "timestamp", "content"],
            "min_content_length": 100
        },
        "accuracy": {
            "numeric_range_checks": True,
            "date_format_checks": True
        },
        "consistency": {
            "cross_reference_checks": True,
            "unit_consistency": True
        },
        "timeliness": {
            "max_age_days": 365
        }
    }
    
    def validate(self, document: Document) -> ValidationResult:
        """문서 검증"""
        issues = []
        
        # 완전성 검사
        for field in self.RULES["completeness"]["required_fields"]:
            if not getattr(document, field, None):
                issues.append(f"Missing required field: {field}")
        
        # 정확성 검사
        if self.RULES["accuracy"]["numeric_range_checks"]:
            numeric_issues = self._check_numeric_ranges(document)
            issues.extend(numeric_issues)
        
        # 일관성 검사
        if self.RULES["consistency"]["unit_consistency"]:
            unit_issues = self._check_unit_consistency(document)
            issues.extend(unit_issues)
        
        # 적시성 검사
        if document.timestamp:
            age_days = (datetime.now() - document.timestamp).days
            if age_days > self.RULES["timeliness"]["max_age_days"]:
                issues.append(f"Document is {age_days} days old")
        
        return ValidationResult(
            is_valid=len(issues) == 0,
            issues=issues
        )
```

### 6.2 데이터 리니지 추적

```python
class DataLineage:
    """데이터 리니지 추적"""
    
    def __init__(self):
        self.lineage_store = {}
    
    def record(
        self,
        data_id: str,
        source: str,
        transformations: List[str],
        parent_ids: List[str] = None
    ):
        """리니지 기록"""
        self.lineage_store[data_id] = {
            "source": source,
            "transformations": transformations,
            "parent_ids": parent_ids or [],
            "created_at": datetime.now(),
            "version": self._get_version(data_id)
        }
    
    def get_lineage(self, data_id: str) -> Dict:
        """리니지 조회"""
        lineage = self.lineage_store.get(data_id)
        
        if lineage and lineage["parent_ids"]:
            lineage["parents"] = [
                self.get_lineage(pid) for pid in lineage["parent_ids"]
            ]
        
        return lineage
```

---

## 7. 법적 고려사항

### 7.1 크롤링 준수사항

| 항목 | 준수 사항 |
|------|----------|
| **robots.txt** | 크롤링 전 robots.txt 확인 및 준수 |
| **이용약관** | 각 사이트 이용약관 검토 |
| **요청 빈도** | 적절한 딜레이 (1-2초) 적용 |
| **저작권** | 공시 데이터 위주 수집, 상업적 재배포 금지 |

### 7.2 데이터 보안

```python
class DataSecurityManager:
    """데이터 보안 관리"""
    
    def __init__(self, encryption_key: str):
        self.cipher = Fernet(encryption_key)
    
    def encrypt_sensitive_data(self, data: Dict) -> Dict:
        """민감 데이터 암호화"""
        sensitive_fields = ["employee_data", "financial_details", "strategy"]
        
        encrypted = data.copy()
        for field in sensitive_fields:
            if field in encrypted:
                encrypted[field] = self.cipher.encrypt(
                    json.dumps(encrypted[field]).encode()
                ).decode()
        
        return encrypted
    
    def apply_access_control(self, data: Dict, user_role: str, department: Optional[str] = None) -> Dict:
        """접근 제어 적용 (4단계 역할 구조 기반)"""
        # 4단계 역할 구조 권한 정의
        role_permissions = {
            "final_approver": ["*"],  # 역할 1: 최종 승인권자 - 전체 접근
            "esg_team": ["*"],  # 역할 2: ESG팀 - 전체 접근
            "dept_user": self._get_dept_permissions(department),  # 역할 3: 현업팀 - 부서별 접근
            "viewer": ["public"]  # 역할 4: 일반 사용자 - 조회만
        }
        
        allowed = role_permissions.get(user_role, [])
        
        if "*" in allowed:
            return data
        
        # 부서별 권한 적용 (현업팀)
        if user_role == "dept_user" and department:
            return {
                k: v for k, v in data.items()
                if self._is_dept_section(k, department)
            }
        
        return {
            k: v for k, v in data.items()
            if self._get_data_classification(k) in allowed
        }
    
    def _get_dept_permissions(self, department: Optional[str]) -> List[str]:
        """부서별 권한 반환"""
        dept_sections = {
            "environment": ["environment", "public"],  # 환경안전팀
            "hr": ["social", "public"],  # 인사팀
            "finance": ["governance", "public"],  # 재무팀
            "management": ["company_info", "public"]  # 경영지원팀
        }
        return dept_sections.get(department, ["public"])
    
    def _is_dept_section(self, section: str, department: str) -> bool:
        """부서별 섹션 확인"""
        dept_section_map = {
            "environment": ["environment", "환경"],
            "hr": ["social", "사회"],
            "finance": ["governance", "지배구조"],
            "management": ["company_info", "기업기본정보"]
        }
        allowed_sections = dept_section_map.get(department, [])
        return any(s in section.lower() for s in allowed_sections)
```

