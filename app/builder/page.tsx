import { SITE } from '@/lib/site';
import { pageMeta, crumbLd, appLd } from '@/lib/meta';
import { PageHead } from '@/components/PageHead';
import { Builder, BuilderActions } from '@/components/builder/Builder';
import { JsonLd } from '@/components/JsonLd';

export const metadata = pageMeta('builder', '/builder/');

export default function Page() {
  return (
    <>
      <PageHead page={SITE.pages.builder}><BuilderActions /></PageHead>
      <Builder />
      <JsonLd data={[appLd('builder', '/builder/'), crumbLd('builder', '/builder/')]} />
    </>
  );
}
