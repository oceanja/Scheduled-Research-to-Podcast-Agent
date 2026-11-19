type Props = {
  size?: number;
  withWordmark?: boolean;
};

export function Logo({ size = 28, withWordmark = true }: Props) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <rect width="24" height="24" rx="6" fill="#09090B" />
        <g stroke="#FAFAFA" strokeWidth="2" strokeLinecap="round">
          <line x1="7" y1="10" x2="7" y2="14" />
          <line x1="10" y1="7" x2="10" y2="17" />
          <line x1="13" y1="9" x2="13" y2="15" />
          <line x1="16" y1="5" x2="16" y2="19" />
          <line x1="19" y1="11" x2="19" y2="13" />
        </g>
      </svg>
      {withWordmark && (
        <span className="font-semibold tracking-tight text-[15px]">
          Daily Brief
        </span>
      )}
    </div>
  );
}
