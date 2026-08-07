import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { PAGES } from "@/lib/site";

const BASE_URL = "https://www.technoforma.com.ua";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const paths = ["/", "/uk/", ...PAGES.flatMap((p) => [`/${p.slug}.php`, `/uk/${p.slug}.php`])];

        const urls = paths.map((path) => {
          const ru = path.startsWith("/uk") ? path.replace(/^\/uk/, "") || "/" : path;
          const uk = path.startsWith("/uk") ? path : `/uk${path === "/" ? "/" : path}`;
          return [
            "  <url>",
            `    <loc>${BASE_URL}${path}</loc>`,
            `    <xhtml:link rel="alternate" hreflang="ru" href="${BASE_URL}${ru}"/>`,
            `    <xhtml:link rel="alternate" hreflang="uk" href="${BASE_URL}${uk}"/>`,
            `    <changefreq>weekly</changefreq>`,
            `    <priority>${path === "/" ? "1.0" : "0.8"}</priority>`,
            "  </url>",
          ].join("\n");
        });

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
          ...urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
