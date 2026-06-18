import { useState } from 'react';

/** Renders a national flag SVG from flagcdn.com by ISO code, with a text fallback
 *  if the image fails to load (offline, blocked domain, etc). */
export default function Flag({ code, name, className = '' }) {
  const [failed, setFailed] = useState(false);
  const src = `https://flagcdn.com/${code}.svg`;

  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center bg-slate-line text-[9px] font-bold text-ink rounded-sm ${className}`}
        title={name}
      >
        {code.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} flag`}
      title={name}
      onError={() => setFailed(true)}
      className={`object-cover rounded-sm ring-1 ring-black/10 ${className}`}
      loading="lazy"
    />
  );
}
