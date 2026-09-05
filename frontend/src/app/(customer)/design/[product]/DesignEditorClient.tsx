'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import {
  useParams,
  useRouter,
  useSearchParams,
} from 'next/navigation';

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ??
  'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '');

const Designer = dynamic(
  () => import('@/components/designer/Designer'),
  {
    ssr: false,
    loading: () => <LoadingStudio message="Loading Artwork Studio..." />,
  }
);

interface DesignEditorClientProps {
  product?: string;
}

interface TemplateApiResponse {
  success?: boolean;
  message?: string;
  data?: {
    id?: string;
    product_id?: string | null;
    product?: {
      id?: string | null;
    } | null;
    data?: {
      id?: string;
      product_id?: string | null;
      product?: {
        id?: string | null;
      } | null;
    };
  };
}

function LoadingStudio({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 text-white">
      <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />

      <p className="text-sm font-semibold text-slate-300">
        {message}
      </p>
    </div>
  );
}

export default function DesignEditorClient({
  product,
}: DesignEditorClientProps) {
  const router = useRouter();
  const routeParams = useParams<{ product?: string }>();
  const searchParams = useSearchParams();

  const artworkId = searchParams.get('artworkId') || undefined;
  const templateId = searchParams.get('templateId') || undefined;
  const mode = searchParams.get('mode') || undefined;
  const productIdFromQuery =
    searchParams.get('productId') || undefined;

  const initialProductId =
    product ||
    routeParams?.product ||
    productIdFromQuery;

  const [resolvedProductId, setResolvedProductId] = useState<
    string | undefined
  >(initialProductId);
  const [isResolvingTemplate, setIsResolvingTemplate] = useState(
    mode === 'admin-template' && !initialProductId
  );
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProductId) {
      setResolvedProductId(initialProductId);
      setIsResolvingTemplate(false);
      setTemplateError(null);
      return;
    }

    if (mode !== 'admin-template') {
      setIsResolvingTemplate(false);
      return;
    }

    if (!templateId) {
      setTemplateError('Template ID is missing.');
      setIsResolvingTemplate(false);
      return;
    }

    const token = localStorage.getItem('auth_token');

    if (!token) {
      setTemplateError('Please log in to edit an admin template.');
      setIsResolvingTemplate(false);
      router.replace('/admin/login');
      return;
    }

    const controller = new AbortController();

    const resolveTemplateProduct = async () => {
      setIsResolvingTemplate(true);
      setTemplateError(null);

      try {
        const response = await fetch(
          `${API_URL}/admin/templates/${encodeURIComponent(templateId)}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        const result = (await response
          .json()
          .catch(() => null)) as TemplateApiResponse | null;

        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          router.replace('/admin/login');
          throw new Error('Your login session has expired.');
        }

        if (!response.ok) {
          throw new Error(
            result?.message ??
            `Could not load template (${response.status}).`
          );
        }

        const templateData = result?.data?.data ?? result?.data;
        const loadedProductId =
          templateData?.product_id ??
          templateData?.product?.id ??
          undefined;

        if (!loadedProductId || loadedProductId === 'default') {
          throw new Error(
            'This template is not connected to a valid product.'
          );
        }

        setResolvedProductId(String(loadedProductId));
      } catch (error) {
        if (controller.signal.aborted) return;

        setTemplateError(
          error instanceof Error
            ? error.message
            : 'Could not load the template product.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsResolvingTemplate(false);
        }
      }
    };

    void resolveTemplateProduct();

    return () => {
      controller.abort();
    };
  }, [initialProductId, mode, router, templateId]);

  if (isResolvingTemplate) {
    return <LoadingStudio message="Loading template product..." />;
  }

  if (mode === 'admin-template' && templateError) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-red-800 bg-slate-900 p-6 shadow-2xl">
          <h1 className="text-lg font-bold text-red-300">
            Template could not be opened
          </h1>

          <p className="mt-2 text-sm text-slate-300">
            {templateError}
          </p>

          <a
            href="/admin/templates"
            className="mt-5 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 text-center"
          >
            Return to templates
          </a>
        </div>
      </div>
    );
  }

  return (
    <Designer
      productId={resolvedProductId}
      artworkId={artworkId}
      templateId={templateId}
      mode={mode}
    />
  );
}
