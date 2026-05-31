import xlsx from "xlsx";
import { normalizeCell, toNumber } from "./labels.js";

export type ExcelRow = Record<string, unknown>;

export function readWorkbook(buffer: Buffer) {
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return xlsx.utils.sheet_to_json<ExcelRow>(firstSheet, { defval: "" });
}

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/[()（）【】[\]：:]/g, "")
    .replace(/必填|自动/g, "");
}

export function pick(row: ExcelRow, candidates: string[]) {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    if (row[candidate] !== undefined && normalizeCell(row[candidate]) !== "") return row[candidate];
  }

  const normalizedCandidates = candidates.map(normalizeHeader);
  for (const [key, value] of entries) {
    const normalizedKey = normalizeHeader(key);
    const matched = normalizedCandidates.some((candidate) => normalizedKey.includes(candidate) || candidate.includes(normalizedKey));
    if (matched && normalizeCell(value) !== "") return value;
  }
  return "";
}

export function parseActivityImportRows(rows: ExcelRow[], fallbackPoints: number) {
  return rows
    .map((row, index) => {
      const pointsRaw = pick(row, ["积分变化", "积分", "加分", "加减分", "分值", "得分", "分数", "points"]);
      return {
        raw: row,
        rowNumber: typeof (row as { __rowNum__?: number }).__rowNum__ === "number" ? (row as { __rowNum__: number }).__rowNum__ + 1 : index + 2,
        name: normalizeCell(pick(row, ["姓名", "名字", "学生姓名", "姓名必填", "name"])),
        studentNo: normalizeCell(pick(row, ["学号", "学号/工号", "学生学号", "账号", "学号必填", "studentNo"])),
        activityName: normalizeCell(pick(row, ["活动名称", "活动", "项目", "activity"])),
        pointsChange: pointsRaw === "" ? fallbackPoints : toNumber(pointsRaw, fallbackPoints),
        remark: normalizeCell(pick(row, ["备注", "说明", "原因", "remark"]))
      };
    })
    .filter((row) => row.name || row.studentNo);
}

export function parseHistoryRows(rows: ExcelRow[]) {
  return rows
    .map((row) => ({
      raw: row,
      name: normalizeCell(pick(row, ["姓名", "名字", "学生姓名", "name"])),
      studentNo: normalizeCell(pick(row, ["学号", "学号/工号", "学生学号", "账号", "studentNo"])),
      historyPoints: toNumber(pick(row, ["历史积分", "总积分", "积分", "五月前积分", "5月前积分"]), 0),
      batch: normalizeCell(pick(row, ["所属批次", "批次", "年级"])),
      developmentStage: normalizeCell(pick(row, ["发展阶段", "阶段", "党员类型"])),
      branch: normalizeCell(pick(row, ["所属支部", "支部"])),
      dormitory: normalizeCell(pick(row, ["寝室号", "宿舍", "寝室"])),
      remark: normalizeCell(pick(row, ["备注", "说明"]))
    }))
    .filter((row) => row.name || row.studentNo);
}
