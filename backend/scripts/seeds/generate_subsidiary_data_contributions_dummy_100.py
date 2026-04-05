"""100건 subsidiary_data_contributions 더미 JSON/SQL 생성 (REVISED §8·037 스키마 정합).

계열사명·기여 법인 UUID는 domain/v1/ifrs_agent/data/login/companies.json 과 정합합니다.
(DB 컬럼은 모회사 company_id + 텍스트 subsidiary_name 만 사용. JSON에 contributor_company_id 는 참조용.)
"""

from __future__ import annotations

import json
from pathlib import Path

COMPANIES_JSON = (
    Path(__file__).resolve().parents[2]
    / "domain/v1/ifrs_agent/data/login/companies.json"
)

OUT_JSON = Path(__file__).with_name("subsidiary_data_contributions_dummy.json")
OUT_SQL = Path(__file__).with_name("subsidiary_data_contributions_dummy.sql")

CATEGORIES = [
    ("재생에너지", ["ENV_ENERGY_SOLAR_001", "ENV_GHG_REDUCTION_002"]),
    ("온실가스", ["ENV_GHG_REDUCTION_002", "DP-GHG-SCOPE2"]),
    ("협력회사 ESG 관리", ["SOC_SUPPLY_CHAIN_ESG_001", "DP-SOCIAL-SUPPLY-CHAIN"]),
    ("인권·다양성", ["DP-HR-DIVERSITY", "SOC_HR_TRAINING_001"]),
    ("안전보건", ["SOC_SAFETY_001", "EHS_INCIDENT_001"]),
    ("수자원·폐기물", ["ENV_WATER_001", "ENV_WASTE_001"]),
    ("에너지 효율", ["ENV_ENERGY_EFF_001", "ENV_GHG_REDUCTION_002"]),
    ("사이버·정보보호", ["GOV_CYBER_001", "DP-DATA-PRIVACY"]),
    ("지역사회 공헌", ["SOC_COMMUNITY_001", "DP-SOCIAL-COMMUNITY"]),
    ("이사회·지배구조", ["DP-GOV-BOARD", "DP-GOV-ESG-COMMITTEE"]),
]

DATA_SOURCES = ["자회사 제출", "EMS 연동", "SRM 포털 집계", "HR 시스템", "EHS 데이터관리", "내부 웹폼"]
TEAMS = [
    "친환경인프라팀",
    "공급망지속가능팀",
    "EHS 데이터관리",
    "HR담당",
    "시설관리팀",
    "정보보호실",
    "지역사회협력팀",
    "ESG데이터담당",
]


def row_uuid(i: int) -> str:
    return f"f0e0d0c0-b0a1-4002-8003-{i:012x}"


def load_companies() -> list[dict]:
    return json.loads(COMPANIES_JSON.read_text(encoding="utf-8"))


def holding_and_children(companies: list[dict]) -> tuple[dict, list[dict]]:
    holding = next(c for c in companies if c.get("group_entity_type") == "holding")
    hid = holding["id"]
    children = [c for c in companies if c.get("parent_company_id") == hid]
    children.sort(key=lambda c: c["id"])
    return holding, children


def by_login(companies: list[dict], login_id: str) -> dict:
    return next(c for c in companies if c.get("company_login_id") == login_id)


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def quantitative_for(idx: int, cat: str) -> dict:
    n = idx + 1
    if cat == "재생에너지":
        return {
            "태양광_발전량_kWh": 12000 + (n * 137) % 200000,
            "설비용량_kW": 50 + (n * 11) % 500,
        }
    if cat == "온실가스":
        return {
            "Scope2_위치기반_tCO2eq": round(800 + (n * 13) % 5000, 1),
            "전년대비_감축률_퍼센트": round(2 + (n % 12) * 0.5, 1),
        }
    if cat == "협력회사 ESG 관리":
        return {
            "평가대상_협력사_수": 80 + n % 120,
            "현장실사_고위험_수": 5 + n % 35,
            "개선과제_이행률_퍼센트": 70 + n % 28,
        }
    if cat == "인권·다양성":
        return {
            "필수교육_이수율_퍼센트": round(95 + (n % 50) / 10, 1),
            "교육시간_합계_시간": 5000 + n * 127,
        }
    if cat == "안전보건":
        return {
            "재해건수_건": n % 5,
            "안전교육_이수율_퍼센트": 96 + n % 4,
            "근로시간_대비_교육시간_시간": round(0.3 + (n % 20) / 100, 2),
        }
    if cat == "수자원·폐기물":
        return {
            "용수_재이용률_퍼센트": 15 + n % 40,
            "폐기물_재활용률_퍼센트": 55 + n % 35,
        }
    if cat == "에너지 효율":
        return {
            "PUE_목표대비": round(1.35 + (n % 25) / 100, 2),
            "절감전력_MWh": 50 + n * 3 % 800,
        }
    if cat == "사이버·정보보호":
        return {
            "보안점검_건수": 4 + n % 20,
            "취약점_조치율_퍼센트": 88 + n % 12,
        }
    if cat == "지역사회 공헌":
        return {
            "봉사시간_합계_시간": 800 + n * 41,
            "기부금_및_물품_천원": 50000 + n * 990,
        }
    return {
        "이사회_개최_횟수": 4 + n % 8,
        "사외이사_비율_퍼센트": 40 + n % 20,
    }


