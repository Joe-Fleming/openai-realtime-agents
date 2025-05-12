import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function RAGDemoIndex() {
  const router = useRouter();
  useEffect(() => {
    router.push('/rag-demo');
  }, [router]);
  return null;
} 