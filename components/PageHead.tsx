import Link from 'next/link';
import { fill } from '@/lib/text';

/** Title band for inner pages: breadcrumb, title, subtitle and optional action buttons (children). */
export function PageHead({ page, children }: { page: { crumb?: string; h1?: string; sub?: string }; children?: React.ReactNode }) {
  return (
    <section className="pagehead">
      <div className="container pagehead-in">
        <div>
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span>{fill(page.crumb)}</span></nav>
          <h1>{fill(page.h1)}</h1>
          <p className="sub">{fill(page.sub)}</p>
        </div>
        {children && <div className="pagehead-actions">{children}</div>}
      </div>
    </section>
  );
}