def description_for(idx: int, sub: str, fac: str, year: int, cat: str) -> str:
    snippets = {
        "재생에너지": f"{year}년 {fac}에서 태양광·ESS 연계 등 재생에너지 도입을 확대하였으며, 모회사 SR 집계를 위해 발전량·설비용량을 제출합니다.",
        "온실가스": f"{fac}는 에너지 절감 과제 이행으로 {year}년 온실가스 배출 강도를 관리하였고, 검증 가능한 수치를 본 항목에 기재합니다.",
        "협력회사 ESG 관리": f"{sub}는 {year}년 협력사 ESG 평가·실사 체계를 운영하였으며, 고위험사 개선 추적을 완료하였습니다.",
        "인권·다양성": f"{year}년 {fac} 임직원 대상 인권·다양성 교육 및 고충 처리 채널 운영 실적을 집계 제출합니다.",
        "안전보건": f"{fac}는 {year}년 산업안전보건 교육·점검을 정기 실시하였고, 재해 예방 KPI 달성 여부를 보고합니다.",
        "수자원·폐기물": f"{year}년 용수 사용·폐기물 분리배출 실적을 사업장 단위로 산정하여 제출하였습니다.",
        "에너지 효율": f"{fac}는 냉방·전력 모니터링으로 PUE·에너지 집약도를 개선하였으며, {year}년 실적을 포함합니다.",
        "사이버·정보보호": f"{year}년 침해사고 대응 훈련 및 취약점 점검 결과를 집계하여 본 기여 데이터로 등록합니다.",
        "지역사회 공헌": f"{sub}는 {fac} 인근 지역사회 프로그램(봉사·교육)을 운영하고 {year}년 정량 실적을 제출합니다.",
        "이사회·지배구조": f"{year}년 거버넌스 운영(이사회·위원회) 현황을 자회사 관점에서 요약 제출합니다.",
    }
    return snippets[cat]


