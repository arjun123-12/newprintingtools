import ClientBriefForm from '@/components/client-brief/ClientBriefForm';

interface ClientBriefPageProps {
    params: Promise<{
        token: string;
    }>;
}

export default async function ClientBriefPage({
    params,
}: ClientBriefPageProps) {
    const { token } = await params;

    return (
        <ClientBriefForm token={token} />
    );
}