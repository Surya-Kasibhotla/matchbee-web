import { SITE } from '@/lib/site';

/** The logo file is the single source for the mark */
export function BrandMark({ size = 34 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="brand-mark" src="/logo.svg" alt="" width={size} height={size} />;
}

/** Brand name with brand.accent (e.g. "Bee") in the honey colour */
export function Wordmark() {
  const { name, accent } = SITE.brand, i = accent ? name.lastIndexOf(accent) : -1;
  if (i < 0) return <span className="wordmark">{name}</span>;
  return <span className="wordmark">{name.slice(0, i)}<span className="bee">{accent}</span>{name.slice(i + accent.length)}</span>;
}
