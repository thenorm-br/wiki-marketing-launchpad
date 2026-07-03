import ExcelJS from "exceljs";

export type ImportedContactRow = {
  name: string;
  phone: string;
  email: string;
};

function stripBom(text: string) {
  return text.replace(/^\uFEFF/, "");
}

function normalizeHeader(value: string) {
  return stripBom(String(value ?? ""))
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

const NAME_HEADERS = ["nome", "name", "contato", "cliente", "pessoa"];
const PHONE_HEADERS = [
  "telefone",
  "fone",
  "celular",
  "whatsapp",
  "phone",
  "mobile",
  "numero",
];
const EMAIL_HEADERS = ["email", "e-mail", "mail"];

function isHeaderMatch(normalized: string, candidates: string[]) {
  return candidates.some((c) => normalized.includes(normalizeHeader(c)));
}

function toText(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

function sanitizePhone(phone: string) {
  // Mantém + e dígitos; remove o resto.
  const cleaned = phone.replace(/(?!^)\+/g, "").replace(/[^+0-9]/g, "");
  return cleaned;
}

function sanitizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((c) => String(c).trim() !== "")) {
        rows.push(row.map((c) => String(c ?? "").trim()));
      }
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  if (row.some((c) => String(c).trim() !== "")) {
    rows.push(row.map((c) => String(c ?? "").trim()));
  }

  return rows;
}

function detectDelimiter(text: string) {
  const firstLine = stripBom(text).split(/\r?\n/)[0] ?? "";
  const comma = (firstLine.match(/,/g) ?? []).length;
  const semicolon = (firstLine.match(/;/g) ?? []).length;
  const tab = (firstLine.match(/\t/g) ?? []).length;

  if (semicolon >= comma && semicolon >= tab) return ";";
  if (tab >= comma && tab >= semicolon) return "\t";
  return ",";
}

function mapRowsToContacts(rows: string[][]): ImportedContactRow[] {
  if (!rows.length) return [];

  const header = rows[0].map((h) => toText(h));
  const headerNorm = header.map(normalizeHeader);

  const looksLikeHeader = headerNorm.some(
    (h) =>
      isHeaderMatch(h, NAME_HEADERS) ||
      isHeaderMatch(h, PHONE_HEADERS) ||
      isHeaderMatch(h, EMAIL_HEADERS)
  );

  const nameIdx = looksLikeHeader
    ? headerNorm.findIndex((h) => isHeaderMatch(h, NAME_HEADERS))
    : 0;
  const phoneIdx = looksLikeHeader
    ? headerNorm.findIndex((h) => isHeaderMatch(h, PHONE_HEADERS))
    : 1;
  const emailIdx = looksLikeHeader
    ? headerNorm.findIndex((h) => isHeaderMatch(h, EMAIL_HEADERS))
    : 2;

  const safeNameIdx = nameIdx >= 0 ? nameIdx : 0;
  const safePhoneIdx = phoneIdx >= 0 ? phoneIdx : 1;
  const safeEmailIdx = emailIdx >= 0 ? emailIdx : 2;

  const start = looksLikeHeader ? 1 : 0;
  const data = rows.slice(start);

  return data
    .map((r) => {
      const name = toText(r[safeNameIdx]);
      const phone = sanitizePhone(toText(r[safePhoneIdx]));
      const email = sanitizeEmail(toText(r[safeEmailIdx]));
      return { name, phone, email };
    })
    .filter((c) => c.name || c.phone || c.email);
}

function parseCsvText(text: string): ImportedContactRow[] {
  const clean = stripBom(text);
  const delimiter = detectDelimiter(clean);
  const rows = parseDelimited(clean, delimiter);
  return mapRowsToContacts(rows);
}

async function parseExcel(buffer: ArrayBuffer): Promise<ImportedContactRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    // ExcelJS row.values is 1-indexed; drop the leading undefined.
    const cells = (Array.isArray(values) ? values.slice(1) : []).map((v) => {
      if (v == null) return "";
      if (typeof v === "object" && v !== null && "text" in (v as Record<string, unknown>)) {
        return String((v as { text: unknown }).text ?? "");
      }
      if (typeof v === "object" && v !== null && "result" in (v as Record<string, unknown>)) {
        return String((v as { result: unknown }).result ?? "");
      }
      return String(v);
    });
    rows.push(cells);
  });

  return mapRowsToContacts(rows);
}

export async function parseContactsFile(file: File): Promise<ImportedContactRow[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv" || file.type === "text/csv") {
    return parseCsvText(await file.text());
  }

  if (ext === "xlsx" || ext === "xls") {
    return await parseExcel(await file.arrayBuffer());
  }

  // Alguns CSVs vêm com MIME genérico.
  if (!ext && file.type.startsWith("text/")) {
    return parseCsvText(await file.text());
  }

  throw new Error(
    "Formato não suportado. Envie um CSV (.csv) ou Excel (.xlsx/.xls)."
  );
}