def fixed_rows(parent_id: str, companies: list[dict]) -> list[dict]:
    dongtan = by_login(companies, "aff_dongtan_dc")
    miracom = by_login(companies, "sub_miracom")
    emro = by_login(companies, "sub_emro")
    suwon_dc = by_login(companies, "aff_suwon_dc")
    multicampus = by_login(companies, "sub_multicampus")
    dt_name = dongtan["company_name_ko"]
    return [
        {
            "id": row_uuid(1),
            "company_id": parent_id,
            "contributor_company_id": dongtan["id"],
            "subsidiary_name": dt_name,
            "facility_name": f"{dt_name} 옥상 발전 설비",
            "report_year": 2024,
            "category": "재생에너지",
            "category_embedding": None,
            "description": (
                f"{dt_name}는 준공 시 전용 옥상에 태양광 발전설비를 구축하였습니다. 2024년 7월 {dt_name} 옥상 내 추가장에 "
                "태양광 발전설비 374kW를 추가 증설하여 재생에너지 비중을 확대하고 재생에너지 사용 확대 노력을 지속하고 있습니다. "
                f"이를 통해 2024년 한 해 동안 당사 {dt_name} 사업장에서는 6개월간 172,497kWh를 발전하였습니다."
            ),
            "description_embedding": None,
            "related_dp_ids": ["ENV_ENERGY_SOLAR_001", "ENV_GHG_REDUCTION_002"],
            "quantitative_data": {
                "태양광_발전량_kWh": 172497,
                "설비용량_kW": 374,
                "발전기간_개월": 6,
                "CO2_감축량_tCO2eq": 38.5,
            },
            "data_source": "자회사 제출",
            "submitted_by": "동탄DC ESG담당 / 친환경인프라팀",
            "submission_date": "2024-11-15",
        },
        {
            "id": row_uuid(2),
            "company_id": parent_id,
            "contributor_company_id": dongtan["id"],
            "subsidiary_name": dt_name,
            "facility_name": f"{dt_name} 옥상 발전 설비",
            "report_year": 2023,
            "category": "재생에너지",
            "category_embedding": None,
            "description": (
                f"2023년 {dt_name} 옥상 태양광 설비 초기 구축 완료. 연간 발전 실적 및 설비 용량을 모회사 SR 작성용으로 집계 제출."
            ),
            "description_embedding": None,
            "related_dp_ids": ["ENV_ENERGY_SOLAR_001"],
            "quantitative_data": {"태양광_발전량_kWh": 95000, "설비용량_kW": 200},
            "data_source": "자회사 제출",
            "submitted_by": "동탄DC ESG담당",
            "submission_date": "2023-12-01",
        },
        {
            "id": row_uuid(3),
            "company_id": parent_id,
            "contributor_company_id": miracom["id"],
            "subsidiary_name": miracom["company_name_ko"],
            "facility_name": f"{miracom['company_name_ko']} 판교 사옥",
            "report_year": 2024,
            "category": "재생에너지",
            "category_embedding": None,
            "description": (
                "판교 사옥 옥상 태양광 발전설비로 자가소비 전력 일부를 충당하고, 잔여 전력은 그리드 이월 정책에 따라 보고합니다."
            ),
            "description_embedding": None,
            "related_dp_ids": ["ENV_ENERGY_SOLAR_001"],
            "quantitative_data": {"태양광_발전량_kWh": 45000, "설비용량_kW": 150},
            "data_source": "EMS 연동",
            "submitted_by": "판교시설관리팀",
            "submission_date": "2024-10-20",
        },
        {
            "id": row_uuid(4),
            "company_id": parent_id,
            "contributor_company_id": emro["id"],
            "subsidiary_name": emro["company_name_ko"],
            "facility_name": f"{emro['company_name_ko']} 본사 (SRM 거점)",
            "report_year": 2024,
            "category": "협력회사 ESG 관리",
            "category_embedding": None,
            "description": (
                "1차 협력사 150개사 대상 ESG 자가진단 설문 및 고위험 22개사 현장 실사를 완료하였으며, "
                "개선 과제 이행률 87%를 기록하였습니다."
            ),
            "description_embedding": None,
            "related_dp_ids": ["SOC_SUPPLY_CHAIN_ESG_001", "DP-SOCIAL-SUPPLY-CHAIN"],
            "quantitative_data": {
                "평가대상_협력사_수": 150,
                "현장실사_고위험_수": 22,
                "개선과제_이행률_퍼센트": 87,
            },
            "data_source": "SRM 포털 집계",
            "submitted_by": "공급망지속가능팀",
            "submission_date": "2024-11-30",
        },
        {
            "id": row_uuid(5),
            "company_id": parent_id,
            "contributor_company_id": suwon_dc["id"],
            "subsidiary_name": suwon_dc["company_name_ko"],
            "facility_name": suwon_dc["company_name_ko"],
            "report_year": 2024,
            "category": "온실가스",
            "category_embedding": None,
            "description": (
                "데이터센터 단위 에너지 효율 개선(냉방·냉각 최적화, LED 전면 교체)로 Scope2 위치기반 배출 전년 대비 6.1% 감축."
            ),
            "description_embedding": None,
            "related_dp_ids": ["ENV_GHG_REDUCTION_002", "DP-GHG-SCOPE2"],
            "quantitative_data": {
                "Scope2_위치기반_tCO2eq": 1240.5,
                "전년대비_감축률_퍼센트": 6.1,
                "절감전력_MWh": 320,
            },
            "data_source": "EMS 연동",
            "submitted_by": "EHS 데이터관리",
            "submission_date": "2024-12-05",
        },
        {
            "id": row_uuid(6),
            "company_id": parent_id,
            "contributor_company_id": multicampus["id"],
            "subsidiary_name": multicampus["company_name_ko"],
            "facility_name": f"{multicampus['company_name_ko']} 역삼 캠퍼스",
            "report_year": 2023,
            "category": "인권·다양성",
            "category_embedding": None,
            "description": (
                "전 임직원 대상 인권·다양성 필수 교육 이수율 99.2%, 장애인 고용 목표 대비 달성률 103%."
            ),
            "description_embedding": None,
            "related_dp_ids": ["DP-HR-DIVERSITY", "SOC_HR_TRAINING_001"],
            "quantitative_data": {
                "필수교육_이수율_퍼센트": 99.2,
                "장애인고용_목표대비_퍼센트": 103,
                "교육시간_합계_시간": 18500,
            },
            "data_source": "HR 시스템",
            "submitted_by": "HR담당",
            "submission_date": "2023-12-18",
        },
    ]


