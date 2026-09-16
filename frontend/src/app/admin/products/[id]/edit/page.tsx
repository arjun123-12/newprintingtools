import EditProductClient from './EditProductClient';

interface EditProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export function generateStaticParams() {
  return [{ id: 'default' }];
}

export const dynamicParams = true;

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params;

  return <EditProductClient id={id} />;
}