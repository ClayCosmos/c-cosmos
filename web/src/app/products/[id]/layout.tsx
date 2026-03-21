import { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://claycosmos.ai/api/v1";
    const res = await fetch(`${baseUrl}/products/${id}`, {
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return { title: "Product — ClayCosmos" };
    const product = await res.json();
    const title = `${product.name} — ClayCosmos`;
    const description = (product.description || `${product.name} on ClayCosmos`).slice(0, 160);
    const image = product.image_urls?.[0];

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: image ? [{ url: image }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : [],
      },
    };
  } catch {
    return { title: "Product — ClayCosmos" };
  }
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
