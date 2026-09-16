import EditTemplateClient from './EditTemplateClient';

interface EditTemplatePageProps {
  params: Promise<{
    id: string;
  }>;
}

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export const dynamicParams = true;

export default async function EditTemplatePage({
  params,
}: EditTemplatePageProps) {
  const { id } = await params;

  return <EditTemplateClient id={id} />;
}