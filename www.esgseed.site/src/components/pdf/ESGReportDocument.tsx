import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { CompanyData, ReportMetadata, PreviewSection, ChartData, RenewableTableRow } from '@/store/reportStore';

// 한글 폰트 등록 (Noto Sans KR)
// TTF 파일을 사용 (woff2는 react-pdf에서 지원하지 않을 수 있음)
Font.register({
  family: 'NotoSansKR',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Regular.otf',
      fontWeight: 'normal',
      fontStyle: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Regular.otf',
      fontWeight: 'normal',
      fontStyle: 'italic',
    },
    {
      src: 'https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Bold.otf',
      fontWeight: 'bold',
      fontStyle: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/ea/notosanskr/v2/NotoSansKR-Bold.otf',
      fontWeight: 'bold',
      fontStyle: 'italic',
    },
  ],
});

// 스타일 정의
const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
  },
  coverPage: {
    padding: 60,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#669900',
    fontFamily: 'NotoSansKR',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 40,
    textAlign: 'center',
    color: '#333333',
    fontFamily: 'NotoSansKR',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#669900',
    borderBottom: '2px solid #99cc00',
    paddingBottom: 5,
    fontFamily: 'NotoSansKR',
  },
  text: {
    fontSize: 11,
    lineHeight: 1.6,
    marginBottom: 8,
    color: '#333333',
    fontFamily: 'NotoSansKR',
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666666',
    marginTop: 8,
    fontFamily: 'NotoSansKR',
  },
  value: {
    fontSize: 11,
    color: '#333333',
    marginBottom: 6,
    fontFamily: 'NotoSansKR',
  },
  metadata: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 4,
    fontFamily: 'NotoSansKR',
  },
  badge: {
    backgroundColor: '#99cc00',
    color: '#ffffff',
    padding: '6 12',
    borderRadius: 4,
    fontSize: 10,
    marginBottom: 20,
    fontFamily: 'NotoSansKR',
  },
  tableOfContents: {
    marginTop: 20,
  },
  tocItem: {
    fontSize: 11,
    marginBottom: 6,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontFamily: 'NotoSansKR',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: '#999999',
    fontFamily: 'NotoSansKR',
  },
  header: {
    position: 'absolute',
    top: 20,
    left: 40,
    right: 40,
    fontSize: 9,
    color: '#999999',
    borderBottom: '1px solid #eeeeee',
    paddingBottom: 5,
    fontFamily: 'NotoSansKR',
  },
});

interface ESGReportDocumentProps {
  companyInfo: CompanyData | null;
  reportMetadata: ReportMetadata;
  contentSections: PreviewSection[];
  charts: ChartData[];
  renewableTable: RenewableTableRow[];
}

