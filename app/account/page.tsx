import { SITE } from '@/lib/site';
import { pageMeta } from '@/lib/meta';
import { PageHead } from '@/components/PageHead';
import { AccountView } from '@/components/account/AccountView';

export const metadata = pageMeta('account', '/account/'); // noindex: private page

export default function Page() {
  return (
    <>
      <PageHead page={SITE.pages.account} />
      <AccountView />
    </>
  );
}
