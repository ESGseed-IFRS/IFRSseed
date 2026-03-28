import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const mdPath = path.join(root, 'md_files/04_SR_Report/02_PAGE/삼성SDS_SR보고서_2024_지표.md');
const outPath = path.join(root, 'src/app/(main)/sr-report/lib/holdingSrSds2024Pages.generated.ts');

const text = fs.readFileSync(mdPath, 'utf8');

function sectionForPage(p) {
  if (p <= 4) return '앞부분';
  if (p <= 6) return '인사말';
  if (p <= 15) return '회사소개';
  if (p === 16) return '섹션간지';
  if (p <= 33) return '지속가능경영';
  if (p <= 35) return '섹션간지';
  if (p <= 53) return '환경·기후';
  if (p === 54) return '섹션간지';
  if (p <= 98) return '사회';
  if (p === 99) return '섹션간지';
  if (p <= 121) return '거버넌스';
  if (p === 122) return '섹션간지';
  if (p <= 148) return '부록·인덱스·검증';
  return '기타';
}

function normStd(s) {
  return s
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

const rows = [];
for (const line of text.split('\n')) {
  if (!line.trimStart().startsWith('|')) continue;
  const parts = line.split('|').map((s) => s.trim());
  if (parts.length < 4) continue;
  const page = parseInt(parts[1], 10);
  if (Number.isNaN(page)) continue;
  const title = parts[2] || '';
  const stdParts = parts.slice(3, -1);
  const standards = stdParts.map(normStd).filter(Boolean);
  rows.push({ page, title, standards, section: sectionForPage(page) });
}

const header = `/**
 * 삼성SDS SR보고서 2024 지표표( md_files/04_SR_Report/02_PAGE/삼성SDS_SR보고서_2024_지표.md )에서 생성됨.
 * 갱신: node scripts/gen-holding-sr-pages.mjs
 */

`;

const body = `export const HOLDING_SR_SDS_2024_PAGES: Array<{
  page: number;
  title: string;
  standards: string[];
  section: string;
}> = ${JSON.stringify(rows, null, 2)};\n`;

fs.writeFileSync(outPath, header + body, 'utf8');
console.log('Wrote', rows.length, 'rows to', outPath);
