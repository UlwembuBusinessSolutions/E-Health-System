package co.ehealth.platform.patient;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;

@Service
public class PatientDocumentPdfService {

    public ConversionResult convert(byte[] sourceBytes, String contentType) {
        if ("application/pdf".equalsIgnoreCase(contentType)) {
            return new ConversionResult(sourceBytes, sourceBytes.length);
        }

        if (!isSupportedImageType(contentType)) {
            throw new IllegalArgumentException(
                    "Only PDF, JPEG, PNG, or WebP files are supported.");
        }

        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(sourceBytes));

            if (image == null) {
                throw new IllegalArgumentException(
                        "The uploaded image could not be decoded.");
            }

            try (PDDocument document = new PDDocument();
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {

                PDPage page = new PDPage(
                        new PDRectangle(image.getWidth(), image.getHeight()));

                document.addPage(page);

                PDImageXObject pdfImage = LosslessFactory.createFromImage(document, image);

                try (PDPageContentStream contentStream =
                             new PDPageContentStream(document, page)) {

                    contentStream.drawImage(
                            pdfImage,
                            0,
                            0,
                            image.getWidth(),
                            image.getHeight());
                }

                document.save(output);

                byte[] pdfBytes = output.toByteArray();

                return new ConversionResult(pdfBytes, pdfBytes.length);
            }
        } catch (IOException e) {
            throw new IllegalArgumentException(
                    "Failed to convert the uploaded image to PDF.", e);
        }
    }

    private boolean isSupportedImageType(String contentType) {
        return "image/jpeg".equalsIgnoreCase(contentType)
                || "image/png".equalsIgnoreCase(contentType)
                || "image/webp".equalsIgnoreCase(contentType);
    }

    public record ConversionResult(byte[] bytes, long size) {
    }
}