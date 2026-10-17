import { SITE } from '@/lib/site';
import { pageMeta, crumbLd, appLd } from '@/lib/meta';
import { PageHead } from '@/components/PageHead';
import { AtsPage, AtsSampleButton } from '@/components/ats/AtsPage';
import { JsonLd } from '@/components/JsonLd';

export const metadata = pageMeta('ats', '/ats/');

export default function Page() {
  return (
    <>
      <PageHead page={SITE.pages.ats}><AtsSampleButton /></PageHead>
      <AtsPage />
      <JsonLd data={[appLd('ats', '/ats/'), crumbLd('ats', '/ats/')]} />
    </>
  );
}
