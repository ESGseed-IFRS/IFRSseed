import pandas as pd
import sys

sys.stdout.reconfigure(encoding='utf-8')

xls_path = r"c:\Users\여태호\Downloads\GHG_배출계수_마스터_v2 (1).xlsx"
xls = pd.ExcelFile(xls_path)

print("=" * 80)
print(f"총 시트 수: {len(xls.sheet_names)}")
print("=" * 80)

for i, name in enumerate(xls.sheet_names):
    print(f"  {i}: {name}")

print("\n" + "=" * 80)
print("Sheet 3 첫 10행:")
print("=" * 80)

df = pd.read_excel(xls, sheet_name=3, header=0, nrows=10)
print(df)
