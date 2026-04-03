"""data_integration 테스트: SR 본문 메타 임베딩은 기본 끔(실제 BGE 로드 방지).

앱 기본값은 SR_BODY_METADATA_EMBED 미설정 시 활성이나, 여기서는 CI·로컬 속도를 위해 0으로 둡니다.
임베딩 동작 자체는 test_sr_body_metadata_embedding 에서 명시적으로 켠 뒤 모킹합니다.
"""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _sr_body_metadata_embed_off_for_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SR_BODY_METADATA_EMBED", "0")


@pytest.fixture(autouse=True)
def _sr_image_caption_embed_off_for_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SR_IMAGE_CAPTION_EMBED", "0")
