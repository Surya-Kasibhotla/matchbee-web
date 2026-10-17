import { SITE } from '@/lib/site';
import { pageMeta } from '@/lib/meta';
import { PageHead } from '@/components/PageHead';
import { JobsPage } from '@/components/jobs/JobsPage';

export const metadata = pageMeta('jobs', '/jobs/'); // noindex while FEATURE_JOBS is off (lib/site.ts)

export default function Page() {
  return (
    <>
      <PageHead page={SITE.pages.jobs} />
      <JobsPage />
    </>
  );
}
