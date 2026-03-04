import { Router } from "express";
import { db } from "../config/db.js";
import {
    restaurantTables,
    categoriesTable,
    menuItemsTable,
    ordersTable,
    orderItemsTable,
} from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { catchAsyncErrors } from "../config/auth.js";

const router = Router();

// ══════════════════════════════════════════════════════════════════════════════
// 📋 매장 테이블 관리
// ══════════════════════════════════════════════════════════════════════════════

// 전체 테이블 조회
router.get("/tables", catchAsyncErrors(async (req, res) => {
    const tables = await db.select().from(restaurantTables);
    res.json(tables);
}));

// 테이블 추가
router.post("/tables", catchAsyncErrors(async (req, res) => {
    const { tableNumber, capacity } = req.body;
    if (!tableNumber) return res.status(400).json({ error: "tableNumber가 필요합니다." });
    const result = await db.insert(restaurantTables)
        .values({ tableNumber, capacity: capacity ?? 4 })
        .returning();
    res.status(201).json(result[0]);
}));

// 테이블 상태 변경 (available|occupied|reserved)
router.patch("/tables/:id/status", catchAsyncErrors(async (req, res) => {
    const { status } = req.body;
    if (!["available", "occupied", "reserved"].includes(status))
        return res.status(400).json({ error: "status: available|occupied|reserved" });
    const result = await db.update(restaurantTables)
        .set({ status })
        .where(eq(restaurantTables.id, parseInt(req.params.id)))
        .returning();
    if (!result.length) return res.status(404).json({ error: "테이블을 찾을 수 없습니다." });
    res.json(result[0]);
}));

// 테이블 삭제
router.delete("/tables/:id", catchAsyncErrors(async (req, res) => {
    console.log('테이블 삭제', req.params.id);
    await db.delete(restaurantTables).where(eq(restaurantTables.id, parseInt(req.params.id)));
    res.json({ message: "테이블이 삭제되었습니다." });
}));

// ══════════════════════════════════════════════════════════════════════════════
// 🏷️ 카테고리 관리
// ══════════════════════════════════════════════════════════════════════════════

// 카테고리 전체 조회
router.get("/categories", catchAsyncErrors(async (req, res) => {
    const cats = await db.select().from(categoriesTable);
    res.json(cats);
}));

// 카테고리 추가
router.post("/categories", catchAsyncErrors(async (req, res) => {
    const { name, sortOrder } = req.body;
    if (!name) return res.status(400).json({ error: "name이 필요합니다." });
    const result = await db.insert(categoriesTable)
        .values({ name, sortOrder: sortOrder ?? 0 })
        .returning();
    res.status(201).json(result[0]);
}));

// 카테고리 삭제
router.delete("/categories/:id", catchAsyncErrors(async (req, res) => {
    await db.delete(categoriesTable).where(eq(categoriesTable.id, parseInt(req.params.id)));
    res.json({ message: "카테고리가 삭제되었습니다." });
}));

// ══════════════════════════════════════════════════════════════════════════════
// 🍽️ 메뉴 관리
// ══════════════════════════════════════════════════════════════════════════════

// 메뉴 전체 조회 (카테고리 필터 가능)
router.get("/menu", catchAsyncErrors(async (req, res) => {
    const { categoryId } = req.query;
    const query = db.select().from(menuItemsTable);
    const items = categoryId
        ? await query.where(eq(menuItemsTable.categoryId, parseInt(categoryId)))
        : await query;
    res.json(items);
}));

// 메뉴 추가
router.post("/menu", catchAsyncErrors(async (req, res) => {
    const { categoryId, name, price, description, image } = req.body;
    if (!categoryId || !name || !price)
        return res.status(400).json({ error: "categoryId, name, price가 필요합니다." });
    const result = await db.insert(menuItemsTable)
        .values({ categoryId, name, price, description, image })
        .returning();
    res.status(201).json(result[0]);
}));

// 메뉴 수정
router.patch("/menu/:id", catchAsyncErrors(async (req, res) => {
    const { name, price, description, image, isAvailable } = req.body;
    const result = await db.update(menuItemsTable)
        .set({
            ...(name && { name }), ...(price && { price }),
            ...(description !== undefined && { description }),
            ...(image !== undefined && { image }),
            ...(isAvailable !== undefined && { isAvailable })
        })
        .where(eq(menuItemsTable.id, parseInt(req.params.id)))
        .returning();
    if (!result.length) return res.status(404).json({ error: "메뉴를 찾을 수 없습니다." });
    res.json(result[0]);
}));

// 메뉴 삭제
router.delete("/menu/:id", catchAsyncErrors(async (req, res) => {
    await db.delete(menuItemsTable).where(eq(menuItemsTable.id, parseInt(req.params.id)));
    res.json({ message: "메뉴가 삭제되었습니다." });
}));

// ══════════════════════════════════════════════════════════════════════════════
// 🛒 주문 관리
// ══════════════════════════════════════════════════════════════════════════════

