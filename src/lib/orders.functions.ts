import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const itemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  variant: z.string().trim().max(120).nullable(),
  price: z.number().nonnegative().max(1_000_000),
  qty: z.number().int().min(1).max(999),
});

const orderSchema = z.object({
  customer_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(40),
  email: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  delivery: z.enum(["novaposhta", "pickup", "carrier"]),
  comment: z.string().trim().max(1000).optional().nullable(),
  lang: z.enum(["ru", "uk"]),
  items: z.array(itemSchema).min(1).max(100),
});

export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => orderSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const total = data.items.reduce((n, i) => n + i.price * i.qty, 0);

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .insert({
        customer_name: data.customer_name,
        phone: data.phone,
        email: data.email || null,
        city: data.city || null,
        delivery: data.delivery,
        comment: data.comment || null,
        total,
        lang: data.lang,
      })
      .select("id, order_no")
      .single();

    if (error || !order) throw new Error("order_failed");

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(
      data.items.map((i) => ({
        order_id: order.id,
        product_name: i.name,
        variant_label: i.variant,
        unit_price: i.price,
        quantity: i.qty,
      })),
    );

    if (itemsError) throw new Error("order_items_failed");

    return { ok: true as const, orderNo: order.order_no };
  });
