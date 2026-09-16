package co.ehealth.platform.visit;

/**
 * RECQ-US-003: Generates printable ticket output in various formats.
 *
 * Supports:
 * - HTML: For browser printing with formatted layout
 * - Plain text: For thermal printer or console output
 * - Thermal printer format: ESC/POS format for thermal receipt printers
 */
public class TicketFormatter {

    /**
     * Generate an HTML-formatted ticket suitable for browser printing.
     * Uses print-friendly styling for receipt-sized output.
     */
    public static String generateHtmlTicket(TicketData ticket) {
        return """
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Queue Ticket</title>
                    <style>
                        @media print {
                            body { margin: 0; padding: 0; }
                            .ticket { margin: 0; padding: 0; }
                        }
                        body {
                            font-family: Arial, sans-serif;
                            margin: 20px;
                            background-color: #f5f5f5;
                        }
                        .ticket {
                            width: 320px;
                            background-color: white;
                            padding: 20px;
                            border: 1px solid #ccc;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            margin: 0 auto;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px dashed #000;
                            padding-bottom: 15px;
                            margin-bottom: 15px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 14px;
                            font-weight: bold;
                            color: #333;
                        }
                        .header p {
                            margin: 5px 0 0 0;
                            font-size: 11px;
                            color: #666;
                        }
                        .token-number {
                            text-align: center;
                            font-size: 48px;
                            font-weight: bold;
                            color: #000;
                            margin: 20px 0;
                            font-family: 'Courier New', monospace;
                            letter-spacing: 2px;
                        }
                        .priority {
                            text-align: center;
                            font-size: 14px;
                            font-weight: bold;
                            color: %s;
                            margin-bottom: 15px;
                            text-transform: uppercase;
                        }
                        .info-row {
                            display: flex;
                            justify-content: space-between;
                            font-size: 12px;
                            margin: 8px 0;
                            padding: 5px 0;
                            border-bottom: 1px solid #eee;
                        }
                        .info-label {
                            font-weight: bold;
                            color: #333;
                        }
                        .info-value {
                            color: #555;
                            text-align: right;
                            word-break: break-word;
                            flex: 1;
                            margin-left: 10px;
                        }
                        .queue-info {
                            text-align: center;
                            font-size: 12px;
                            margin-top: 15px;
                            padding-top: 15px;
                            border-top: 2px dashed #000;
                        }
                        .queue-info p {
                            margin: 5px 0;
                        }
                        .estimated-wait {
                            font-size: 18px;
                            font-weight: bold;
                            color: #007bff;
                            margin: 10px 0;
                        }
                        .footer {
                            text-align: center;
                            font-size: 10px;
                            color: #999;
                            margin-top: 15px;
                            border-top: 1px solid #eee;
                            padding-top: 10px;
                        }
                    </style>
                </head>
                <body>
                    <div class="ticket">
                        <div class="header">
                            <h1>QUEUE TICKET</h1>
                            <p>%s</p>
                        </div>
                        
                        <div class="token-number">%s</div>
                        <div class="priority">%s</div>
                        
                        <div class="info-row">
                            <span class="info-label">Patient:</span>
                            <span class="info-value">%s</span>
                        </div>
                        
                        <div class="info-row">
                            <span class="info-label">MPI:</span>
                            <span class="info-value">%s</span>
                        </div>
                        
                        <div class="info-row">
                            <span class="info-label">Issued:</span>
                            <span class="info-value">%s</span>
                        </div>
                        
                        <div class="queue-info">
                            <p>%s</p>
                            <div class="estimated-wait">%s</div>
                            <p style="font-size: 11px; color: #999;">Estimated wait time</p>
                        </div>
                        
                        <div class="footer">
                            <p>Please retain this ticket</p>
                            <p>Report your number when called</p>
                        </div>
                    </div>
                </body>
                </html>
                """
                .formatted(
                        getPriorityColor(ticket.priority()),
                        ticket.getServiceStation(),
                        ticket.getFormattedTokenNumber(),
                        ticket.getPriorityLabel(),
                        ticket.patientName(),
                        ticket.patientMpi(),
                        ticket.issuedAtFormatted(),
                        ticket.getQueuePositionDisplay(),
                        ticket.getEstimatedWaitDisplay()
                );
    }