// 전체 주문 조회 (status 필터 가능: /orders?status=pending)
router.get("/orders", catchAsyncErrors(async (req, res) => {
    const { status } = req.query;
    const query = db.select().from(ordersTable);
    const orders = status
        ? await query.where(eq(ordersTable.status, status))
        : await query;
    res.json(orders);
}));

// 테이블별 주문 조회
router.get("/orders/table/:tableId", catchAsyncErrors(async (req, res) => {
    const orders = await db.select().from(ordersTable)
        .where(eq(ordersTable.tableId, parseInt(req.params.tableId)));
    res.json(orders);
}));

// 주문 단건 조회 (항목 + 메뉴명 포함)
router.get("/orders/:id", catchAsyncErrors(async (req, res) => {
    const orderId = parseInt(req.params.id);
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });

    // order_items JOIN menu_items → 메뉴명·단가·소계 포함
    const items = await db
        .select({
            id: orderItemsTable.id,
            menuItemId: orderItemsTable.menuItemId,
            name: menuItemsTable.name,
            quantity: orderItemsTable.quantity,
            unitPrice: orderItemsTable.unitPrice,
            subtotal: orderItemsTable.subtotal,
        })
        .from(orderItemsTable)
        .leftJoin(menuItemsTable, eq(orderItemsTable.menuItemId, menuItemsTable.id))
        .where(eq(orderItemsTable.orderId, orderId));

    res.json({ ...order, items });
}));

// 주문 생성 (테이블 status → occupied)
router.post("/orders", catchAsyncErrors(async (req, res) => {
    const { tableId, memo, items } = req.body;
    // items: [{ menuItemId, quantity }]
    if (!tableId || !items?.length)
        return res.status(400).json({ error: "tableId와 items가 필요합니다." });

    // 메뉴 가격 조회
    const menuIds = items.map(i => i.menuItemId);
    const menus = await db.select().from(menuItemsTable);
    const menuMap = Object.fromEntries(menus.map(m => [m.id, m]));

    let totalAmount = 0;
    const orderItemsData = items.map(({ menuItemId, quantity }) => {
        const menu = menuMap[menuItemId];
        if (!menu) throw new Error(`menuItemId ${menuItemId} 존재하지 않음`);
        const subtotal = menu.price * quantity;
        totalAmount += subtotal;
        return { menuItemId, quantity, unitPrice: menu.price, subtotal };
    });

    // 주문 생성
    const [newOrder] = await db.insert(ordersTable)
        .values({ tableId, memo, totalAmount })
        .returning();

    // 주문 항목 삽입
    const insertedItems = await db.insert(orderItemsTable)
        .values(orderItemsData.map(item => ({ ...item, orderId: newOrder.id })))
        .returning();

    // 테이블 상태 occupied로 변경
    await db.update(restaurantTables)
        .set({ status: "occupied" })
        .where(eq(restaurantTables.id, tableId));

    res.status(201).json({ ...newOrder, items: insertedItems });
}));

// 주문 항목 추가 (이미 생성된 주문에 메뉴 추가)
router.post("/orders/:id/items", catchAsyncErrors(async (req, res) => {
    const orderId = parseInt(req.params.id);
    const { menuItemId, quantity = 1 } = req.body;
    const [menu] = await db.select().from(menuItemsTable).where(eq(menuItemsTable.id, menuItemId));
    if (!menu) return res.status(404).json({ error: "메뉴를 찾을 수 없습니다." });
    const subtotal = menu.price * quantity;
    const [item] = await db.insert(orderItemsTable)
        .values({ orderId, menuItemId, quantity, unitPrice: menu.price, subtotal })
        .returning();
    // 총액 갱신
    const allItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
    const totalAmount = allItems.reduce((sum, i) => sum + i.subtotal, 0);
    await db.update(ordersTable).set({ totalAmount }).where(eq(ordersTable.id, orderId));
    res.status(201).json(item);
}));

// 주문 상태 변경 (pending→confirmed→served→paid)
router.patch("/orders/:id/status", catchAsyncErrors(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ["pending", "confirmed", "served", "paid"];
    if (!validStatuses.includes(status))
        return res.status(400).json({ error: `status: ${validStatuses.join("|")}` });

    const [updated] = await db.update(ordersTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(ordersTable.id, parseInt(req.params.id)))
        .returning();
    if (!updated) return res.status(404).json({ error: "주문을 찾을 수 없습니다." });

    // 결제 완료 시 테이블 available로 변경
    if (status === "paid") {
        await db.update(restaurantTables)
            .set({ status: "available" })
            .where(eq(restaurantTables.id, updated.tableId));
    }
    res.json(updated);
}));

// 주문 삭제
router.delete("/orders/:id", catchAsyncErrors(async (req, res) => {
    await db.delete(ordersTable).where(eq(ordersTable.id, parseInt(req.params.id)));
    res.json({ message: "주문이 삭제되었습니다." });
}));

export default router;
