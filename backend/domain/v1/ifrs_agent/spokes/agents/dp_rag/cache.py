"""
dp_rag 매핑 캐시

DP ID → 물리 위치 매핑 결과를 저장/조회
"""
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger("ifrs_agent.dp_rag.cache")

# 설정 파일 기반 캐시 (고정 매핑)
_CACHE_FILE = Path(__file__).parent / "dp_mapping_cache.json"


class DpMappingCache:
    """DP 매핑 캐시 관리."""

    def __init__(self):
        self._memory_cache: Dict[str, Dict] = {}
        self._file_cache: Dict[str, Dict] = {}
        self._load_from_file()

    def _load_from_file(self):
        """설정 파일에서 고정 매핑 로드."""
        if _CACHE_FILE.exists():
            try:
                with open(_CACHE_FILE, "r", encoding="utf-8") as f:
                    self._file_cache = json.load(f)
                logger.info("Loaded %d fixed mappings from cache file", len(self._file_cache))
            except Exception as e:
                logger.warning("Failed to load cache file: %s", e)
                self._file_cache = {}
        else:
            self._file_cache = {}

    def get(self, dp_id: str) -> Optional[Dict]:
        """
        캐시에서 매핑 조회.
        
        우선순위: 파일 캐시 (고정) > 메모리 캐시 (런타임)
        
        Returns:
            {
                "table": str,
                "column": str,
                "data_type": str?,
                "confidence": float,
                "verified": bool,
                "cached_at": str
            }
        """
        # 파일 캐시 우선 (관리자가 검증한 고정 매핑)
        if dp_id in self._file_cache:
            logger.debug("Cache hit (file): dp_id=%s", dp_id)
            return self._file_cache[dp_id]

        # 메모리 캐시 (런타임 LLM 결과)
        if dp_id in self._memory_cache:
            logger.debug("Cache hit (memory): dp_id=%s", dp_id)
            return self._memory_cache[dp_id]

        return None

    def set(
        self,
        dp_id: str,
        table: str,
        column: str,
        data_type: Optional[str],
        confidence: float,
        verified: bool = False,
    ):
        """
        매핑 결과를 메모리 캐시에 저장.
        
        verified=True일 때만 파일에 저장 (수동 관리).
        """
        mapping = {
            "table": table,
            "column": column,
            "data_type": data_type,
            "confidence": confidence,
            "verified": verified,
            "cached_at": datetime.utcnow().isoformat(),
        }

        if verified:
            # 검증된 매핑은 파일에도 저장
            self._file_cache[dp_id] = mapping
            self._save_to_file()
            logger.info("Saved verified mapping to file: dp_id=%s", dp_id)
        else:
            # 미검증 매핑은 메모리만
            self._memory_cache[dp_id] = mapping
            logger.debug("Cached mapping in memory: dp_id=%s", dp_id)

    def _save_to_file(self):
        """파일 캐시를 디스크에 저장."""
        try:
            _CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
            with open(_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self._file_cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error("Failed to save cache file: %s", e)

    def invalidate(self, dp_id: str):
        """특정 DP 캐시 무효화."""
        if dp_id in self._memory_cache:
            del self._memory_cache[dp_id]
        # 파일 캐시는 수동 관리이므로 자동 삭제 안 함

    def clear_memory(self):
        """메모리 캐시만 전체 삭제 (파일 캐시는 유지)."""
        self._memory_cache.clear()
        logger.info("Memory cache cleared")


# 싱글톤 인스턴스
_global_cache: Optional[DpMappingCache] = None


def get_cache() -> DpMappingCache:
    """전역 캐시 인스턴스 반환."""
    global _global_cache
    if _global_cache is None:
        _global_cache = DpMappingCache()
    return _global_cache
