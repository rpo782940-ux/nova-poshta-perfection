import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { HomeView } from "@/components/views";
import { highlightsQuery, navQuery } from "@/lib/catalog-queries";

const TITLE = "Техноформа";
const DESC =
  "Technoforma производит для Вас формы для надгробий любой сложности. АБС и ПВХ формы для изготовления надгробий из бетона. У нас: цены от производителя, широкий ассортимент и выгодные предложения. Заходите к нам и убедитесь сами!";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(navQuery),
      context.queryClient.ensureQueryData(highlightsQuery("ru")),
    ]);
    return null;
  },
  errorComponent: ({ error }) => (
    <div role="alert" className="container-page py-20 text-center">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="container-page py-20 text-center">404</div>,
  head: () => ({

    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { property: "og:locale", content: "ru_UA" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      { rel: "alternate", hrefLang: "ru", href: "/" },
      { rel: "alternate", hrefLang: "uk", href: "/uk/" },
      { rel: "alternate", hrefLang: "x-default", href: "/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Техноформа",
          url: "https://www.technoforma.com.ua/",
          description: DESC,
          telephone: "+380676302727",
          address: {
            "@type": "PostalAddress",
            addressCountry: "UA",
            addressLocality: "Дніпро",
          },
        }),
      },
    ],
  }),
  component: () => (
    <SiteLayout lang="ru">
      <HomeView lang="ru" />
    </SiteLayout>
  ),
});
