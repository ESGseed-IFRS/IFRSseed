"""PDF를 파싱하여 벡터 DB에 저장하는 스크립트

Repository 패턴을 사용하여 PDF 문서를 파싱하고 벡터 DB에 저장합니다.
"""
import sys
import argparse
from pathlib import Path
from loguru import logger

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(project_root / "ai"))

from dotenv import load_dotenv

# .env 파일 로드
env_path = project_root / ".env"
if env_path.exists():
    load_dotenv(env_path)

from ifrs_agent.service.document_service import DocumentService


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(
        description="PDF를 파싱하여 벡터 DB에 저장"
    )
    parser.add_argument(
        "--pdf-path",
        type=str,
        required=True,
        help="PDF 파일 경로"
    )
    parser.add_argument(
        "--document-type",
        type=str,
        default="standard",
        choices=["standard", "report", "guidance"],
        help="문서 유형"
    )
    parser.add_argument(
        "--standard",
        type=str,
        default=None,
        help="기준서 코드 (예: IFRS_S2, GRI, TCFD)"
    )
    parser.add_argument(
        "--company-id",
        type=str,
        default=None,
        help="기업 ID (보고서인 경우)"
    )
    parser.add_argument(
        "--fiscal-year",
        type=int,
        default=None,
        help="회계연도 (보고서인 경우)"
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=None,
        help="청크 크기 (문자 수, 기본값: 설정값 사용)"
    )
    parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=None,
        help="청크 겹침 (문자 수, 기본값: 설정값 사용)"
    )
    parser.add_argument(
        "--parser",
        type=str,
        default="auto",
        choices=["auto", "llamaparse", "unstructured", "pymupdf"],
        help="PDF 파서 타입"
    )
    parser.add_argument(
        "--image-min-size",
        type=int,
        default=1000,
        help="최소 이미지 크기 (픽셀, width * height, 기본값: 1000)"
    )
    parser.add_argument(
        "--no-filter-images",
        action="store_true",
        help="의미없는 이미지 필터링 비활성화 (기본값: 필터링 활성화)"
    )
    
    args = parser.parse_args()
    
    # DocumentService 인스턴스 생성
    document_service = DocumentService()
    
    # PDF 저장
    saved_count = document_service.store_pdf_to_vector_db(
        pdf_path=args.pdf_path,
        document_type=args.document_type,
        standard=args.standard,
        company_id=args.company_id,
        fiscal_year=args.fiscal_year,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
        parser_type=args.parser,
        image_min_size=args.image_min_size,
        filter_meaningless_images=not args.no_filter_images
    )
    
    if saved_count > 0:
        logger.info(f"✅ 완료! {saved_count}개 청크가 벡터 DB에 저장되었습니다.")
    else:
        logger.error("❌ 저장 실패")


if __name__ == "__main__":
    main()

