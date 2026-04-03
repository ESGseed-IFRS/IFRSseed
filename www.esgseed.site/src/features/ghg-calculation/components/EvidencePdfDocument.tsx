'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { EvidencePayload } from '../utils/evidenceReport';

const orgLabels: Record<string, string> = {
  operational_control: '운영통제법',
  equity_share: '지분비율법',
  financial_control: '재무통제법',
};

const frameworkLabels: Record<string, string> = {
  ISSB: 'ISSB (IFRS S2)',
  KSSB: 'KSSB',
  'K-ETS': 'K-ETS',
  GRI: 'GRI 305',
  ESRS: 'ESRS E1',
};

const frameworkReportNote: Record<string, string> = {
  'K-ETS': 'K-ETS 국내 형식: 월별 에너지 사용량·Scope 1 중심',
  ISSB: 'ISSB: 연간 총합, Scope 2 위치/시장 기반, Scope 3 중대 카테고리',
  KSSB: 'KSSB: 국내 ISSB 기반, Scope 3 유예/중대성 판단',
  GRI: 'GRI 305: GHG Protocol 기반 Scope 1/2/3',
  ESRS: 'ESRS E1: double materiality, 15개 Scope 3 카테고리',
};

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10 },
  title: { fontSize: 16, marginBottom: 12, fontWeight: 'bold' },
  sectionTitle: { fontSize: 12, marginTop: 16, marginBottom: 8, fontWeight: 'bold' },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 140, fontWeight: 'bold' },
  value: { flex: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#e5e7eb', padding: 6, marginTop: 8, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', padding: 4, borderBottomWidth: 0.5, borderBottomColor: '#d1d5db' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', color: '#6b7280', fontSize: 8 },
});

interface EvidencePdfDocumentProps {
  data: EvidencePayload;
}

export function EvidencePdfDocument({ data }: EvidencePdfDocumentProps) {
  const { boundaryPolicy: bp, summary, scope1, scope2, scope3 } = data;

  const receiptList: Array<{ category: string; fileName: string; fileSize: number; uploadedAt: string }> = [];
  scope3.categories.forEach((cat) => {
    (cat.receipts ?? []).forEach((r) => {
      receiptList.push({
        category: cat.category,
        fileName: r.fileName,
        fileSize: r.fileSize,
        uploadedAt: r.uploadedAt,
      });
    });
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>GHG 증적 리포트 (Evidence Report)</Text>
        <Text style={{ marginBottom: 4 }}>생성일시: {data.generatedAt}</Text>
        {data.disclosureFramework && (
          <View style={{ marginBottom: 12 }}>
            <Text>공시 기준: {frameworkLabels[data.disclosureFramework] ?? data.disclosureFramework}</Text>
            {frameworkReportNote[data.disclosureFramework] && (
              <Text style={{ marginTop: 4, fontSize: 9, color: '#6b7280' }}>{frameworkReportNote[data.disclosureFramework]}</Text>
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>요약</Text>
        <View style={styles.row}><Text style={styles.label}>Scope 1</Text><Text style={styles.value}>{summary.scope1Tco2e.toFixed(3)} tCO₂e</Text></View>
        <View style={styles.row}><Text style={styles.label}>Scope 2</Text><Text style={styles.value}>{summary.scope2Tco2e.toFixed(3)} tCO₂e</Text></View>
        <View style={styles.row}><Text style={styles.label}>Scope 3</Text><Text style={styles.value}>{summary.scope3Tco2e.toFixed(3)} tCO₂e</Text></View>
        <View style={styles.row}><Text style={styles.label}>총 배출량</Text><Text style={styles.value}>{summary.totalTco2e.toFixed(3)} tCO₂e</Text></View>

        <Text style={styles.sectionTitle}>산정 설정 (Boundary & Policy)</Text>
        <View style={styles.row}><Text style={styles.label}>조직 경계</Text><Text style={styles.value}>{orgLabels[bp.organizationBoundary] ?? bp.organizationBoundary}</Text></View>
        <View style={styles.row}><Text style={styles.label}>보고 연도</Text><Text style={styles.value}>{bp.reportingYear}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Scope 1 포함</Text><Text style={styles.value}>{bp.operationalBoundary.scope1Included}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Scope 2 포함</Text><Text style={styles.value}>{bp.operationalBoundary.scope2Included}</Text></View>
        <View style={styles.row}><Text style={styles.label}>기준 가이드라인</Text><Text style={styles.value}>{bp.guideline ?? '-'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>EF DB 버전</Text><Text style={styles.value}>{bp.efDbVersion ?? '-'}</Text></View>

        <Text style={styles.footer}>본 문서는 GHG 산정 플랫폼에서 생성된 증적 자료입니다. (1/2)</Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Scope 1 고정 연소</Text>
        {scope1.stationary.length === 0 ? (
          <Text>데이터 없음</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={{ width: 40 }}>월</Text>
              <Text style={{ width: 80 }}>사업장</Text>
              <Text style={{ width: 90 }}>연료</Text>
              <Text style={{ width: 60 }}>사용량</Text>
              <Text style={{ width: 70 }}>배출량(tCO₂e)</Text>
              <Text style={{ width: 50 }}>데이터품질</Text>
            </View>
            {scope1.stationary.map((r) => (
              <View key={r.id} style={styles.tableRow}>
                <Text style={{ width: 40 }}>{r.month}</Text>
                <Text style={{ width: 80 }}>{r.facility}</Text>
                <Text style={{ width: 90 }}>{r.energySource}</Text>
                <Text style={{ width: 60 }}>{r.amount} {r.unit}</Text>
                <Text style={{ width: 70 }}>{(r.emissions ?? 0).toFixed(3)}</Text>
                <Text style={{ width: 50 }}>{r.dataQuality?.dataType ?? '-'}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Scope 1 이동 연소</Text>
        {scope1.mobile.length === 0 ? (
          <Text>데이터 없음</Text>
        ) : (
          scope1.mobile.slice(0, 8).map((r) => (
            <View key={r.id} style={styles.row}>
              <Text style={styles.value}>{r.month}월 {r.facility} {r.energySource} {r.amount}{r.unit} → {(r.emissions ?? 0).toFixed(3)} tCO₂e</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Scope 2 전력</Text>
        {scope2.electricity.length === 0 ? (
          <Text>데이터 없음</Text>
        ) : (
          scope2.electricity.slice(0, 6).map((r) => (
            <View key={r.id} style={styles.row}>
              <Text style={styles.value}>{r.month}월 {r.facility} {r.amount}{r.unit} → {(r.emissions ?? 0).toFixed(3)} tCO₂e</Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Scope 3 영수증 첨부 목록</Text>
        {receiptList.length === 0 ? (
          <Text>첨부된 영수증 없음</Text>
        ) : (
          <>
            <View style={styles.tableHeader}>
              <Text style={{ width: 120 }}>카테고리</Text>
              <Text style={{ width: 180 }}>파일명</Text>
              <Text style={{ width: 70 }}>크기(bytes)</Text>
              <Text style={{ flex: 1 }}>업로드일시</Text>
            </View>
            {receiptList.map((r, i) => (
              <View key={`${r.category}-${r.fileName}-${i}`} style={styles.tableRow}>
                <Text style={{ width: 120 }}>{r.category}</Text>
                <Text style={{ width: 180 }}>{r.fileName}</Text>
                <Text style={{ width: 70 }}>{r.fileSize}</Text>
                <Text style={{ flex: 1 }}>{r.uploadedAt}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer}>본 문서는 GHG 산정 플랫폼에서 생성된 증적 자료입니다. (2/2)</Text>
      </Page>
    </Document>
  );
}
