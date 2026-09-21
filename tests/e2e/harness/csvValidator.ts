import type { ParticipantSession, TrialRecord, CsvRowData } from './types.ts';
import { deriveFalseMemoryFlags } from './stimulusOracle.ts';

export const CSV_EXPECTED_HEADERS = [
  'participant_id',
  'created_at',
  'completed_at',
  'age',
  'gender',
  'studies_psychology',
  'therapeutic_orientation',
  'university',
  'is_included',
  'induction_group',
  'fake_news_set',
  'presentation_order',
  'news_id',
  'is_fake',
  'news_congruence',
  'response_option',
  'response_label',
  'is_false_memory',
  'is_false_belief',
  'reading_time_ms',
  'response_time_ms',
  'device_type',
  'screen_resolution',
];

/**
 * Transforms session + trials into 20 long-format CSV row objects.
 */
export function generateParticipantCsvRows(
  session: ParticipantSession,
  trials: TrialRecord[]
): CsvRowData[] {
  if (trials.length !== 20) {
    throw new Error(`Participant must have exactly 20 trials for CSV export, got ${trials.length}`);
  }

  return trials.map((trial) => {
    const { isFalseMemory, isFalseBelief } = deriveFalseMemoryFlags(
      trial.isFake,
      trial.responseOption
    );

    return {
      participant_id: session.id,
      created_at: session.createdAt,
      completed_at: session.completedAt || '',
      age: session.age,
      gender: session.gender,
      studies_psychology: session.studiesPsychology,
      therapeutic_orientation: session.therapeuticOrientation,
      university: session.university,
      is_included: session.isIncluded,
      induction_group: session.inductionGroup,
      fake_news_set: session.fakeNewsSet,
      presentation_order: trial.presentationOrder,
      news_id: trial.newsId,
      is_fake: trial.isFake,
      news_congruence: trial.newsCongruence,
      response_option: trial.responseOption,
      response_label: trial.responseLabel,
      is_false_memory: isFalseMemory,
      is_false_belief: isFalseBelief,
      reading_time_ms: trial.readingTimeMs,
      response_time_ms: trial.responseTimeMs,
      device_type: session.deviceType,
      screen_resolution: session.screenResolution,
    };
  });
}

function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes row objects into a CSV string with UTF-8 BOM.
 */
export function serializeToCsv(rows: CsvRowData[], includeBom: boolean = true): string {
  const headerLine = CSV_EXPECTED_HEADERS.join(',');
  const lines = rows.map((row) =>
    CSV_EXPECTED_HEADERS.map((h) => escapeCsvValue((row as any)[h])).join(',')
  );

  const body = [headerLine, ...lines].join('\r\n');
  return includeBom ? `\uFEFF${body}` : body;
}

/**
 * Parses a CSV string respecting RFC 4180 quotes, commas, linebreaks, and checks for UTF-8 BOM.
 */
export function parseCsv(csvString: string): {
  hasBom: boolean;
  headers: string[];
  rows: Record<string, string>[];
} {
  let content = csvString;
  const hasBom = content.startsWith('\uFEFF');
  if (hasBom) {
    content = content.slice(1);
  }

  // Split lines accounting for RFC 4180 quotes
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && content[i + 1] === '\n') {
        i++; // skip \n of \r\n
      }
      if (currentLine.trim().length > 0) {
        lines.push(currentLine);
      }
      currentLine = '';
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim().length > 0) {
    lines.push(currentLine);
  }

  if (lines.length === 0) {
    return { hasBom, headers: [], rows: [] };
  }

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let curField = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          curField += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === ',' && !inQ) {
        fields.push(curField);
        curField = '';
      } else {
        curField += c;
      }
    }
    fields.push(curField);
    return fields;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }

  return { hasBom, headers, rows };
}

/**
 * Validates that CSV conforms strictly to the specification.
 */
export function validateCsvStructure(
  csvString: string,
  expectedParticipantCount: number
): { valid: boolean; errors: string[]; rowCount: number } {
  const errors: string[] = [];
  const parsed = parseCsv(csvString);

  if (!parsed.hasBom) {
    errors.push('Missing UTF-8 Byte Order Mark (\\uFEFF) at beginning of CSV.');
  }

  // Check headers match expected exactly
  if (parsed.headers.length !== CSV_EXPECTED_HEADERS.length) {
    errors.push(
      `Header count mismatch: expected ${CSV_EXPECTED_HEADERS.length} columns, got ${parsed.headers.length}`
    );
  }

  for (let i = 0; i < CSV_EXPECTED_HEADERS.length; i++) {
    if (parsed.headers[i] !== CSV_EXPECTED_HEADERS[i]) {
      errors.push(
        `Header column ${i} mismatch: expected "${CSV_EXPECTED_HEADERS[i]}", got "${parsed.headers[i]}"`
      );
    }
  }

  const expectedRows = expectedParticipantCount * 20;
  if (parsed.rows.length !== expectedRows) {
    errors.push(
      `Row count mismatch: expected ${expectedRows} data rows (${expectedParticipantCount} participants * 20 trials), got ${parsed.rows.length}`
    );
  }

  // Validate each row's data integrity
  parsed.rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    if (!row.participant_id) errors.push(`Row ${rowNum}: missing participant_id`);
    if (!row.presentation_order) errors.push(`Row ${rowNum}: missing presentation_order`);
    if (!row.news_id) errors.push(`Row ${rowNum}: missing news_id`);

    const resp = parseInt(row.response_option, 10);
    if (![1, 2, 3, 4].includes(resp)) {
      errors.push(`Row ${rowNum}: invalid response_option "${row.response_option}"`);
    }

    const isFake = row.is_fake === 'true';
    const isFalseMem = row.is_false_memory === 'true';
    const isFalseBel = row.is_false_belief === 'true';

    // Murphy/León logic verification
    if (isFake && resp === 1 && !isFalseMem) {
      errors.push(`Row ${rowNum}: is_false_memory must be true when is_fake=true and response_option=1`);
    }
    if (isFake && resp === 2 && !isFalseBel) {
      errors.push(`Row ${rowNum}: is_false_belief must be true when is_fake=true and response_option=2`);
    }
    if (!isFake && (isFalseMem || isFalseBel)) {
      errors.push(`Row ${rowNum}: true news cannot yield false memory or false belief`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    rowCount: parsed.rows.length,
  };
}
