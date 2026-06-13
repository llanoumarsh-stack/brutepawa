import { Router } from "express";
import { db, productsTable, ordersTable } from "@workspace/db";
import { eq, ilike, and, desc } from "drizzle-orm";
import {
  CreateProductBody, GetProductParams, UpdateProductParams, UpdateProductBody,
  DeleteProductParams, ListProductsQueryParams, CreateOrderBody, GetOrderParams
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { deleteObject, extractKeyFromUrl } from "../lib/r2";

const router = Router();

function fmt(p: typeof productsTable.$inferSelect) {
  return { ...p, price: Number(p.price) };
}

router.get("/products/featured", requireAuth, async (req, res): Promise<void> => {
  const products = await db.select().from(productsTable)
    .where(eq(productsTable.status, "active"))
    .orderBy(desc(productsTable.createdAt))
    .limit(8);
  res.json(products.map(fmt));
});

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);

  const conditions = [eq(productsTable.status, "active")];
  if (params.success && params.data.category) {
    conditions.push(eq(productsTable.category, params.data.category));
  }
  if (params.success && params.data.search) {
    conditions.push(ilike(productsTable.title, `%${params.data.search}%`));
  }

  const products = await db.select().from(productsTable)
    .where(and(...conditions))
    .orderBy(desc(productsTable.createdAt))
    .limit(50);
  res.json(products.map(fmt));
});

router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // thumbnailUrl is outside the generated schema — read directly from body
  const thumbnailUrl = typeof req.body.thumbnailUrl === "string" ? req.body.thumbnailUrl : null;

  const [product] = await db.insert(productsTable).values({
    ...parsed.data,
    price: String(parsed.data.price),
    sellerId: req.userId!,
    thumbnailUrl,
  }).returning();
  res.status(201).json(fmt(product));
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, params.data.id));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(fmt(product));
});

router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse({ id: Number(req.params.id) });
  const body = UpdateProductBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const updateData: Record<string, unknown> = { ...body.data };
  if (body.data.price != null) updateData.price = String(body.data.price);
  // thumbnailUrl update supported outside generated schema
  if (typeof req.body.thumbnailUrl === "string") updateData.thumbnailUrl = req.body.thumbnailUrl;

  const [product] = await db.update(productsTable).set(updateData)
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.sellerId, req.userId!)))
    .returning();
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json(fmt(product));
});

router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [product] = await db.select({
    id: productsTable.id,
    imageUrl: productsTable.imageUrl,
    thumbnailUrl: productsTable.thumbnailUrl,
  }).from(productsTable)
    .where(and(eq(productsTable.id, params.data.id), eq(productsTable.sellerId, req.userId!)));

  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  await db.delete(productsTable).where(eq(productsTable.id, params.data.id));

  // Best-effort R2 cleanup
  const r2Keys = [
    extractKeyFromUrl(product.imageUrl),
    extractKeyFromUrl(product.thumbnailUrl),
  ].filter((k): k is string => k !== null);
  await Promise.all(r2Keys.map(k => deleteObject(k).catch(() => {})));

  res.sendStatus(204);
});

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const orders = await db.select().from(ordersTable)
    .where(eq(ordersTable.buyerId, req.userId!))
    .orderBy(desc(ordersTable.createdAt));
  res.json(orders.map(o => ({ ...o, amount: Number(o.amount) })));
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parsed.data.productId));
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }

  const [order] = await db.insert(ordersTable).values({
    productId: parsed.data.productId,
    buyerId: req.userId!,
    amount: product.price,
    currency: product.currency,
  }).returning();
  res.status(201).json({ ...order, amount: Number(order.amount) });
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, params.data.id), eq(ordersTable.buyerId, req.userId!)));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json({ ...order, amount: Number(order.amount) });
});

export default router;
