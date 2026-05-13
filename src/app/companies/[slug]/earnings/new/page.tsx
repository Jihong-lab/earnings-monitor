import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/data/companies";
import { AddEarningsForm } from "./form";

export const maxDuration = 120;

export default async function AddEarningsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = getCompanyBySlug(slug);
  if (!company) notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link
        href={`/companies/${slug}`}
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← {company.name}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mt-2 mb-1">
        Add earnings report
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-8">
        {company.name} · {company.ticker}
      </p>
      <AddEarningsForm slug={slug} />
    </div>
  );
}
