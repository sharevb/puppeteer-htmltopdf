export const defaultPdfOptions = {
  format: "A4",
  printBackground: true,
  landscape: false,
  onePage: false,
  language: "en-US",
  autoHideCookies: true,
  margin: {
    top: "20mm",
    bottom: "20mm",
    left: "15mm",
    right: "15mm"
  }
};

export const pdfProfiles = {
  minimal: {
    format: "A4",
    printBackground: false,
    margin: { top: "0", bottom: "0", left: "0", right: "0" }
  },

  fullbleed: {
    format: "A4",
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" }
  },

  invoice: {
    format: "A4",
    printBackground: true,
    margin: { top: "25mm", bottom: "25mm", left: "20mm", right: "20mm" }
  },

  booklet: {
    format: "A5",
    landscape: true,
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }
  },

  letter: {
    format: "Letter",
    printBackground: true
  },

  legal: {
    format: "Legal",
    printBackground: true
  }
};

export function resolvePdfOptions(input = {}) {
  if (input.profile && pdfProfiles[input.profile]) {
    return { ...defaultPdfOptions, ...pdfProfiles[input.profile], ...input };
  }
  return { ...defaultPdfOptions, ...input };
}
