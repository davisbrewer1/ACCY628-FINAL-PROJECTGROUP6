import Image from "next/image";

type LogoSize = "sm" | "md" | "lg";

interface NexusLogoProps {
  size?: LogoSize;
  className?: string;
  /** When true, hide from assistive tech (pair with visible company name). */
  decorative?: boolean;
}

const MARK_SIZES: Record<LogoSize, { className: string; px: number }> = {
  sm: { className: "size-8", px: 32 },
  md: { className: "size-10", px: 40 },
  lg: { className: "size-20", px: 80 },
};

export function NexusLogo({
  size = "md",
  className = "",
  decorative = false,
}: NexusLogoProps) {
  const dims = MARK_SIZES[size];
  return (
    <Image
      src="/brand/nx-mark.png"
      alt={decorative ? "" : "Nexus Technology Solutions"}
      width={dims.px}
      height={dims.px}
      className={`${dims.className} shrink-0 object-contain ${className}`.trim()}
      aria-hidden={decorative || undefined}
      priority
    />
  );
}
