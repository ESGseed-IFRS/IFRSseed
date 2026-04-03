"""이미지 캡셔닝 서비스

PDF에서 추출한 이미지에 대한 텍스트 설명을 생성합니다.
BLIP-2 모델을 사용합니다.
"""
from typing import Optional
from pathlib import Path
from loguru import logger


class ImageCaptionService:
    """이미지 캡셔닝 서비스
    
    이미지에 대한 텍스트 설명을 생성하여 벡터 검색에 활용합니다.
    BLIP-2 모델을 사용하여 로컬에서 실행합니다.
    """
    
    def __init__(self):
        """이미지 캡셔닝 서비스 초기화"""
        self._blip_available = False
        
        # 라이브러리 가용성 확인
        self._check_availability()
    
    def _check_availability(self):
        """사용 가능한 모델 확인"""
        try:
            from transformers import BlipProcessor, BlipForConditionalGeneration
            self._blip_available = True
            logger.info("✅ BLIP 모델 사용 가능")
        except ImportError:
            pass
    
    def generate_caption(
        self,
        image_path: str,
        model_type: str = "auto"
    ) -> Optional[str]:
        """이미지에 대한 텍스트 설명 생성
        
        Args:
            image_path: 이미지 파일 경로
            model_type: 모델 타입 ("blip", "auto")
        
        Returns:
            이미지 설명 텍스트
        """
        if not Path(image_path).exists():
            logger.error(f"❌ 이미지 파일을 찾을 수 없습니다: {image_path}")
            return None
        
        # BLIP 모델 사용
        if model_type == "blip" or (model_type == "auto" and self._blip_available):
            caption = self._caption_with_blip(image_path)
            if caption:
                return caption
        
        # Fallback: 간단한 설명
        logger.warning("⚠️ Vision 모델을 사용할 수 없어 기본 설명을 생성합니다.")
        return self._generate_basic_description(image_path)
    
    def _caption_with_blip(self, image_path: str) -> Optional[str]:
        """BLIP-2로 이미지 캡셔닝"""
        if not self._blip_available:
            return None
        
        try:
            from transformers import BlipProcessor, BlipForConditionalGeneration
            from PIL import Image
            import torch
            
            logger.debug(f"🖼️ BLIP로 이미지 캡셔닝 중: {image_path}")
            
            # 모델 로드 (최초 1회만)
            if not hasattr(self, '_blip_processor'):
                self._blip_processor = BlipProcessor.from_pretrained(
                    "Salesforce/blip-image-captioning-base"
                )
                self._blip_model = BlipForConditionalGeneration.from_pretrained(
                    "Salesforce/blip-image-captioning-base"
                )
                # GPU 사용 가능하면 GPU로
                device = "cuda" if torch.cuda.is_available() else "cpu"
                self._blip_model = self._blip_model.to(device)
            
            # 이미지 로드 및 처리
            image = Image.open(image_path).convert("RGB")
            inputs = self._blip_processor(image, return_tensors="pt")
            
            # 캡션 생성
            device = next(self._blip_model.parameters()).device
            inputs = {k: v.to(device) for k, v in inputs.items()}
            
            out = self._blip_model.generate(**inputs, max_length=200)
            caption = self._blip_processor.decode(out[0], skip_special_tokens=True)
            
            logger.debug(f"✅ BLIP 캡션 생성 완료: {caption[:100]}...")
            return caption
            
        except Exception as e:
            logger.error(f"❌ BLIP 캡셔닝 실패: {e}")
            return None
    
    def _generate_basic_description(self, image_path: str) -> str:
        """기본 설명 생성 (Fallback)"""
        image_path_obj = Path(image_path)
        filename = image_path_obj.name
        
        # 파일명에서 정보 추출
        if "_p" in filename:
            parts = filename.split("_p")
            if len(parts) > 1:
                page_info = parts[1].split("_")[0]
                return f"페이지 {page_info}의 이미지 또는 차트"
        
        return "ESG 보고서의 이미지 또는 차트"
    
    def classify_image_type(self, image_path: str) -> str:
        """이미지 타입 분류
        
        Args:
            image_path: 이미지 파일 경로
        
        Returns:
            이미지 타입 ("chart", "table", "infographic", "photo", "diagram", "unknown")
        """
        # 간단한 휴리스틱 (향후 ML 모델로 개선 가능)
        filename = Path(image_path).name.lower()
        
        if "chart" in filename or "graph" in filename:
            return "chart"
        elif "table" in filename or "표" in filename:
            return "table"
        elif "infographic" in filename or "인포그래픽" in filename:
            return "infographic"
        elif "photo" in filename or "사진" in filename:
            return "photo"
        else:
            # 파일명으로 판단 불가능하면 기본값
            return "chart"  # ESG 보고서에서는 대부분 차트/그래프
    
    def is_meaningful_image(self, caption: str, image_path: Optional[str] = None) -> bool:
        """이미지가 의미있는지 판단 (차트, 그래프, 표 등 데이터 관련 이미지인지)
        
        Args:
            caption: 이미지 설명 텍스트
            image_path: 이미지 파일 경로 (선택적)
        
        Returns:
            True면 의미있는 이미지, False면 제외할 이미지
        """
        if not caption:
            return False
        
        caption_lower = caption.lower()
        
        # 유용한 키워드 (데이터, 차트, 그래프 관련)
        useful_keywords = [
            "chart", "graph", "table", "diagram", "figure", "data",
            "statistics", "statistic", "trend", "analysis", "report",
            "metric", "indicator", "measurement", "measure", "value",
            "number", "percentage", "percent", "ratio", "comparison",
            "increase", "decrease", "growth", "decline", "change",
            "emission", "carbon", "energy", "water", "waste", "recycle",
            "sustainability", "esg", "environmental", "social", "governance",
            "financial", "performance", "result", "outcome", "target",
            "goal", "objective", "strategy", "plan", "framework",
            "matrix", "map", "timeline", "process", "flow", "structure",
            "organization", "hierarchy", "system", "model", "methodology"
        ]
        
        # 제외할 키워드 (사람, 동물 등만 있는 이미지)
        exclude_keywords = [
            "person", "people", "man", "woman", "child", "children",
            "animal", "dog", "cat", "bird", "wildlife",
            "portrait", "photo", "picture", "image", "photograph"
        ]
        
        # 유용한 키워드가 있는지 확인
        has_useful_keyword = any(keyword in caption_lower for keyword in useful_keywords)
        
        # 제외 키워드만 있는지 확인 (유용한 키워드 없이 제외 키워드만 있으면 제외)
        has_only_exclude_keywords = (
            any(keyword in caption_lower for keyword in exclude_keywords) and
            not has_useful_keyword
        )
        
        # 유용한 키워드가 있거나, 제외 키워드만 있는 경우가 아니면 포함
        if has_useful_keyword:
            return True
        
        # 제외 키워드만 있으면 제외
        if has_only_exclude_keywords:
            logger.debug(f"⚠️ 의미없는 이미지로 판단 (제외): {caption[:100]}")
            return False
        
        # 키워드가 없으면 기본적으로 포함 (보수적 접근)
        return True
