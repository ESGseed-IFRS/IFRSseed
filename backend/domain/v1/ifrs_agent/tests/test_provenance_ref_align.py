"""provenance_ref_align 단위 테스트."""
from backend.domain.v1.ifrs_agent.hub.orchestrator.provenance_ref_align import (
    enrich_data_provenance_with_sr_spans,
    split_body_sentence_spans,
)


def test_split_body_sentence_spans():
    text = "첫 문장입니다. 두 번째 문장입니다. 세 번째!"
    spans = split_body_sentence_spans(text)
    assert len(spans) == 3
    assert "첫 문장입니다." in spans[0][2]


def test_enrich_sr_reference_anchors():
    body = (
        "삼성에스디에스는 각 사업장의 온실가스 배출량을 Scope별로 체계적으로 관리하고 있습니다. "
        "당사는 데이터센터 전력 사용이 큽니다."
    )
    gen_input = {
        "ref_2024": {"page_number": 39, "body_text": body},
    }
    prov = {
        "quantitative_sources": [],
        "qualitative_sources": [
            {
                "source_type": "sr_reference",
                "source_details": {"year": 2024, "page_number": 39},
                "used_in_sentences": [
                    "삼성에스디에스는 각 사업장의 온실가스 배출량을 Scope별로 체계적으로 관리하고 있습니다.",
                ],
            }
        ],
        "reference_pages": {},
    }
    out = enrich_data_provenance_with_sr_spans(prov, gen_input)
    qual = out["qualitative_sources"][0]
    d = qual["source_details"]
    assert "reference_location_ko" in d
    assert "39페이지" in d["reference_location_ko"]
    assert "번째 문장" in d["reference_location_ko"]
    assert "참조 원문" in d["reference_location_ko"]
    assert "삼성에스디에스는 각 사업장" in d["reference_location_ko"]
    assert "sr_reference_anchors" in d
    assert d["sr_reference_anchors"][0]["ref_sentence_index_1based"] == 1
    assert d["sr_reference_anchors"][0]["ref_char_start"] is not None
    assert "삼성에스디에스는 각 사업장" in d["sr_reference_anchors"][0]["ref_sentence_excerpt"]
