import PDFDocument from 'pdfkit';
import type { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { config } from '../../config';
import { AppError } from '../../utils/response';
import type { BillingSkuDef } from './plans';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

type BillingDb = Prisma.TransactionClient | typeof prisma;

export function validateGstin(gstin: string | null | undefined): string | null {
  if (!gstin?.trim()) return null;
  const normalized = gstin.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(normalized)) {
    throw new AppError(400, 'GSTIN must be a valid 15-character GST number', 'INVALID_GSTIN');
  }
  return normalized;
}

export function financialYearFor(date: Date): string {
  const ist = new Date(date.getTime() + 330 * 60 * 1000);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function taxBreakdown(params: {
  totalPaise: number;
  taxablePaise: number;
  supplierStateCode?: string;
  recipientStateCode?: string | null;
}) {
  const taxPaise = params.totalPaise - params.taxablePaise;
  if (taxPaise < 0 || params.taxablePaise < 0) {
    throw new AppError(400, 'Invoice tax values cannot be negative', 'INVALID_INVOICE_TOTAL');
  }
  const intraState =
    Boolean(params.supplierStateCode) &&
    Boolean(params.recipientStateCode) &&
    params.supplierStateCode === params.recipientStateCode;
  return {
    cgstPaise: intraState ? Math.floor(taxPaise / 2) : 0,
    sgstPaise: intraState ? taxPaise - Math.floor(taxPaise / 2) : 0,
    igstPaise: intraState ? 0 : taxPaise,
  };
}

async function nextInvoiceNumber(tx: BillingDb, financialYear: string): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO "billing_invoice_sequences" ("financial_year", "next_number", "updated_at")
    VALUES (${financialYear}, 2, CURRENT_TIMESTAMP)
    ON CONFLICT ("financial_year") DO NOTHING
  `;
  const rows = await tx.$queryRaw<Array<{ next_number: number }>>`
    SELECT "next_number" FROM "billing_invoice_sequences"
    WHERE "financial_year" = ${financialYear}
    FOR UPDATE
  `;
  const next = rows[0]?.next_number;
  if (!next) throw new AppError(500, 'Invoice sequence is unavailable', 'INVOICE_SEQUENCE_ERROR');
  await tx.$executeRaw`
    UPDATE "billing_invoice_sequences"
    SET "next_number" = ${next + 1}, "updated_at" = CURRENT_TIMESTAMP
    WHERE "financial_year" = ${financialYear}
  `;
  return `INV-${financialYear}-${String(next).padStart(5, '0')}`;
}

export async function issueCreditNote(params: {
  organizationId: string;
  invoiceId: string;
  amountPaise: number;
  reason: string;
}) {
  if (!Number.isSafeInteger(params.amountPaise) || params.amountPaise <= 0) {
    throw new AppError(400, 'Credit note amount must be positive', 'INVALID_CREDIT_NOTE');
  }
  if (!params.reason.trim()) {
    throw new AppError(400, 'Credit note reason is required', 'INVALID_CREDIT_NOTE');
  }
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: params.invoiceId, organizationId: params.organizationId, status: 'ISSUED' },
    });
    if (!invoice) throw new AppError(404, 'Issued invoice not found');
    const existing = await tx.creditNote.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { amountPaise: true },
    });
    const alreadyCredited = existing._sum.amountPaise || 0;
    if (alreadyCredited + params.amountPaise > invoice.totalPaise) {
      throw new AppError(409, 'Credit notes cannot exceed the invoice total', 'CREDIT_NOTE_EXCEEDS_INVOICE');
    }
    const number = await nextInvoiceNumber(tx, invoice.financialYear);
    return tx.creditNote.create({
      data: {
        organizationId: params.organizationId,
        invoiceId: invoice.id,
        creditNoteNumber: number.replace(/^INV-/, 'CN-'),
        reason: params.reason.trim().slice(0, 500),
        amountPaise: params.amountPaise,
      },
    });
  });
}

export async function issueInvoiceForCharge(
  tx: BillingDb,
  params: {
    organizationId: string;
    chargeId?: string;
    paymentOrderId?: string;
    providerPaymentId?: string;
    sku: BillingSkuDef;
    totalPaise: number;
    issuedAt?: Date;
  }
) {
  if (!Number.isSafeInteger(params.totalPaise) || params.totalPaise <= 0) {
    throw new AppError(400, 'Invoice total must be a positive integer', 'INVALID_INVOICE_TOTAL');
  }
  const existing = params.chargeId
    ? await tx.invoice.findUnique({ where: { billingChargeId: params.chargeId } })
    : params.paymentOrderId
      ? await tx.invoice.findUnique({ where: { paymentOrderId: params.paymentOrderId } })
      : null;
  if (existing) return existing;

  const [org, profile] = await Promise.all([
    tx.organization.findUnique({
      where: { id: params.organizationId },
      select: { companyName: true },
    }),
    tx.billingProfile.findUnique({ where: { organizationId: params.organizationId } }),
  ]);
  if (!org) throw new AppError(404, 'Organization not found');
  const issuedAt = params.issuedAt ?? new Date();
  const recipientGstin = validateGstin(profile?.gstin);
  const taxablePaise = params.sku.pricePaise;
  const tax = taxBreakdown({
    totalPaise: params.totalPaise,
    taxablePaise,
    supplierStateCode: config.billing.supplierStateCode,
    recipientStateCode: profile?.stateCode,
  });
  const invoiceNumber = await nextInvoiceNumber(tx, financialYearFor(issuedAt));
  const invoiceReady = Boolean(
    profile?.address &&
      profile.stateCode &&
      config.billing.supplierAddress &&
      config.billing.supplierGstin
  );

  return tx.invoice.create({
    data: {
      organizationId: params.organizationId,
      invoiceNumber,
      financialYear: financialYearFor(issuedAt),
      status: invoiceReady ? 'ISSUED' : 'PENDING_DETAILS',
      billingChargeId: params.chargeId,
      paymentOrderId: params.paymentOrderId,
      recipientName: profile?.legalName || org.companyName,
      recipientEmail: profile?.billingEmail,
      recipientGstin,
      recipientAddress: profile?.address,
      placeOfSupplyStateCode: profile?.stateCode,
      supplierName: config.billing.supplierName,
      supplierGstin: config.billing.supplierGstin || null,
      supplierAddress: config.billing.supplierAddress || null,
      supplierStateCode: config.billing.supplierStateCode || null,
      sacCode: config.billing.sacCode,
      description: params.sku.invoiceLabel,
      taxablePaise,
      ...tax,
      totalPaise: params.totalPaise,
      providerPaymentId: params.providerPaymentId,
      issuedAt,
    },
  });
}

export async function finalizePendingInvoices(organizationId: string): Promise<number> {
  const profile = await prisma.billingProfile.findUnique({ where: { organizationId } });
  if (
    !profile?.address ||
    !profile.stateCode ||
    !config.billing.supplierAddress ||
    !config.billing.supplierGstin
  ) {
    return 0;
  }
  const pending = await prisma.invoice.findMany({
    where: { organizationId, status: 'PENDING_DETAILS' },
  });
  for (const invoice of pending) {
    const tax = taxBreakdown({
      totalPaise: invoice.totalPaise,
      taxablePaise: invoice.taxablePaise,
      supplierStateCode: config.billing.supplierStateCode,
      recipientStateCode: profile.stateCode,
    });
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'ISSUED',
        recipientName: profile.legalName || invoice.recipientName,
        recipientEmail: profile.billingEmail,
        recipientGstin: validateGstin(profile.gstin),
        recipientAddress: profile.address,
        placeOfSupplyStateCode: profile.stateCode,
        supplierName: config.billing.supplierName,
        supplierGstin: config.billing.supplierGstin,
        supplierAddress: config.billing.supplierAddress,
        supplierStateCode: config.billing.supplierStateCode,
        ...tax,
      },
    });
  }
  return pending.length;
}

function inr(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function renderInvoicePdf(invoiceId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { organization: { select: { companyName: true } } },
  });
  if (!invoice) throw new AppError(404, 'Invoice not found');
  if (invoice.status !== 'ISSUED') {
    throw new AppError(
      409,
      'Complete billing address, state, and supplier tax configuration before downloading this invoice',
      'INVOICE_DETAILS_PENDING'
    );
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.fontSize(20).text(invoice.supplierName, { align: 'right' });
    doc.fontSize(10).text(invoice.supplierAddress || 'India', { align: 'right' });
    if (invoice.supplierGstin) {
      doc.text(`GSTIN: ${invoice.supplierGstin}`, { align: 'right' });
    }
    doc.moveDown(2).fontSize(18).text('TAX INVOICE');
    doc.fontSize(10).text(`Invoice number: ${invoice.invoiceNumber}`);
    doc.text(`Invoice date: ${invoice.issuedAt.toISOString().slice(0, 10)}`);
    doc.moveDown().text(`Bill to: ${invoice.recipientName}`);
    if (invoice.recipientEmail) doc.text(`Email: ${invoice.recipientEmail}`);
    if (invoice.recipientGstin) doc.text(`GSTIN: ${invoice.recipientGstin}`);
    if (invoice.recipientAddress) doc.text(`Address: ${invoice.recipientAddress}`);
    doc.moveDown().text(`SAC: ${invoice.sacCode}`);
    doc.text(invoice.description);
    doc.moveDown();
    doc.text(`Taxable value: ${inr(invoice.taxablePaise)}`);
    if (invoice.cgstPaise) doc.text(`CGST (9%): ${inr(invoice.cgstPaise)}`);
    if (invoice.sgstPaise) doc.text(`SGST (9%): ${inr(invoice.sgstPaise)}`);
    if (invoice.igstPaise) doc.text(`IGST (18%): ${inr(invoice.igstPaise)}`);
    doc.fontSize(12).text(`Total: ${inr(invoice.totalPaise)}`);
    if (invoice.providerPaymentId) doc.fontSize(9).text(`Payment reference: ${invoice.providerPaymentId}`);
    doc.fontSize(8).moveDown(2).text(
      'Samyoj SaaS subscription invoice. Meta WhatsApp fees are billed separately by Meta.'
    );
    doc.end();
  });
}

