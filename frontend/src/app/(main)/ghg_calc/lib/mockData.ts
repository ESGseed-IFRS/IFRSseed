import type {
  EnergyData,
  WasteData,
  PollutionData,
  ChemicalData,
  EnergyProviderData,
  ConsignmentData,
} from '../types/ghg';
import { FACILITIES, YEARS, MONTHS } from './constants';

export { FACILITIES, YEARS, MONTHS };

export const energyData: EnergyData[] = [
  { id: 1, facility: "본관동", energyType: "전력", unit: "kWh", jan: "145,230", feb: "138,450", mar: "152,100", apr: "", may: "", jun: "", jul: "", aug: "", sep: "", oct: "", nov: "", dec: "", total: "435,780", source: "if", status: "confirmed" },
  { id: 2, facility: "생산동A", energyType: "전력", unit: "kWh", jan: "892,100", feb: "875,320", mar: "901,450", apr: "", may: "", jun: "", jul: "", aug: "", sep: "", oct: "", nov: "", dec: "", total: "2,668,870", source: "if", status: "confirmed" },
  { id: 3, facility: "생산동B", energyType: "전력", unit: "kWh", jan: "654,780", feb: "641,200", mar: "668,900", apr: "", may: "", jun: "", jul: "", aug: "", sep: "", oct: "", nov: "", dec: "", total: "1,964,880", source: "manual", status: "draft" },
  { id: 4, facility: "본관동", energyType: "LNG", unit: "Nm³", jan: "12,450", feb: "13,200", mar: "11,800", apr: "", may: "", jun: "", jul: "", aug: "", sep: "", oct: "", nov: "", dec: "", total: "37,450", source: "if", status: "confirmed" },
  { id: 5, facility: "생산동A", energyType: "열·스팀", unit: "Gcal", jan: "234.5", feb: "241.2", mar: "228.8", apr: "", may: "", jun: "", jul: "", aug: "", sep: "", oct: "", nov: "", dec: "", total: "704.5", source: "manual", status: "confirmed" },
  { id: 6, facility: "유틸리티동", energyType: "용수", unit: "m³", jan: "8,920", feb: "9,100", mar: "8,750", apr: "", may: "", jun: "", jul: "", aug: "", sep: "", oct: "", nov: "", dec: "", total: "26,770", source: "if", status: "draft" },
  { id: 7, facility: "연구동", energyType: "순수", unit: "m³", jan: "1,230", feb: "1,180", mar: "1,310", apr: "", may: "", jun: "", jul: "", aug: "", sep: "", oct: "", nov: "", dec: "", total: "3,720", source: "manual", status: "confirmed" },
];

export const wasteData: WasteData[] = [
  { id: 1, facility: "생산동A", wasteType: "일반폐기물", disposalMethod: "매립", unit: "톤", jan: "12.5", feb: "11.8", mar: "13.2", apr: "12.4", may: "12.0", jun: "12.6", jul: "12.1", aug: "11.9", sep: "12.3", oct: "12.0", nov: "12.2", dec: "12.4", total: "148.4", vendor: "㈜그린환경", status: "confirmed" },
  { id: 2, facility: "생산동A", wasteType: "지정폐기물", disposalMethod: "소각", unit: "kg", jan: "450", feb: "520", mar: "480", apr: "495", may: "470", jun: "510", jul: "485", aug: "502", sep: "478", oct: "488", nov: "505", dec: "492", total: "5,875", vendor: "㈜에코처리", status: "confirmed" },
  { id: 3, facility: "생산동B", wasteType: "일반폐기물", disposalMethod: "재활용", unit: "톤", jan: "8.2", feb: "7.9", mar: "8.8", apr: "8.1", may: "8.4", jun: "8.0", jul: "8.5", aug: "8.3", sep: "8.2", oct: "8.6", nov: "8.1", dec: "8.4", total: "98.5", vendor: "㈜리사이클코", status: "draft" },
  { id: 4, facility: "본관동", wasteType: "폐수슬러지", disposalMethod: "매립", unit: "톤", jan: "2.3", feb: "2.1", mar: "2.5", apr: "2.2", may: "2.4", jun: "2.0", jul: "2.3", aug: "2.2", sep: "2.5", oct: "2.1", nov: "2.4", dec: "2.2", total: "27.2", vendor: "㈜그린환경", status: "confirmed" },
  { id: 5, facility: "연구동", wasteType: "폐화학물질", disposalMethod: "소각", unit: "kg", jan: "85", feb: "92", mar: "78", apr: "88", may: "90", jun: "82", jul: "86", aug: "91", sep: "84", oct: "87", nov: "83", dec: "89", total: "1,035", vendor: "㈜케미처리", status: "error" },
];

