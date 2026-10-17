import { SITE } from '@/lib/site';
import { pageMeta, crumbLd } from '@/lib/meta';
import { PageHead } from '@/components/PageHead';
import { Legal } from '@/components/Legal';
import { JsonLd } from '@/components/JsonLd';

export const metadata = pageMeta('terms', '/terms/');

export default function Page() {
  return (
    <>
      <PageHead page={SITE.pages.terms} />
      <Legal page="terms" />
      <JsonLd data={crumbLd('terms', '/terms/')} />
    </>
  );
}
