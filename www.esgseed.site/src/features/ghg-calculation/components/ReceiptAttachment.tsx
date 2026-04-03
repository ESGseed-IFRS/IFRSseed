'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, X, Image as ImageIcon, File, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { ReceiptAttachment as ReceiptAttachmentType } from '../types/ghg.types';

interface ReceiptAttachmentProps {
  /** 관련 항목 ID */
  relatedItemId?: string;
  /** 기존 첨부 파일 목록 */
  existingAttachments?: ReceiptAttachmentType[];
  /** 파일 업로드 완료 콜백 */
  onUploadComplete: (attachments: ReceiptAttachmentType[]) => void;
  /** 최대 파일 크기 (MB) */
  maxFileSize?: number;
  /** 허용된 파일 타입 */
  acceptedFileTypes?: string[];
}

/**
 * 영수증 첨부 컴포넌트
 * Scope 3 데이터 입력 시 영수증/증빙 자료를 첨부할 수 있는 컴포넌트
 */
export function ReceiptAttachment({
  relatedItemId,
  existingAttachments = [],
  onUploadComplete,
  maxFileSize = 10,
  acceptedFileTypes = ['image/*', 'application/pdf'],
}: ReceiptAttachmentProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<ReceiptAttachmentType[]>(existingAttachments);
  const [previewFiles, setPreviewFiles] = useState<Map<string, string>>(new Map());

  // 파일 미리보기 URL 생성
  const createPreviewUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } else {
        resolve('');
      }
    });
  };

  // 파일 업로드 함수
  const uploadFile = async (file: File): Promise<ReceiptAttachmentType> => {
    // 파일 크기 검증
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      throw new Error(`파일 크기가 너무 큽니다. 최대 ${maxFileSize}MB까지 허용됩니다.`);
    }

    // 파일 타입 검증
    const isAccepted = acceptedFileTypes.some((type) => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -2));
      }
      return file.type === type;
    });

    if (!isAccepted) {
      throw new Error(`지원하지 않는 파일 형식입니다. 허용된 형식: ${acceptedFileTypes.join(', ')}`);
    }

    // TODO: 실제 백엔드 API로 파일 업로드
    // 예시: const formData = new FormData(); formData.append('file', file);
    // const response = await axios.post('/api/ghg/receipts/upload', formData);
    
    // 임시 구현 (실제 API 연동 전)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const attachment: ReceiptAttachmentType = {
          id: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileUrl: URL.createObjectURL(file), // 임시 URL (실제로는 서버 URL)
          uploadedAt: new Date(),
          relatedItemId,
        };

        resolve(attachment);
      }, 1000);
    });
  };

  // 파일 선택 핸들러
  const handleFileSelect = async (files: FileList) => {
    const fileArray = Array.from(files);
    setIsUploading(true);

    try {
      const uploadPromises = fileArray.map(async (file) => {
        const attachment = await uploadFile(file);
        const previewUrl = await createPreviewUrl(file);
        if (previewUrl) {
          setPreviewFiles((prev) => new Map(prev).set(attachment.id, previewUrl));
        }
        return attachment;
      });

      const newAttachments = await Promise.all(uploadPromises);
      const updatedAttachments = [...attachments, ...newAttachments];
      setAttachments(updatedAttachments);
      onUploadComplete(updatedAttachments);
      toast.success(`${newAttachments.length}개의 파일이 업로드되었습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
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

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files);
      }
    },
    [handleFileSelect]
  );

  // 파일 입력 핸들러
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  };

  // 파일 삭제
  const handleDelete = (attachmentId: string) => {
    const updatedAttachments = attachments.filter((a) => a.id !== attachmentId);
    setAttachments(updatedAttachments);
    setPreviewFiles((prev) => {
      const newMap = new Map(prev);
      newMap.delete(attachmentId);
      return newMap;
    });
    onUploadComplete(updatedAttachments);
    toast.success('파일이 삭제되었습니다.');
  };

  // 파일 크기 포맷팅
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">영수증 첨부</CardTitle>
        </div>
        <CardDescription className="text-xs">
          증빙 자료(영수증, 계약서 등)를 첨부하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* 드래그 앤 드롭 영역 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
              border-2 border-dashed rounded-lg p-5 text-center transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-primary/50'}
            `}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-xs font-medium mb-1">
                파일을 드래그 앤 드롭하거나 클릭하여 선택하세요
              </p>
              <p className="text-[11px] text-muted-foreground mb-2">
                이미지 또는 PDF 파일 (최대 {maxFileSize}MB)
              </p>
          <input
            type="file"
            accept={acceptedFileTypes.join(',')}
            onChange={handleFileInput}
            multiple
            className="hidden"
            id="receipt-upload-input"
            disabled={isUploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('receipt-upload-input')?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                업로드 중...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                파일 선택
              </>
            )}
          </Button>
        </div>

        {/* 첨부 파일 목록 */}
        {attachments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold">첨부된 파일 ({attachments.length}개)</p>
            <div className="space-y-1.5">
              {attachments.map((attachment) => {
                const previewUrl = previewFiles.get(attachment.id);
                const isImage = attachment.fileType.startsWith('image/');
                const isPDF = attachment.fileType === 'application/pdf';

                return (
                  <div
                    key={attachment.id}
                    className="flex items-start gap-2.5 p-2.5 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {/* 미리보기 */}
                    {previewUrl && isImage ? (
                      <div className="w-12 h-12 rounded border overflow-hidden flex-shrink-0">
                        <img
                          src={previewUrl}
                          alt={attachment.fileName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : isPDF ? (
                      <div className="w-12 h-12 rounded border flex items-center justify-center bg-red-50 flex-shrink-0">
                        <File className="h-6 w-6 text-red-500" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded border flex items-center justify-center bg-gray-50 flex-shrink-0">
                        <FileText className="h-6 w-6 text-gray-400" />
                      </div>
                    )}

                    {/* 파일 정보 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{attachment.fileName}</p>
                      <p className="text-[11px] text-slate-600">
                        {formatFileSize(attachment.fileSize)} •{' '}
                        {attachment.uploadedAt.toLocaleDateString('ko-KR')}
                      </p>
                      {attachment.fileUrl && (
                        <a
                          href={attachment.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-primary hover:underline mt-0.5 inline-block"
                        >
                          파일 보기
                        </a>
                      )}
                    </div>

                    {/* 삭제 버튼 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(attachment.id)}
                      className="flex-shrink-0 h-7 w-7 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 안내 메시지 */}
        <Alert className="py-2">
          <CheckCircle2 className="h-3 w-3" />
          <AlertDescription className="text-[11px] leading-relaxed">
            영수증, 계약서, 인증서 등 증빙 자료를 첨부하면 데이터의 신뢰성을 높일 수 있습니다.
            이미지(JPG, PNG) 또는 PDF 파일을 업로드하세요.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