export const pollutionData: PollutionData[] = [
  { id: 1, facility: "생산동A", outletName: "방류구#1", pollutant: "BOD (수질)", unit: "mg/L", jan: "12.4", feb: "11.8", mar: "13.1", apr: "12.0", may: "12.5", jun: "11.7", jul: "12.2", aug: "12.4", sep: "11.9", oct: "12.6", nov: "12.1", dec: "11.8", avg: "12.2", legalLimit: "30", status: "normal" },
  { id: 2, facility: "생산동A", outletName: "방류구#1", pollutant: "SS (수질)", unit: "mg/L", jan: "18.5", feb: "17.2", mar: "19.8", apr: "18.0", may: "18.8", jun: "17.5", jul: "18.4", aug: "19.0", sep: "18.2", oct: "18.6", nov: "17.9", dec: "18.3", avg: "18.4", legalLimit: "30", status: "normal" },
  { id: 3, facility: "생산동A", outletName: "방류구#2", pollutant: "COD (수질)", unit: "mg/L", jan: "42.1", feb: "38.5", mar: "45.8", apr: "40.2", may: "41.5", jun: "39.8", jul: "42.4", aug: "43.0", sep: "41.1", oct: "44.2", nov: "40.5", dec: "42.8", avg: "41.8", legalLimit: "40", status: "warning" },
  { id: 4, facility: "생산동B", outletName: "굴뚝#1", pollutant: "먼지 (대기)", unit: "mg/Sm³", jan: "8.2", feb: "7.9", mar: "8.8", apr: "8.0", may: "8.4", jun: "8.1", jul: "8.5", aug: "8.2", sep: "8.3", oct: "8.6", nov: "8.0", dec: "8.4", avg: "8.3", legalLimit: "20", status: "normal" },
  { id: 5, facility: "생산동B", outletName: "굴뚝#1", pollutant: "SOx (대기)", unit: "ppm", jan: "15.4", feb: "16.2", mar: "14.8", apr: "15.0", may: "15.8", jun: "15.2", jul: "15.6", aug: "15.1", sep: "15.9", oct: "15.3", nov: "15.5", dec: "15.7", avg: "15.4", legalLimit: "20", status: "normal" },
  { id: 6, facility: "유틸리티동", outletName: "굴뚝#2", pollutant: "NOx (대기)", unit: "ppm", jan: "89.2", feb: "92.5", mar: "95.1", apr: "91.0", may: "93.2", jun: "94.5", jul: "92.8", aug: "95.4", sep: "93.1", oct: "94.0", nov: "92.2", dec: "93.6", avg: "93.1", legalLimit: "80", status: "exceed" },
];

export const chemicalData: ChemicalData[] = [
  { id: 1, facility: "생산동A", chemicalName: "황산 (H₂SO₄)", casNo: "7664-93-9", unit: "kg", jan: "450", feb: "480", mar: "420", apr: "440", may: "465", jun: "455", jul: "470", aug: "445", sep: "460", oct: "450", nov: "475", dec: "462", total: "5,472", hazardClass: "부식성", status: "confirmed" },
  { id: 2, facility: "생산동A", chemicalName: "수산화나트륨 (NaOH)", casNo: "1310-73-2", unit: "kg", jan: "320", feb: "350", mar: "310", apr: "330", may: "325", jun: "318", jul: "340", aug: "332", sep: "328", oct: "335", nov: "322", dec: "338", total: "3,948", hazardClass: "부식성", status: "confirmed" },
  { id: 3, facility: "생산동B", chemicalName: "염산 (HCl)", casNo: "7647-01-0", unit: "kg", jan: "185", feb: "192", mar: "178", apr: "190", may: "188", jun: "182", jul: "195", aug: "180", sep: "187", oct: "191", nov: "184", dec: "189", total: "2,241", hazardClass: "부식성", status: "draft" },
  { id: 4, facility: "연구동", chemicalName: "아세톤", casNo: "67-64-1", unit: "L", jan: "45", feb: "52", mar: "48", apr: "46", may: "50", jun: "47", jul: "51", aug: "49", sep: "48", oct: "53", nov: "46", dec: "50", total: "585", hazardClass: "인화성", status: "confirmed" },
  { id: 5, facility: "유틸리티동", chemicalName: "차아염소산나트륨", casNo: "7681-52-9", unit: "kg", jan: "280", feb: "295", mar: "265", apr: "288", may: "290", jun: "282", jul: "300", aug: "285", sep: "292", oct: "278", nov: "296", dec: "289", total: "3,440", hazardClass: "산화성", status: "confirmed" },
];

export const energyProviderData: EnergyProviderData[] = [
  { id: 1, providerName: "한국전력공사", energyType: "전력", contractNo: "KE-2024-001", supplyStart: "2024-01-01", supplyEnd: "2026-12-31", renewableRatio: "0%", certNo: "-", status: "active" },
  { id: 2, providerName: "㈜그린에너지", energyType: "전력(재생)", contractNo: "GE-2025-047", supplyStart: "2025-03-01", supplyEnd: "2027-02-28", renewableRatio: "100%", certNo: "REC-2025-4782", status: "active" },
  { id: 3, providerName: "한국가스공사", energyType: "LNG", contractNo: "KG-2024-112", supplyStart: "2024-01-01", supplyEnd: "2025-12-31", renewableRatio: "-", certNo: "-", status: "expired" },
  { id: 4, providerName: "㈜열에너지솔루션", energyType: "열·스팀", contractNo: "HS-2025-003", supplyStart: "2025-07-01", supplyEnd: "2026-06-30", renewableRatio: "-", certNo: "-", status: "active" },
];

export const consignmentData: ConsignmentData[] = [
  { id: 1, vendorName: "㈜그린환경", bizNo: "123-45-67890", wasteType: "일반폐기물·폐수슬러지", permitNo: "경기-일반-2023-001", permitExpiry: "2027-04-30", contractStart: "2024-01-01", contractEnd: "2026-12-31", status: "active" },
  { id: 2, vendorName: "㈜에코처리", bizNo: "234-56-78901", wasteType: "지정폐기물", permitNo: "경기-지정-2022-018", permitExpiry: "2026-06-30", contractStart: "2024-01-01", contractEnd: "2026-12-31", status: "active" },
  { id: 3, vendorName: "㈜리사이클코", bizNo: "345-67-89012", wasteType: "재활용 일반폐기물", permitNo: "인천-재활-2021-005", permitExpiry: "2025-12-31", contractStart: "2023-01-01", contractEnd: "2025-12-31", status: "expired" },
  { id: 4, vendorName: "㈜케미처리", bizNo: "456-78-90123", wasteType: "폐화학물질", permitNo: "경기-지정-2024-042", permitExpiry: "2028-03-31", contractStart: "2025-01-01", contractEnd: "2026-12-31", status: "active" },
];
