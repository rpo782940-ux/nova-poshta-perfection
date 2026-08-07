import { createFileRoute, notFound } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductPage } from "@/components/ProductPage";
import { productQuery } from "@/lib/catalog-queries";

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(productQuery(params.slug, "ru"));
    if (!data) throw notFound();
    return { name: data.product.name, description: data.product.description };
  },
  head: ({ loaderData, params }) => {
    const title = loaderData ? `${loaderData.name} | Техноформа` : "Товар | Техноформа";
    const desc = loaderData?.description?.slice(0, 155) ?? "";
    const url = `/p/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        { rel: "canonical", href: url },
        { rel: "alternate", hrefLang: "ru", href: url },
        { rel: "alternate", hrefLang: "uk", href: `/uk${url}` },
      ],
    };
  },
  errorComponent: ({ error }) => (
    <div role="alert" className="container-page py-20 text-center">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="container-page py-20 text-center">404</div>,
  component: () => {
    const { slug } = Route.useParams();
    return (
      <SiteLayout lang="ru">
        <ProductPage slug={slug} lang="ru" />
      </SiteLayout>
    );
  },
});
