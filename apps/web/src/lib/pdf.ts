import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generateInvoicePDF = (invoice: any) => {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.text("INVOICE", 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, 14, 30);

  const pageWidth = doc.internal.pageSize.getWidth();
  let headerY = 30;
  if (invoice.issueDate) {
    doc.text(`Date: ${invoice.issueDate}`, pageWidth - 14, headerY, { align: "right" });
    headerY += 5;
  }
  if (invoice.dueDate) {
    doc.text(`Due Date: ${invoice.dueDate}`, pageWidth - 14, headerY, { align: "right" });
    headerY += 5;
  }

  // Bill To
  doc.setFontSize(12);
  doc.text("Bill To:", 14, 55);
  doc.setFontSize(10);
  doc.text(invoice.customerName || "Unknown Customer", 14, 62);
  if (invoice.customerEmail) doc.text(invoice.customerEmail, 14, 67);
  if (invoice.customerPhone) doc.text(invoice.customerPhone, 14, 72);
  if (invoice.customerAddress) {
    const splitAddress = doc.splitTextToSize(invoice.customerAddress, 80);
    doc.text(splitAddress, 14, 77);
  }

  doc.setFontSize(12);
  doc.text("Ship To:", 120, 55);
  doc.setFontSize(10);
  if (invoice.shippingAddress) {
    const splitShipping = doc.splitTextToSize(invoice.shippingAddress, 70);
    doc.text(splitShipping, 120, 62);
  } else if (invoice.customerAddress) {
    const splitShipping = doc.splitTextToSize(invoice.customerAddress, 70);
    doc.text(splitShipping, 120, 62);
  } else {
    doc.text("Same as billing address", 120, 62);
  }
  
  // Table
  const tableColumn = ["Description", "Quantity", "Unit Price", "Amount"];
  const tableRows: any[][] = [];

  const currencySymbol = invoice.currency === "USD" ? "$" : 
                         invoice.currency === "EUR" ? "€" : 
                         invoice.currency === "GBP" ? "£" : invoice.currency;

  const formatMoney = (cents: number) => {
    return `${currencySymbol} ${(cents / 100).toFixed(2)}`;
  };

  invoice.lineItems?.forEach((item: any) => {
    const itemData = [
      item.description,
      item.quantity,
      formatMoney(item.unitPriceCents),
      formatMoney(item.amountCents || (item.quantity * item.unitPriceCents))
    ];
    tableRows.push(itemData);
  });

  autoTable(doc, {
    startY: 90,
    head: [tableColumn],
    body: tableRows,
    theme: "striped",
    headStyles: { fillColor: [66, 66, 66] },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY || 90;
  
  doc.text(`Subtotal: ${formatMoney(invoice.subtotalCents)}`, 140, finalY + 10);
  if (invoice.taxCents > 0) {
    doc.text(`Tax: ${formatMoney(invoice.taxCents)}`, 140, finalY + 15);
  }
  if (invoice.discountCents > 0) {
    doc.text(`Discount: -${formatMoney(invoice.discountCents)}`, 140, finalY + 20);
  }
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Total: ${formatMoney(invoice.totalCents)}`, 140, finalY + 30);

  // Notes
  if (invoice.note) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Notes:", 14, finalY + 40);
    const splitNote = doc.splitTextToSize(invoice.note, 180);
    doc.text(splitNote, 14, finalY + 45);
  }

  doc.save(`${invoice.invoiceNumber}.pdf`);
};
