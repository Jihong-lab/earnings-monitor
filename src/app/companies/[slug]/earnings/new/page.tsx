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
    <div>
      <Link
        href={`/companies/${slug}`}
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        ← {company.name}
      </Link>
      <h2 className="text-2xl font-bold mb-1">Add earnings report</h2>
      <p className="text-sm text-gray-500 mb-6">
        {company.name} · {company.ticker}
      </p>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <AddEarningsForm slug={slug} />
      </div>
    </div>
  );
}
