import { Link, type LinkProps } from 'react-router-dom';
import { prefetchRoute } from '../lib/route-prefetch';

export const PrefetchLink = ({ onFocus, onMouseEnter, to, ...props }: LinkProps) => {
  const path = typeof to === 'string' ? to : to.pathname;
  return (
    <Link
      {...props}
      onFocus={(event) => {
        if (path) prefetchRoute(path);
        onFocus?.(event);
      }}
      onMouseEnter={(event) => {
        if (path) prefetchRoute(path);
        onMouseEnter?.(event);
      }}
      to={to}
    />
  );
};
