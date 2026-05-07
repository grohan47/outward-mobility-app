import OpportunityEditor from "@/components/admin/OpportunityEditor";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditOpportunityPage({ params }: PageProps) {
  const { id } = await params;
  return <OpportunityEditor mode="edit" opportunityId={id} />;
}
