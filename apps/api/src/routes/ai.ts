import { Router } from "express";
import { z } from "zod";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { randomUUID } from "crypto";
import { convexClient } from "../lib/convex";
import { UserRequest } from "../middleware/validateUserContext";
import { ApiError } from "../middleware/errorHandler";
import { api } from "../../../../convex/_generated/api";

const router = Router();

const chatRequestSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
});

const modelId = "gpt-4o-mini";

const invoiceExtractionSchema = z.object({
  intent: z.enum(["invoice", "other"]),
  customerName: z.string().optional(),
  amount: z.number().optional(),
  title: z.string().optional(),
  currency: z.string().optional(),
});

const buildMessages = (runs: Array<{ input: string; output?: string | null }>) => {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  runs.forEach((run) => {
    if (run.input) {
      messages.push({ role: "user", content: run.input });
    }
    if (run.output) {
      messages.push({ role: "assistant", content: run.output });
    }
  });
  return messages;
};

const normalizeCurrency = (value?: string) => {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length === 3 ? trimmed : null;
};

const parseExtractionJson = (text: string) => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

router.post("/invoice", async (req: UserRequest, res, next) => {
  let conversationId: string | null = null;
  let inputMessage = "";
  try {
    const data = chatRequestSchema.parse(req.body);
    conversationId = data.conversationId || randomUUID();
    inputMessage = data.message;

    const extractionPrompt =
      "Extract invoice creation details from the user message. If the user wants to create an invoice, intent is invoice. Otherwise intent is other. Return ONLY JSON with keys: intent, customerName, amount, title, currency. amount must be a number. currency must be a 3-letter code when present.";

    const extractionResult = await generateText({
      model: openai(modelId),
      system: extractionPrompt,
      prompt: inputMessage,
    });

    const parsed = parseExtractionJson(extractionResult.text);
    const extraction = parsed ? invoiceExtractionSchema.safeParse(parsed) : null;

    if (!extraction || !extraction.success) {
      const message = "I could not read the invoice details. Please include company name, amount, and title.";
      await convexClient.mutation(api.ai.createChatRun, {
        userId: req.userId! as any,
        conversationId,
        model: modelId,
        input: inputMessage,
        output: message,
        status: "completed",
      });
      res.json({
        conversationId,
        created: false,
        intent: "invoice",
        message,
      });
      return;
    }

    if (extraction.data.intent === "other") {
      res.json({
        conversationId,
        created: false,
        intent: "other",
        message: "Not an invoice request.",
      });
      return;
    }

    const customerName = extraction.data.customerName?.trim();
    const title = extraction.data.title?.trim();
    const amount = extraction.data.amount;

    if (!customerName || !title || !amount || amount <= 0) {
      const message = "Please include company name, amount, and invoice title.";
      await convexClient.mutation(api.ai.createChatRun, {
        userId: req.userId! as any,
        conversationId,
        model: modelId,
        input: inputMessage,
        output: message,
        status: "completed",
      });
      res.json({
        conversationId,
        created: false,
        intent: "invoice",
        message,
      });
      return;
    }

    const existingCustomer = await convexClient.query(api.customers.getByName, {
      userId: req.userId! as any,
      name: customerName,
    });

    const customerId = existingCustomer
      ? existingCustomer._id
      : await convexClient.mutation(api.customers.create, {
          userId: req.userId! as any,
          name: customerName,
        });

    const user = await convexClient.query(api.users.getById, {
      userId: req.userId! as any,
    });

    const currency =
      normalizeCurrency(extraction.data.currency) ||
      normalizeCurrency(user?.defaultCurrency || "") ||
      "USD";

    const amountCents = Math.round(amount * 100);
    const invoiceNumber = `INV-${Math.floor(Math.random() * 1000000)}`;
    const issueDate = new Date().toISOString().split("T")[0];

    const invoiceId = await convexClient.mutation(api.invoices.create, {
      userId: req.userId! as any,
      customerId: customerId as any,
      invoiceNumber,
      issueDate,
      currency,
      taxCents: 0,
      discountCents: 0,
      lineItems: [
        {
          description: title,
          quantity: 1,
          unitPriceCents: amountCents,
        },
      ],
    });

    const message = `Invoice ${invoiceNumber} created for ${customerName}.`;

    await convexClient.mutation(api.ai.createChatRun, {
      userId: req.userId! as any,
      conversationId,
      model: modelId,
      input: inputMessage,
      output: message,
      status: "completed",
    });

    res.json({
      conversationId,
      created: true,
      intent: "invoice",
      message,
      invoice: {
        id: invoiceId,
        invoiceNumber,
        customerName,
        title,
        totalCents: amountCents,
        currency,
      },
    });
  } catch (error: any) {
    const fallbackConversationId =
      conversationId ||
      (typeof req.body?.conversationId === "string" ? req.body.conversationId : randomUUID());
    const fallbackMessage =
      inputMessage ||
      (typeof req.body?.message === "string" ? req.body.message : "Unknown input");
    await convexClient.mutation(api.ai.createChatRun, {
      userId: req.userId! as any,
      conversationId: fallbackConversationId,
      model: modelId,
      input: fallbackMessage,
      status: "failed",
      error: error?.message || "Invoice agent failed",
    });
    next(error);
  }
});

router.get("/chat/:conversationId", async (req: UserRequest, res, next) => {
  try {
    const conversationId = req.params.conversationId;
    if (!conversationId) {
      throw new ApiError(400, "Conversation ID is required");
    }

    const runs = await convexClient.query(api.ai.listChatRuns, {
      userId: req.userId! as any,
      conversationId,
    });

    const messages = buildMessages(runs).map((message, index) => ({
      id: `${conversationId}-${index}`,
      ...message,
    }));

    res.json({ conversationId, messages });
  } catch (error) {
    next(error);
  }
});

router.post("/chat", async (req: UserRequest, res, next) => {
  let conversationId: string | null = null;
  let inputMessage = "";
  try {
    const data = chatRequestSchema.parse(req.body);
    conversationId = data.conversationId || randomUUID();
    inputMessage = data.message;

    const priorRuns = await convexClient.query(api.ai.listChatRuns, {
      userId: req.userId! as any,
      conversationId,
    });

    const systemPrompt =
      "You are Scaly Assistant, an expert invoicing assistant. Help with invoices, customers, payments, and analytics. Keep answers concise and actionable.";

    const messages = buildMessages(priorRuns);
    messages.push({ role: "user", content: inputMessage });

    const result = await generateText({
      model: openai(modelId),
      system: systemPrompt,
      messages,
    });

    await convexClient.mutation(api.ai.createChatRun, {
      userId: req.userId! as any,
      conversationId,
      model: modelId,
      input: inputMessage,
      output: result.text,
      tokenUsage: result.usage?.totalTokens,
      status: "completed",
    });

    res.json({
      conversationId,
      message: result.text,
    });
  } catch (error: any) {
    const fallbackConversationId =
      conversationId ||
      (typeof req.body?.conversationId === "string" ? req.body.conversationId : randomUUID());
    const fallbackMessage =
      inputMessage ||
      (typeof req.body?.message === "string" ? req.body.message : "Unknown input");
    await convexClient.mutation(api.ai.createChatRun, {
      userId: req.userId! as any,
      conversationId: fallbackConversationId,
      model: modelId,
      input: fallbackMessage,
      status: "failed",
      error: error?.message || "AI request failed",
    });
    next(error);
  }
});

export { router as aiRouter };
