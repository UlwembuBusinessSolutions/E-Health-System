package co.ehealth.platform.platform;

import org.springframework.stereotype.Component;
import org.w3c.dom.*;

import javax.xml.XMLConstants;
import javax.xml.crypto.dsig.XMLSignature;
import javax.xml.crypto.dsig.XMLSignatureFactory;
import javax.xml.crypto.dsig.dom.DOMValidateContext;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;

@Component
public class SamlResponseVerifier {
    public Identity verify(String encodedResponse, String configuredCertificate) {
        try {
            byte[] xml = Base64.getDecoder().decode(encodedResponse);
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            Document document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(xml));
            Element signedElement = findFirst(document, "Signature");
            if (signedElement == null) {
                throw new IllegalArgumentException("SAML response is not signed.");
            }
            X509Certificate certificate = readCertificate(configuredCertificate);
            DOMValidateContext context = new DOMValidateContext(certificate.getPublicKey(), signedElement);
            XMLSignature signature = XMLSignatureFactory.getInstance("DOM")
                    .unmarshalXMLSignature(context);
            if (!signature.validate(context)) {
                throw new IllegalArgumentException("SAML signature is invalid.");
            }

            Element assertion = findFirst(document, "Assertion");
            if (assertion == null) {
                throw new IllegalArgumentException("SAML assertion is missing.");
            }
            String issuer = text(findFirst(assertion, "Issuer"));
            String subject = text(findFirst(assertion, "NameID"));
            String email = attribute(assertion, "email");
            String firstName = attribute(assertion, "givenName");
            String lastName = attribute(assertion, "surname");
            if (issuer == null || subject == null || email == null) {
                throw new IllegalArgumentException("SAML assertion is missing issuer, subject, or email.");
            }
            return new Identity(issuer, subject, email, firstName, lastName);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("SAML response could not be verified.", e);
        }
    }

    private X509Certificate readCertificate(String value) throws Exception {
        String pem = value.replace("-----BEGIN CERTIFICATE-----", "")
                .replace("-----END CERTIFICATE-----", "")
                .replaceAll("\\s", "");
        return (X509Certificate) CertificateFactory.getInstance("X.509")
                .generateCertificate(new ByteArrayInputStream(Base64.getDecoder().decode(pem)));
    }

    private Element findFirst(Node root, String localName) {
        NodeList nodes = root instanceof Document document
                ? document.getElementsByTagNameNS("*", localName)
                : ((Element) root).getElementsByTagNameNS("*", localName);
        return nodes.getLength() == 0 ? null : (Element) nodes.item(0);
    }

    private String text(Element element) {
        return element == null || element.getTextContent().isBlank() ? null : element.getTextContent().trim();
    }

    private String attribute(Element assertion, String name) {
        NodeList attributes = assertion.getElementsByTagNameNS("*", "Attribute");
        for (int i = 0; i < attributes.getLength(); i++) {
            Element attribute = (Element) attributes.item(i);
            if (!name.equalsIgnoreCase(attribute.getAttribute("Name"))
                    && !name.equalsIgnoreCase(attribute.getAttribute("FriendlyName"))) {
                continue;
            }
            Element value = findFirst(attribute, "AttributeValue");
            return text(value);
        }
        return null;
    }

    public record Identity(String issuer, String subject, String email, String firstName, String lastName) {}
}
