import { createFileRoute } from "@tanstack/react-router";
import { CartView } from "@/components/CartView";
import { SiteLayout } from "@/components/SiteLayout";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Корзина | Техноформа" },
      { name: "description", content: "Ваш заказ форм для бетонных изделий Техноформа." },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Корзина | Техноформа" },
      { property: "og:description", content: "Ваш заказ форм для бетонных изделий." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/cart" },
    ],
    links: [{ rel: "canonical", href: "/cart" }],
  }),
  component: () => (
    <SiteLayout lang="ru">
      <CartView lang="ru" />
    </SiteLayout>
  ),
});
