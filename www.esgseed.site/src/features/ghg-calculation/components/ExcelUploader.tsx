'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ExcelUploadData } from '../types/ghg.types';

// 필요한 패키지 설치: npm install xlsx
import * as XLSX from 'xlsx';

interface ExcelUploaderProps {
  /** 필수 컬럼 목록 */
  requiredColumns: string[];
  /** 업로드 완료 콜백 */
  onUploadComplete: (data: ExcelUploadData) => void;
  /** Scope 타입 */
  scope: 'scope1' | 'scope2' | 'scope3';
  /** 최대 행 수 제한 */
  maxRows?: number;
}

/**
 * 엑셀 업로드 컴포넌트
 * 드래그 앤 드롭 및 파일 선택을 통한 엑셀 파일 업로드 및 파싱
 */
export function ExcelUploader({
  requiredColumns,
  onUploadComplete,
  scope,
  maxRows = 1000,
}: ExcelUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadData, setUploadData] = useState<ExcelUploadData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 파일 파싱 함수 (xlsx 라이브러리 사용)
  const parseExcelFile = async (file: File): Promise<ExcelUploadData | null> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            reject(new Error('파일을 읽을 수 없습니다.'));
            return;
          }

          const workbook = XLSX.read(data, { type: 'array' });
          
          // 첫 번째 시트 사용
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // JSON으로 변환
          const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 }) as unknown as any[][];
          
          if (jsonData.length === 0) {
            reject(new Error('엑셀 파일이 비어있습니다.'));
            return;
          }

          // 첫 번째 행을 헤더로 사용
          const headersRaw = (jsonData[0] as any[]).map((h) => String(h ?? '').trim());
          const headers = headersRaw.filter((h) => h.length > 0);
          const rows = (jsonData.slice(1) as any[][]).map((row) => {
            const obj: Record<string, any> = {};
            headers.forEach((header, index) => (obj[header] = row?.[index]));
            return obj;
          });

          // 필수 컬럼 검증
          const missingColumns = requiredColumns.filter(
            (col) => !headers.some((h) => h.toLowerCase().includes(col.toLowerCase()))
          );

          const validation = {
            isValid: missingColumns.length === 0,
            errors: missingColumns.length > 0 
              ? [`필수 컬럼이 누락되었습니다: ${missingColumns.join(', ')}`]
              : [],
            missingColumns,
          };

          // 행 수 제한 검증
          if (rows.length > maxRows) {
            validation.errors.push(`행 수가 너무 많습니다. 최대 ${maxRows}행까지 허용됩니다.`);
            validation.isValid = false;
          }

          resolve({
            sheetName: firstSheetName,
            rows: rows.slice(0, maxRows),
            validation,
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsArrayBuffer(file);
    });
  };

  // 파일 선택 핸들러
  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.');
      return;
    }

    setIsProcessing(true);
    try {
      const data = await parseExcelFile(file);
      if (data) {
        setUploadData(data);
        if (!data.validation.isValid) {
          toast.warning('파일 검증에 실패했습니다. 필수 컬럼을 확인해주세요.');
        } else {
          toast.success('엑셀 파일이 성공적으로 업로드되었습니다.');
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '파일 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 드래그 앤 드롭 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      const excelFile = files.find(
        (f) => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
      );

      if (excelFile) {
        handleFileSelect(excelFile);
      } else {
        toast.error('엑셀 파일만 업로드 가능합니다.');
      }
    },
    [handleFileSelect]
  );

  // 파일 입력 핸들러
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // 데이터 확인 및 적용
  const handleConfirm = () => {
    if (uploadData && uploadData.validation.isValid) {
      onUploadComplete(uploadData);
      setUploadData(null);
      toast.success('데이터가 적용되었습니다.');
    } else {
      toast.error('검증에 실패한 데이터는 적용할 수 없습니다.');
    }
  };

  // 업로드 취소
  const handleCancel = () => {
    setUploadData(null);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">엑셀 업로드</CardTitle>
        </div>
        <CardDescription className="text-xs">
          엑셀 파일을 업로드하여 데이터를 일괄 입력하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* 드래그 앤 드롭 영역 */}
        {!uploadData && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
              border-2 border-dashed rounded-lg p-6 text-center transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50'}
            `}
            >
              <Upload className="h-10 w-10 mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium mb-1">
                엑셀 파일을 드래그 앤 드롭하거나 클릭하여 선택하세요
              </p>
              <p className="text-[10px] text-muted-foreground mb-3">
                .xlsx 파일만 지원됩니다
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
                id="excel-upload-input"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('excel-upload-input')?.click()}
                disabled={isProcessing}
                className="h-8 text-xs"
              >
                파일 선택
              </Button>
          </div>
        )}

        {/* 업로드된 데이터 미리보기 */}
        {uploadData && (
          <div className="space-y-4">
            {/* 검증 결과 */}
            <Alert
              variant={uploadData.validation.isValid ? 'default' : 'destructive'}
            >
              {uploadData.validation.isValid ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {uploadData.validation.isValid ? (
                  <span>파일 검증 완료: {uploadData.rows.length}개 행이 준비되었습니다.</span>
                ) : (
                  <div>
                    <p className="font-semibold mb-1">검증 실패:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {uploadData.validation.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>

            {/* 데이터 미리보기 테이블 */}
            {uploadData.validation.isValid && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    데이터 미리보기 (최대 10행 표시)
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleCancel}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="border rounded-md max-h-64 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {requiredColumns.map((col) => (
                          <TableHead key={col} className="text-xs">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadData.rows.slice(0, 10).map((row, idx) => (
                        <TableRow key={idx}>
                          {requiredColumns.map((col) => (
                            <TableCell key={col} className="text-xs">
                              {row[col] ?? '-'}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {uploadData.rows.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                    ... 외 {uploadData.rows.length - 10}개 행
                  </p>
                )}

                {/* 확인 버튼 */}
                <div className="flex gap-2">
                  <Button onClick={handleConfirm} className="flex-1">
                    확인 및 적용
                  </Button>
                  <Button variant="outline" onClick={handleCancel} className="flex-1">
                    취소
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 필수 컬럼 안내 */}
        <div className="p-2 bg-muted rounded-md">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">필수 컬럼</p>
          <div className="flex flex-wrap gap-1.5">
            {requiredColumns.map((col) => (
              <span
                key={col}
                className="text-[10px] px-1.5 py-0.5 bg-background rounded border text-muted-foreground"
              >
                {col}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
