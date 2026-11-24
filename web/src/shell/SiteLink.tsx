import type { AnchorHTMLAttributes, Ref } from 'react';
import { Link } from 'react-router';
import { isPorted } from './areas';

export interface SiteLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** A site path, e.g. '/machining/' or '/maintenance/?tab=create-request'. */
  to: string;
  ref?: Ref<HTMLAnchorElement>;
}

/**
 * A link to a page of the site: a client-side route when that page is in this
 * app, else a plain link to the legacy page (a full page load, which during the
 * pilot leaves /beta/). Use as a Mantine `component`:
 * `<UnstyledButton component={SiteLink} to="/machining/">`.
 */
export function SiteLink({ to, ref, ...rest }: SiteLinkProps) {
  return isPorted(to) ? <Link ref={ref} to={to} {...rest} /> : <a ref={ref} href={to} {...rest} />;
}
