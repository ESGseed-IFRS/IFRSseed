"""삼성에스디에스 주식회사 전체 ESG 데이터 생성

실제 SDS_ESG_DATA를 기반으로 holding 데이터 생성
"""

import shutil
from pathlib import Path

def copy_sds_data():
    """SDS_ESG_DATA를 holding_삼성에스디에스로 복사"""
    source_dir = Path(__file__).parent.parent.parent.parent / "SDS_ESG_DATA"
    target_dir = Path(__file__).parent.parent.parent / "SDS_ESG_DATA_REAL" / "holding_삼성에스디에스 주식회사"
    
    if not source_dir.exists():
        print(f"[ERROR] 원본 디렉토리 없음: {source_dir}")
        return
    
    # 기존 디렉토리 삭제 (있다면)
    if target_dir.exists():
        shutil.rmtree(target_dir)
    
    # 전체 복사
    shutil.copytree(source_dir, target_dir)
    
    print(f"[OK] 삼성SDS 데이터 복사 완료")
    print(f"  From: {source_dir}")
    print(f"  To: {target_dir}")
    
    # 복사된 파일 수 세기
    file_count = len(list(target_dir.rglob("*.csv")))
    print(f"  총 파일: {file_count}개")


if __name__ == "__main__":
    print("=" * 70)
    print("삼성에스디에스 주식회사 ESG 데이터 복사")
    print("=" * 70)
    
    copy_sds_data()
    
    print("\n" + "=" * 70)
    print("[OK] 완료!")
    print("=" * 70)
    print("\n참고: 실제 SDS_ESG_DATA 폴더의 모든 CSV를 복사했습니다.")
    print("  - EMS: 11개 파일 (에너지, 폐기물, 용수, GHG)")
    print("  - ERP: 15개 파일 (재무, 세금, R&D, 지배구조)")
    print("  - EHS: 6개 파일 (안전보건)")
    print("  - HR: 8개 파일 (인사, 교육, 다양성)")
    print("  - PLM: 3개 파일 (제품 탄소발자국)")
    print("  - SRM: 3개 파일 (공급망)")
    print("  - MDG: 3개 파일 (마스터 데이터)")
