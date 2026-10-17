import { SITE } from '@/lib/site';
import { pageMeta, crumbLd } from '@/lib/meta';
import { PageHead } from '@/components/PageHead';
import { Legal } from '@/components/Legal';
import { JsonLd } from '@/components/JsonLd';

export const metadata = pageMeta('privacy', '/privacy/');

export default function Page() {
  return (
    <>
      <PageHead page={SITE.pages.privacy} />
      <Legal page="privacy" />
      <JsonLd data={crumbLd('privacy', '/privacy/')} />
    </>
  );
}