    /**
     * Generate a plain text ticket suitable for thermal printer output.
     */
    public static String generatePlainTextTicket(TicketData ticket) {
        int width = 32; // Typical thermal printer width in characters
        return String.format(
                "%-32s%n" +  // Service station (32 chars)
                        "%s%n" +  // Blank line
                        "%-32s%n" +  // "QUEUE TICKET" centered
                        "%s%n" +  // Blank line
                        "%-32s%n" +  // Token number (large, centered)
                        "%s%n" +  // Priority
                        "                                %n" +  // Blank line
                        "Patient: %-21s%n" +
                        "MPI: %-25s%n" +
                        "Issued: %-23s%n" +
                        "                                %n" +  // Blank line
                        "%s%n" +  // Queue position
                        "%s%n" +  // Estimated wait
                        "                                %n" +  // Blank line
                        "%-32s%n" +  // Footer
                        "%-32s%n",   // Footer
                ticket.getServiceStation(),
                "",
                center("QUEUE TICKET", width),
                "",
                center(ticket.getFormattedTokenNumber(), width),
                center(ticket.getPriorityLabel(), width),
                ticket.patientName(),
                ticket.patientMpi(),
                ticket.issuedAtFormatted(),
                center(ticket.getQueuePositionDisplay(), width),
                center("Wait: " + ticket.getEstimatedWaitDisplay(), width),
                center("Please retain this ticket", width),
                center("Report your number when called", width)
        );
    }

    /**
     * Generate ESC/POS format for thermal receipt printers.
     * This is a simplified version; actual printers may need adjustments.
     */
    public static byte[] generateThermalPrinterBytes(TicketData ticket) {
        // ESC/POS commands
        byte[] ESC = {0x1B};
        byte[] initialize = new byte[]{0x1B, 0x40};  // ESC @
        byte[] doubleHeightOn = new byte[]{0x1B, 0x21, 0x30};  // ESC ! 0
        byte[] doubleHeightOff = new byte[]{0x1B, 0x21, 0x00};  // ESC ! (normal)
        byte[] centerAlign = new byte[]{0x1B, 0x61, 0x01};  // ESC a 1 (center)
        byte[] leftAlign = new byte[]{0x1B, 0x61, 0x00};  // ESC a 0 (left)
        byte[] boldOn = new byte[]{0x1B, 0x45, 0x01};  // ESC E 1
        byte[] boldOff = new byte[]{0x1B, 0x45, 0x00};  // ESC E 0
        byte[] cut = new byte[]{0x1D, 0x56, 0x41, 0x03};  // GS V A (partial cut)
        byte[] newline = {0x0A};

        StringBuilder esc = new StringBuilder();
        // Initialize printer
        esc.append(new String(initialize));
        esc.append(new String(centerAlign));
        
        // Header
        esc.append(new String(boldOn));
        esc.append("QUEUE TICKET\n");
        esc.append(new String(boldOff));
        esc.append(ticket.getServiceStation()).append("\n\n");
        
        // Token number (large and bold)
        esc.append(new String(doubleHeightOn));
        esc.append(new String(boldOn));
        esc.append(ticket.getFormattedTokenNumber()).append("\n");
        esc.append(new String(boldOff));
        esc.append(new String(doubleHeightOff));
        
        // Priority
        esc.append(new String(boldOn));
        esc.append(ticket.getPriorityLabel()).append("\n");
        esc.append(new String(boldOff));
        
        esc.append("\n");
        esc.append(new String(leftAlign));
        
        // Patient info
        esc.append("Patient: ").append(ticket.patientName()).append("\n");
        esc.append("MPI: ").append(ticket.patientMpi()).append("\n");
        esc.append("Issued: ").append(ticket.issuedAtFormatted()).append("\n\n");
        
        // Queue info
        esc.append(new String(centerAlign));
        esc.append(ticket.getQueuePositionDisplay()).append("\n");
        esc.append("Wait: ").append(ticket.getEstimatedWaitDisplay()).append("\n\n");
        
        esc.append(new String(leftAlign));
        esc.append("Please retain this ticket\n");
        esc.append("Report your number when called\n\n");
        
        // Cut paper
        esc.append(new String(cut));
        
        return esc.toString().getBytes();
    }

    private static String getPriorityColor(TokenPriority priority) {
        return priority == TokenPriority.PRIORITY ? "#dc3545" : "#28a745";
    }

    private static String center(String text, int width) {
        if (text.length() >= width) {
            return text.substring(0, width);
        }
        int totalPadding = width - text.length();
        int leftPadding = totalPadding / 2;
        int rightPadding = totalPadding - leftPadding;
        return " ".repeat(leftPadding) + text + " ".repeat(rightPadding);
    }
}
