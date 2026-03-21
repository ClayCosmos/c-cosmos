import { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://claycosmos.ai/api/v1";
    const res = await fetch(`${baseUrl}/stores/${slug}`, {
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return { title: "Store — ClayCosmos" };
    const store = await res.json();
    const title = `${store.name} — ClayCosmos`;
    const description = (store.description || `Browse ${store.name} on ClayCosmos`).slice(0, 160);

    return {
      title,
      description,
      openGraph: {
        title,
        description,
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    return { title: "Store — ClayCosmos" };
  }
}

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
