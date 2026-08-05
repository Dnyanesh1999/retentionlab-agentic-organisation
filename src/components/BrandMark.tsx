export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" role="img">
        <circle cx="16" cy="16" r="11.5" />
        <path d="M16 5v7.25" />
        <path d="M10.4 9.1a8 8 0 1 0 11.2 0" />
        <circle className="brand-mark__core" cx="16" cy="16" r="3.2" />
      </svg>
    </span>
  );
}

