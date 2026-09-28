package co.ehealth.platform.core.common;

import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.List;

// Shared by every CSV export this app produces (currently the platform and
// per-organization audit trails) — one place that gets RFC 4180 quoting and
// spreadsheet-formula-injection neutralization right, rather than each
// export endpoint reimplementing (and potentially getting wrong) the same
// two safety properties.
public final class CsvExport {

    private CsvExport() {
    }

    public static String toCsv(List<String> header, List<List<String>> rows) {
        StringBuilder sb = new StringBuilder();
        // A BOM so Excel opens UTF-8 CSVs without mangling non-ASCII text
        // (patient/staff names, device signatures) — a plain text editor or
        // CSV-aware library ignores it, so this costs nothing elsewhere.
        sb.append('﻿');
        writeRow(sb, header);
        for (List<String> row : rows) {
            writeRow(sb, row);
        }
        return sb.toString();
    }

    private static void writeRow(StringBuilder sb, List<String> cells) {
        for (int i = 0; i < cells.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(quote(neutralize(cells.get(i))));
        }
        sb.append("\r\n");
    }

    // OWASP CSV Injection mitigation: a cell whose first character is one a
    // spreadsheet application would interpret as a formula trigger gets a
    // leading apostrophe, forcing every major spreadsheet application to
    // treat the whole cell as literal text instead of evaluating it — an
    // exported audit row can contain attacker-influenced text (a staff
    // member's own typed name, a device user-agent string), and this is the
    // one export-time control standing between that and a formula silently
    // executing for whoever opens the file.
    private static String neutralize(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        char first = value.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
            return "'" + value;
        }
        return value;
    }

    // RFC 4180: a field containing a comma, quote or line break is wrapped
    // in quotes, with internal quotes doubled. Every field is quoted
    // unconditionally here rather than only when strictly required —
    // simpler to get right, and no downstream CSV reader treats an
    // unnecessarily-quoted plain field any differently.
    private static String quote(String value) {
        if (value == null) {
            return "\"\"";
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    public static String cell(Object value) {
        return value == null ? "" : value.toString();
    }

    public static String cell(Instant instant) {
        return instant == null ? "" : DateTimeFormatter.ISO_INSTANT.format(instant);
    }
}