export const ESGReportDocument: React.FC<ESGReportDocumentProps> = ({
  companyInfo,
  reportMetadata,
  contentSections,
  charts,
  renewableTable,
}) => {
  const companyName = companyInfo?.companyName || '회사명 미입력';
  const reportYear = reportMetadata.reportYear;

  // 디버그: 콘솔에 데이터 출력
  console.log('=== PDF 생성 데이터 ===');
  console.log('CompanyInfo:', companyInfo);
  console.log('ContentSections:', contentSections);
  console.log('Charts:', charts);
  console.log('ReportMetadata:', reportMetadata);

  return (
    <Document>
      {/* 표지 페이지 */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <Text style={styles.title}>{reportYear} 지속가능경영 보고서</Text>
          <Text style={styles.subtitle}>{companyName}</Text>
          <View style={styles.badge}>
            <Text style={{ fontFamily: 'NotoSansKR' }}>IFRS 기준 준수</Text>
          </View>
          <View style={{ marginTop: 40, width: '60%' }}>
            <View style={styles.metadata}>
              <Text style={{ fontFamily: 'NotoSansKR' }}>발행일: {new Date(reportMetadata.lastUpdated).toLocaleDateString('ko-KR')}</Text>
            </View>
            <View style={styles.metadata}>
              <Text style={{ fontFamily: 'NotoSansKR' }}>보고 기간: {reportMetadata.reportPeriod}</Text>
            </View>
            <View style={styles.metadata}>
              <Text style={{ fontFamily: 'NotoSansKR' }}>언어: {reportMetadata.language}</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* 회사 개요 페이지 - CompanyInfoPage 데이터 */}
      {companyInfo ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.header}>
            {reportYear} 지속가능경영 보고서 | {companyName}
          </Text>
          
          <View style={{ marginTop: 40 }}>
            <Text style={styles.sectionTitle}>회사 개요</Text>
            <Text style={{ fontSize: 10, color: '#666666', marginBottom: 15, fontFamily: 'NotoSansKR' }}>
              * CompanyInfoPage에서 입력된 데이터
            </Text>

            <View style={styles.section}>
              <Text style={styles.label}>■ 기업 기본정보</Text>
              <Text style={styles.value}>• 회사명: {companyInfo.companyName || 'N/A'}</Text>
              <Text style={styles.value}>• 사업자등록번호: {companyInfo.businessNumber || 'N/A'}</Text>
              <Text style={styles.value}>• 대표자명: {companyInfo.ceoName || 'N/A'}</Text>
              <Text style={styles.value}>• 업종: {companyInfo.industry || 'N/A'}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>■ 연락처 정보</Text>
              <Text style={styles.value}>• 주소: {companyInfo.address || 'N/A'}</Text>
              <Text style={styles.value}>• 전화: {companyInfo.phone || 'N/A'}</Text>
              <Text style={styles.value}>• 이메일: {companyInfo.email || 'N/A'}</Text>
              <Text style={styles.value}>• 웹사이트: {companyInfo.website || 'N/A'}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>■ 미션 및 비전</Text>
              <Text style={styles.text}>미션: {companyInfo.mission || 'N/A'}</Text>
              <Text style={styles.text}>비전: {companyInfo.vision || 'N/A'}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>■ ESG 핵심 목표</Text>
              <Text style={styles.text}>{companyInfo.esgGoals || 'N/A'}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>■ 이해관계자 정보</Text>
              <Text style={styles.value}>• 임직원 수: {companyInfo.employees ? `${companyInfo.employees}명` : 'N/A'}</Text>
              <Text style={styles.text}>• 주요 주주:</Text>
              <Text style={{ fontSize: 10, color: '#333333', marginLeft: 15, marginBottom: 6, fontFamily: 'NotoSansKR' }}>
                {companyInfo.shareholders || 'N/A'}
              </Text>
              <Text style={styles.text}>• 기타 이해관계자:</Text>
              <Text style={{ fontSize: 10, color: '#333333', marginLeft: 15, marginBottom: 6, fontFamily: 'NotoSansKR' }}>
                {companyInfo.stakeholders || 'N/A'}
              </Text>
              <Text style={styles.text}>• 소통 채널:</Text>
              <Text style={{ fontSize: 10, color: '#333333', marginLeft: 15, marginBottom: 6, fontFamily: 'NotoSansKR' }}>
                {companyInfo.communication || 'N/A'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      ) : (
        <Page size="A4" style={styles.page}>
          <Text style={styles.header}>
            {reportYear} 지속가능경영 보고서
          </Text>
          
          <View style={{ marginTop: 100, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#999999', marginBottom: 20, fontFamily: 'NotoSansKR' }}>
              ⚠ 회사 정보가 입력되지 않았습니다
            </Text>
            <Text style={{ fontSize: 11, color: '#666666', textAlign: 'center', fontFamily: 'NotoSansKR' }}>
              CompanyInfoPage에서 회사 정보를 입력한 후{'\n'}
              다시 PDF를 생성해주세요.
            </Text>
          </View>
          
          <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      )}

      {/* 문단 생성 내용 페이지 - ContentGenerationPage 데이터 */}
      {contentSections.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.header}>
            {reportYear} 지속가능경영 보고서 | {companyName}
          </Text>
          
          <View style={{ marginTop: 40 }}>
            <Text style={styles.sectionTitle}>지속가능경영 전략 및 실행</Text>
            <Text style={{ fontSize: 10, color: '#666666', marginBottom: 15, fontFamily: 'NotoSansKR' }}>
              * ContentGenerationPage의 AI 생성 문단 ({contentSections.length}개 섹션)
            </Text>

            {contentSections.map((section, index) => (
              <View key={section.id || index} style={styles.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ 
                    fontSize: 9, 
                    color: '#ffffff', 
                    backgroundColor: '#669900',
                    padding: '4 8',
                    borderRadius: 3,
                    marginRight: 8,
                    fontFamily: 'NotoSansKR'
                  }}>
                    {index + 1}
                  </Text>
                  <Text style={styles.label}>{section.title}</Text>
                </View>
                <Text style={styles.text}>{section.content}</Text>
                {section.aiComment && (
                  <View style={{
                    backgroundColor: section.commentType === 'warning' ? '#FEF2F2' : '#EFF6FF',
                    padding: 8,
                    borderRadius: 4,
                    marginTop: 8,
                    borderLeft: `3px solid ${section.commentType === 'warning' ? '#EF4444' : '#3B82F6'}`
                  }}>
                    <Text style={{ 
                      fontSize: 9, 
                      color: section.commentType === 'warning' ? '#991B1B' : '#1E40AF',
                      fontWeight: 'bold',
                      marginBottom: 3,
                      fontFamily: 'NotoSansKR'
                    }}>
                      ▶ AI 코멘트
                    </Text>
                    <Text style={{ 
                      fontSize: 9, 
                      color: section.commentType === 'warning' ? '#991B1B' : '#1E40AF',
                      lineHeight: 1.4,
                      fontFamily: 'NotoSansKR'
                    }}>
                      {section.aiComment}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
          
          <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      )}

      {/* 차트 및 데이터 페이지 - ChartsPage 데이터 */}
      {(charts.length > 0 || (renewableTable && renewableTable.length > 0)) && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.header}>
            {reportYear} 지속가능경영 보고서 | {companyName}
          </Text>
          
          <View style={{ marginTop: 40 }}>
            <Text style={styles.sectionTitle}>핵심 성과 지표 및 데이터</Text>
            <Text style={{ fontSize: 10, color: '#666666', marginBottom: 15, fontFamily: 'NotoSansKR' }}>
              * ChartsPage에서 저장된 차트 데이터 ({charts.length}개 차트)
            </Text>

            {charts.map((chart, index) => (
              <View key={chart.id || index} style={{ marginBottom: 15 }} wrap={false}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                  <Text style={{ 
                    fontSize: 8, 
                    color: '#ffffff', 
                    backgroundColor: '#99cc00',
                    padding: '3 6',
                    borderRadius: 2,
                    marginRight: 6,
                    fontFamily: 'NotoSansKR'
                  }}>
                    차트 {index + 1}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', fontFamily: 'NotoSansKR' }}>{chart.chartTitle}</Text>
                </View>
                
                <View style={{ 
                  backgroundColor: '#F9FAFB',
                  padding: 5,
                  borderRadius: 3,
                  marginBottom: 5
                }}>
                  <Text style={{ fontSize: 8, color: '#6B7280', marginBottom: 2, fontFamily: 'NotoSansKR' }}>
                    • 차트 유형: {
                      chart.chartType === 'bar' ? '막대 차트' :
                      chart.chartType === 'pie' ? '원형 차트' :
                      chart.chartType === 'line' ? '선형 차트' :
                      chart.chartType === 'area' ? '영역 차트' : chart.chartType
                    } | 데이터 소스: {chart.dataSource}
                  </Text>
                </View>
                
                {/* 차트 이미지 표시 (ChartsPage의 canvas 렌더링 결과) */}
                {chart.chartImage && (
                  <View style={{
                    marginVertical: 8,
                    padding: 6,
                    backgroundColor: '#F9FAFB',
                    borderRadius: 4,
                    border: '1px solid #E5E7EB',
                  }}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text */}
                    <Image
                      src={chart.chartImage}
                      style={{
                        width: '100%',
                        height: 180,
                        objectFit: 'contain',
                      }}
                    />
                  </View>
                )}
                
                {/* 데이터 포인트 표 형식으로 표시 */}
                <View style={{
                  border: '1px solid #E5E7EB',
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginTop: 5,
                }}>
                  <View style={{
                    flexDirection: 'row',
                    backgroundColor: '#F3F4F6',
                    borderBottom: '1px solid #E5E7EB',
                    padding: 4
                  }}>
                    <Text style={{ flex: 1, fontSize: 8, fontWeight: 'bold', color: '#374151', fontFamily: 'NotoSansKR' }}>
                      항목
                    </Text>
                    <Text style={{ width: 80, fontSize: 8, fontWeight: 'bold', color: '#374151', textAlign: 'right', fontFamily: 'NotoSansKR' }}>
                      값
                    </Text>
                  </View>
                  {chart.dataPoints.map((point, idx) => (
                    <View 
                      key={idx} 
                      style={{
                        flexDirection: 'row',
                        borderBottom: idx < chart.dataPoints.length - 1 ? '1px solid #F3F4F6' : 'none',
                        padding: 4,
                        backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB'
                      }}
                    >
                      <Text style={{ flex: 1, fontSize: 8, color: '#374151', fontFamily: 'NotoSansKR' }}>
                        {point.label}
                      </Text>
                      <Text style={{ width: 80, fontSize: 8, color: '#1F2937', textAlign: 'right', fontWeight: 'bold', fontFamily: 'NotoSansKR' }}>
                        {typeof point.value === 'number' ? point.value.toLocaleString() : point.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {/* 재생에너지 생산 표 (ChartsPage의 표 628-685) */}
            {(() => {
              // 저장된 재생에너지 표가 없으면 이 섹션을 그리지 않음
              if (!renewableTable || renewableTable.length === 0) {
                return null;
              }

              // 연도(컬럼) 정의: 저장된 표의 values key 기준
              const yearSet = new Set<string>();
              renewableTable.forEach(row => {
                Object.keys(row.values).forEach((key) => {
                  if (key.trim() !== '') yearSet.add(key);
                });
              });
              // 연도 문자열(예: "2021년")을 숫자로 변환해 오름차순 정렬
              const yearColumns = Array.from(yearSet).sort((a, b) => {
                const ay = parseInt(a.replace(/[^0-9]/g, ''), 10);
                const by = parseInt(b.replace(/[^0-9]/g, ''), 10);
                if (isNaN(ay) || isNaN(by)) return a.localeCompare(b);
                return ay - by;
              });
              
              const columnCount = yearColumns.length || 1;
              const fixedColumnWidth = 65; // 구분(25%) + 종류(25%) + 단위(15%)
              const dynamicColumnWidth = (100 - fixedColumnWidth) / columnCount;

              // ChartsPage에서 저장한 표 데이터 그대로 사용
              const tableData = renewableTable.map(row => ({
                division: row.division,
                type: row.type,
                unit: row.unit,
                values: row.values,
              }));

              // 합계 계산 함수
              const calculateTotal = (year: string): string => {
                return tableData.reduce((sum, row) => {
                  const value = row.values[year] || '-';
                  const numValue = value === '-' ? 0 : parseFloat(value) || 0;
                  return sum + numValue;
                }, 0).toFixed(2);
              };

              return (
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.sectionTitle}>재생에너지 생산</Text>
                  <Text style={{ fontSize: 8, color: '#666666', marginBottom: 10, fontFamily: 'NotoSansKR' }}>
                    데이터센터별 재생에너지 생산량 (차트 데이터 기준: {yearColumns.join(', ')})
                  </Text>

                  <View style={{
                    border: '1px solid #E5E7EB',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    {/* 테이블 헤더 */}
                    <View style={{
                      flexDirection: 'row',
                      backgroundColor: '#F3F4F6',
                      borderBottom: '1px solid #E5E7EB',
                      padding: 4
                    }}>
                      <Text style={{ width: '25%', fontSize: 8, fontWeight: 'bold', color: '#374151', fontFamily: 'NotoSansKR' }}>
                        구분
                      </Text>
                      <Text style={{ width: '25%', fontSize: 8, fontWeight: 'bold', color: '#374151', fontFamily: 'NotoSansKR' }}>
                        종류
                      </Text>
                      <Text style={{ width: '15%', fontSize: 8, fontWeight: 'bold', color: '#374151', textAlign: 'center', fontFamily: 'NotoSansKR' }}>
                        단위
                      </Text>
                      {yearColumns.map((year, idx) => (
                        <Text key={idx} style={{ width: `${dynamicColumnWidth}%`, fontSize: 8, fontWeight: 'bold', color: '#374151', textAlign: 'right', fontFamily: 'NotoSansKR' }}>
                          {year}
                        </Text>
                      ))}
                    </View>

                    {/* 테이블 본문 */}
                    {tableData.map((row, idx) => (
                      <View 
                        key={idx}
                        style={{
                          flexDirection: 'row',
                          borderBottom: idx < tableData.length - 1 ? '1px solid #F3F4F6' : '1px solid #E5E7EB',
                          padding: 4,
                          backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB'
                        }}
                      >
                        <Text style={{ width: '25%', fontSize: 8, color: '#374151', fontFamily: 'NotoSansKR' }}>
                          {row.division}
                        </Text>
                        <Text style={{ width: '25%', fontSize: 8, color: '#374151', fontFamily: 'NotoSansKR' }}>
                          {row.type}
                        </Text>
                        <Text style={{ width: '15%', fontSize: 8, color: '#374151', textAlign: 'center', fontFamily: 'NotoSansKR' }}>
                          {row.unit}
                        </Text>
                        {yearColumns.map((year, yIdx) => {
                          const value = row.values[year] || '-';
                          return (
                            <Text 
                              key={yIdx}
                              style={{ 
                                width: `${dynamicColumnWidth}%`, 
                                fontSize: 8, 
                                color: value === '-' ? '#9CA3AF' : '#2563EB', 
                                textAlign: 'right',
                                fontFamily: 'NotoSansKR'
                              }}
                            >
                              {value}
                            </Text>
                          );
                        })}
                      </View>
                    ))}

                    {/* 합계 행 */}
                    <View style={{
                      flexDirection: 'row',
                      backgroundColor: '#F3F4F6',
                      padding: 4
                    }}>
                      <Text style={{ width: '65%', fontSize: 8, fontWeight: 'bold', color: '#374151', textAlign: 'center', fontFamily: 'NotoSansKR' }}>
                        합계
                      </Text>
                      {yearColumns.map((year, idx) => (
                        <Text key={idx} style={{ width: `${dynamicColumnWidth}%`, fontSize: 8, fontWeight: 'bold', color: '#2563EB', textAlign: 'right', fontFamily: 'NotoSansKR' }}>
                          {calculateTotal(year)}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
          
          <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      )}

      {/* 목차 페이지 */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>
          {reportYear} 지속가능경영 보고서 | {companyName}
        </Text>
        
        <View style={{ marginTop: 40 }}>
          <Text style={styles.sectionTitle}>목차</Text>

          <View style={styles.tableOfContents}>
            <View style={styles.tocItem}>
              <Text>CEO 메시지</Text>
              <Text>3</Text>
            </View>
            <View style={styles.tocItem}>
              <Text>회사 개요</Text>
              <Text>5</Text>
            </View>
            <View style={styles.tocItem}>
              <Text>지속가능경영 전략</Text>
              <Text>8</Text>
            </View>
            <View style={styles.tocItem}>
              <Text>환경 성과 (Environmental)</Text>
              <Text>12</Text>
            </View>
            <View style={styles.tocItem}>
              <Text>사회적 책임 (Social)</Text>
              <Text>20</Text>
            </View>
            <View style={styles.tocItem}>
              <Text>지배구조 (Governance)</Text>
              <Text>28</Text>
            </View>
            <View style={styles.tocItem}>
              <Text>핵심 성과 지표 (KPI)</Text>
              <Text>35</Text>
            </View>
            <View style={styles.tocItem}>
              <Text>향후 계획 및 목표</Text>
              <Text>40</Text>
            </View>
          </View>
        </View>
        
        <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>
    </Document>
  );
};

