"""PDF 파싱 서비스

PDF 문서를 파싱하여 텍스트로 변환하는 서비스를 제공합니다.
이미지 추출 기능도 포함합니다.
"""
import os
from typing import Tuple, Optional, List, Dict
from pathlib import Path
from loguru import logger


class PDFParserService:
    """PDF 파싱 서비스
    
    LlamaParse, Unstructured, PyMuPDF를 순차적으로 시도하여
    PDF를 텍스트로 변환합니다.
    """
    
    def __init__(self):
        """PDF 파서 서비스 초기화"""
        self._llamaparse_available = False
        self._unstructured_available = False
        self._pymupdf_available = False
        
        # 라이브러리 가용성 확인
        self._check_availability()
    
    def _check_availability(self):
        """사용 가능한 파서 확인"""
        try:
            from llama_parse import LlamaParse
            self._llamaparse_available = True
        except ImportError:
            pass
        
        try:
            from unstructured.partition.pdf import partition_pdf
            self._unstructured_available = True
        except ImportError:
            pass
        
        try:
            import fitz  # PyMuPDF
            self._pymupdf_available = True
        except ImportError:
            pass
    
    def parse_pdf(
        self,
        pdf_path: str,
        parser_type: str = "auto"
    ) -> Tuple[Optional[str], str]:
        """PDF 파싱
        
        Args:
            pdf_path: PDF 파일 경로
            parser_type: 파서 타입 ("llamaparse", "unstructured", "pymupdf", "auto")
        
        Returns:
            (파싱된 텍스트, 사용된 파서 이름) 튜플
        """
        if parser_type == "llamaparse" or (parser_type == "auto" and self._llamaparse_available):
            text = self._parse_with_llamaparse(pdf_path)
            if text:
                return text, "llamaparse"
        
        if parser_type == "unstructured" or parser_type == "auto":
            text = self._parse_with_unstructured(pdf_path)
            if text:
                return text, "unstructured"
        
        if parser_type == "pymupdf" or parser_type == "auto":
            text = self._parse_with_pymupdf(pdf_path)
            if text:
                return text, "pymupdf"
        
        logger.error(f"❌ 모든 파서로 PDF 파싱 실패: {pdf_path}")
        return None, "none"
    
    def _parse_with_llamaparse(self, pdf_path: str) -> Optional[str]:
        """LlamaParse로 PDF 파싱"""
        if not self._llamaparse_available:
            return None
        
        try:
            from llama_parse import LlamaParse
            
            api_key = os.getenv("LLAMA_CLOUD_API_KEY")
            if not api_key:
                logger.warning("⚠️ LLAMA_CLOUD_API_KEY가 설정되지 않았습니다.")
                return None
            
            logger.info(f"📄 LlamaParse로 PDF 파싱 중: {pdf_path}")
            parser = LlamaParse(api_key=api_key, result_type="text")
            documents = parser.load_data(pdf_path)
            
            # 모든 페이지 텍스트 합치기
            text = "\n\n".join([doc.text for doc in documents])
            logger.info(f"✅ LlamaParse 파싱 완료: {len(text)}자")
            return text
            
        except ImportError:
            logger.warning("⚠️ llama-parse가 설치되지 않았습니다.")
            return None
        except Exception as e:
            logger.error(f"❌ LlamaParse 파싱 실패: {e}")
            return None
    
    def _parse_with_unstructured(self, pdf_path: str) -> Optional[str]:
        """Unstructured로 PDF 파싱"""
        if not self._unstructured_available:
            return None
        
        try:
            from unstructured.partition.pdf import partition_pdf
            
            logger.info(f"📄 Unstructured로 PDF 파싱 중: {pdf_path}")
            elements = partition_pdf(pdf_path)
            
            # 모든 요소 텍스트 합치기
            text = "\n\n".join([str(elem) for elem in elements])
            logger.info(f"✅ Unstructured 파싱 완료: {len(text)}자")
            return text
            
        except ImportError:
            logger.warning("⚠️ unstructured가 설치되지 않았습니다.")
            return None
        except Exception as e:
            logger.error(f"❌ Unstructured 파싱 실패: {e}")
            return None
    
    def _parse_with_pymupdf(self, pdf_path: str) -> Optional[str]:
        """PyMuPDF로 PDF 파싱 (Fallback)"""
        if not self._pymupdf_available:
            logger.error("❌ PyMuPDF가 설치되지 않았습니다.")
            return None
        
        try:
            import fitz  # PyMuPDF
            
            logger.info(f"📄 PyMuPDF로 PDF 파싱 중: {pdf_path}")
            doc = fitz.open(pdf_path)
            
            texts = []
            for page_num, page in enumerate(doc):
                text = page.get_text()
                texts.append(text)
            
            doc.close()
            
            full_text = "\n\n".join(texts)
            logger.info(f"✅ PyMuPDF 파싱 완료: {len(full_text)}자")
            return full_text
            
        except ImportError:
            logger.error("❌ PyMuPDF가 설치되지 않았습니다.")
            return None
        except Exception as e:
            logger.error(f"❌ PyMuPDF 파싱 실패: {e}")
            return None
    
    def split_into_chunks(
        self,
        text: str,
        chunk_size: int = 1000,
        chunk_overlap: int = 200
    ) -> list[str]:
        """텍스트를 청크로 분할
        
        Args:
            text: 분할할 텍스트
            chunk_size: 청크 크기 (문자 수)
            chunk_overlap: 청크 간 겹치는 부분 (문자 수)
        
        Returns:
            청크 리스트
        """
        if not text:
            return []
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            
            # 문장 경계에서 자르기 (개선)
            if end < len(text):
                # 마지막 문장 끝 찾기
                last_period = chunk.rfind('.')
                last_newline = chunk.rfind('\n')
                last_break = max(last_period, last_newline)
                
                if last_break > chunk_size * 0.5:  # 절반 이상이면 그 위치에서 자름
                    chunk = chunk[:last_break + 1]
                    end = start + len(chunk)
            
            chunks.append(chunk.strip())
            
            # 다음 청크 시작 위치 (overlap 고려)
            start = end - chunk_overlap
            if start >= len(text):
                break
        
        return chunks
    
    def extract_images(
        self,
        pdf_path: str,
        output_dir: Optional[str] = None,
        min_size: int = 1000  # 최소 이미지 크기 (픽셀)
    ) -> List[Dict]:
        """PDF에서 이미지 추출
        
        Args:
            pdf_path: PDF 파일 경로
            output_dir: 이미지 저장 디렉토리 (None이면 PDF와 같은 디렉토리)
            min_size: 최소 이미지 크기 (너무 작은 이미지 필터링)
        
        Returns:
            이미지 정보 리스트 [{"page": int, "index": int, "path": str, "width": int, "height": int}]
        """
        if not self._pymupdf_available:
            logger.warning("⚠️ PyMuPDF가 필요합니다. 이미지 추출을 건너뜁니다.")
            return []
        
        try:
            import fitz  # PyMuPDF
            
            pdf_path_obj = Path(pdf_path)
            if output_dir is None:
                output_dir = pdf_path_obj.parent / "images"
            else:
                output_dir = Path(output_dir)
            
            output_dir.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"🖼️ PDF에서 이미지 추출 중: {pdf_path}")
            doc = fitz.open(pdf_path)
            
            images = []
            pdf_name = pdf_path_obj.stem
            
            for page_num, page in enumerate(doc):
                image_list = page.get_images()
                
                for img_idx, img in enumerate(image_list):
                    try:
                        xref = img[0]
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]
                        width = base_image["width"]
                        height = base_image["height"]
                        
                        # 최소 크기 필터링
                        if width * height < min_size:
                            continue
                        
                        # 이미지 저장
                        image_filename = f"{pdf_name}_p{page_num+1}_i{img_idx}.png"
                        image_path = output_dir / image_filename
                        
                        with open(image_path, "wb") as f:
                            f.write(image_bytes)
                        
                        images.append({
                            "page": page_num + 1,  # 1-based
                            "index": img_idx,
                            "path": str(image_path),
                            "width": width,
                            "height": height,
                            "size_bytes": len(image_bytes)
                        })
                        
                    except Exception as e:
                        logger.warning(f"⚠️ 페이지 {page_num+1}의 이미지 {img_idx} 추출 실패: {e}")
                        continue
            
            doc.close()
            
            logger.info(f"✅ {len(images)}개 이미지 추출 완료")
            return images
            
        except ImportError:
            logger.error("❌ PyMuPDF가 설치되지 않았습니다.")
            return []
        except Exception as e:
            logger.error(f"❌ 이미지 추출 실패: {e}")
            return []