def build_rows() -> tuple[list[dict], str]:
    companies = load_companies()
    holding, contributors = holding_and_children(companies)
    parent_id = holding["id"]

    rows = fixed_rows(parent_id, companies)
    n = len(contributors)
    for i in range(7, 101):
        cat, dps = CATEGORIES[(i - 1) % len(CATEGORIES)]
        c = contributors[(i - 1) % n]
        sub = c["company_name_ko"]
        fac = f"{sub} ESG 거점 #{i:03d}"
        year = 2023 if i % 3 == 0 else 2024
        month = 1 + (i % 12)
        day = 1 + (i % 28)
        rows.append(
            {
                "id": row_uuid(i),
                "company_id": parent_id,
                "contributor_company_id": c["id"],
                "subsidiary_name": sub,
                "facility_name": fac,
                "report_year": year,
                "category": cat,
                "category_embedding": None,
                "description": description_for(i, sub, fac, year, cat),
                "description_embedding": None,
                "related_dp_ids": list(dps),
                "quantitative_data": quantitative_for(i, cat),
                "data_source": DATA_SOURCES[i % len(DATA_SOURCES)],
                "submitted_by": f"{TEAMS[i % len(TEAMS)]} / 담당자-{i:03d}",
                "submission_date": f"{year}-{month:02d}-{day:02d}",
            }
        )
    return rows, parent_id


def write_sql(rows: list[dict]) -> None:
    lines = [
        "-- 더미 데이터: subsidiary_data_contributions (100건)",
        "-- 컨텍스트: REVISED_WORKFLOW §8 — 모회사 기준 계열사·사업장별 서술·정량·DP 연결.",
        "-- 사전 조건: alembic 037_subs_ext_company_data 적용, company_id 가 companies.id 에 존재",
        '-- 적용: psql "$DATABASE_URL" -f backend/scripts/seeds/subsidiary_data_contributions_dummy.sql',
        "-- 재생성: python backend/scripts/seeds/generate_subsidiary_data_contributions_dummy_100.py",
        "",
        "BEGIN;",
        "",
        "-- 모회사 UUID (companies.json 지주사 id) — 필요 시 교체",
        f"-- {rows[0]['company_id']}",
        "",
        "INSERT INTO subsidiary_data_contributions (",
        "    id,",
        "    company_id,",
        "    subsidiary_name,",
        "    facility_name,",
        "    report_year,",
        "    category,",
        "    category_embedding,",
        "    description,",
        "    description_embedding,",
        "    related_dp_ids,",
        "    quantitative_data,",
        "    data_source,",
        "    submitted_by,",
        "    submission_date",
        ") VALUES",
    ]
    value_parts = []
    for r in rows:
        dps_sql = ", ".join(f"'{sql_escape(x)}'" for x in r["related_dp_ids"])
        qjson = sql_escape(json.dumps(r["quantitative_data"], ensure_ascii=False))
        value_parts.append(
            "(\n"
            f"    '{r['id']}'::uuid,\n"
            f"    '{r['company_id']}'::uuid,\n"
            f"    '{sql_escape(r['subsidiary_name'])}',\n"
            f"    '{sql_escape(r['facility_name'])}',\n"
            f"    {r['report_year']},\n"
            f"    '{sql_escape(r['category'])}',\n"
            "    NULL,\n"
            f"    '{sql_escape(r['description'])}',\n"
            "    NULL,\n"
            f"    ARRAY[{dps_sql}]::text[],\n"
            f"    '{qjson}'::jsonb,\n"
            f"    '{sql_escape(r['data_source'])}',\n"
            f"    '{sql_escape(r['submitted_by'])}',\n"
            f"    '{r['submission_date']}'::date\n"
            ")"
        )
    lines.append(",\n".join(value_parts) + ";")
    lines.append("")
    lines.append(
        "-- 유사도 검색(HNSW) 검증: 1번 행(동탄 DC 2024)에만 1024차원 더미 벡터"
    )
    lines.append("UPDATE subsidiary_data_contributions AS t")
    lines.append("SET")
    lines.append("    category_embedding = sub.v,")
    lines.append("    description_embedding = sub.v")
    lines.append("FROM (")
    lines.append(
        "    SELECT ('[' || string_agg('0.001', ',') || ']')::vector AS v"
    )
    lines.append("    FROM generate_series(1, 1024)")
    lines.append(") sub")
    lines.append(f"WHERE t.id = '{row_uuid(1)}'::uuid;")
    lines.append("")
    lines.append("COMMIT;")
    OUT_SQL.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    rows, _parent_id = build_rows()
    OUT_JSON.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    write_sql(rows)
    print(f"Wrote {len(rows)} rows -> {OUT_JSON.name}, {OUT_SQL.name}")


if __name__ == "__main__":
    main()
