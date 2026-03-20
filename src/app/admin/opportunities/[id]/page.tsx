import OpportunityEditor from "@/components/admin/OpportunityEditor";

type PageProps = {
  params: {
    id: string;
  };
};

export default function EditOpportunityPage({ params }: PageProps) {
  return <OpportunityEditor mode="edit" opportunityId={params.id} />;
}
