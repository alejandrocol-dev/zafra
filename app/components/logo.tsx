import { useId } from "react";

const COB = "M24 4.5c4.6 0 7.4 6 7.4 15.5S29 38 24 38s-7.4-8.5-7.4-18S19.4 4.5 24 4.5Z";
const HUSK_L = "M24 44.5C14.5 42.5 9 32.5 10 17.5c5.5 6.5 10 13.5 14 22Z";
const HUSK_R = "M24 44.5c9.5-2 15-12 14-27-5.5 6.5-10 13.5-14 22Z";

export function ZafraMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden>
      <mask id={id}>
        <rect width="48" height="48" fill="#fff" />
        <g stroke="#000" strokeWidth="1.5" strokeLinecap="round">
          <path d="M21.6 9v26M26.4 9v26M17 12.5h14M17 17h14M17 21.5h14M17 26h14M17 30.5h14" />
        </g>
        <g fill="#000" stroke="#000" strokeWidth="4.4" strokeLinejoin="round">
          <path d={HUSK_L} />
          <path d={HUSK_R} />
        </g>
      </mask>
      <mask id={`${id}h`}>
        <rect width="48" height="48" fill="#fff" />
        <path d={HUSK_R} fill="none" stroke="#000" strokeWidth="3.2" strokeLinejoin="round" />
      </mask>
      <path d={COB} mask={`url(#${id})`} />
      <path d={HUSK_L} mask={`url(#${id}h)`} />
      <path d={HUSK_R} />
    </svg>
  );
}