def main():
    """CLI 실행 함수 (PDF 파싱 테스트용)"""
    import argparse
    from pathlib import Path
    
    parser = argparse.ArgumentParser(
        description="PDF 파싱 서비스 테스트"
    )
    parser.add_argument(
        "--pdf-path",
        type=str,
        required=True,
        help="PDF 파일 경로"
    )
    parser.add_argument(
        "--parser",
        type=str,
        default="auto",
        choices=["auto", "llamaparse", "unstructured", "pymupdf"],
        help="PDF 파서 타입"
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=1000,
        help="청크 크기 (문자 수, 기본값: 1000)"
    )
    parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=200,
        help="청크 겹침 (문자 수, 기본값: 200)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="출력 파일 경로 (텍스트 파일로 저장, 기본값: 콘솔 출력)"
    )
    
    args = parser.parse_args()
    
    # PDF 파일 존재 확인
    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        logger.error(f"❌ PDF 파일을 찾을 수 없습니다: {args.pdf_path}")
        return
    
    # PDFParserService 인스턴스 생성
    parser_service = PDFParserService()
    
    # PDF 파싱
    logger.info(f"📄 PDF 파싱 시작: {args.pdf_path}")
    text, parser_used = parser_service.parse_pdf(args.pdf_path, args.parser)
    
    if not text:
        logger.error("❌ PDF 파싱 실패")
        return
    
    logger.info(f"✅ PDF 파싱 완료: {len(text)}자 (사용된 파서: {parser_used})")
    
    # 청크 분할 (선택적)
    if args.chunk_size > 0:
        logger.info(f"📦 텍스트를 청크로 분할 중... (chunk_size={args.chunk_size}, overlap={args.chunk_overlap})")
        chunks = parser_service.split_into_chunks(text, args.chunk_size, args.chunk_overlap)
        logger.info(f"✅ {len(chunks)}개 청크 생성 완료")
        
        # 출력
        if args.output:
            output_path = Path(args.output)
            with open(output_path, 'w', encoding='utf-8') as f:
                for i, chunk in enumerate(chunks, 1):
                    f.write(f"=== 청크 {i} ===\n")
                    f.write(chunk)
                    f.write("\n\n")
            logger.info(f"✅ 청크를 파일로 저장 완료: {args.output}")
        else:
            # 콘솔에 첫 번째 청크만 출력
            if chunks:
                logger.info(f"\n=== 첫 번째 청크 (전체 {len(chunks)}개 중) ===")
                print(chunks[0][:500] + "..." if len(chunks[0]) > 500 else chunks[0])
    else:
        # 전체 텍스트 출력
        if args.output:
            output_path = Path(args.output)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(text)
            logger.info(f"✅ 텍스트를 파일로 저장 완료: {args.output}")
        else:
            # 콘솔에 일부만 출력
            logger.info(f"\n=== 파싱된 텍스트 (처음 500자) ===")
            print(text[:500] + "..." if len(text) > 500 else text)


if __name__ == "__main__":
    main()
