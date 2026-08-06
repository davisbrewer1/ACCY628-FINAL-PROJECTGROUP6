import { PortalAccessProvider } from "@/components/PortalAccessProvider";

export default function EndUserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalAccessProvider>{children}</PortalAccessProvider>;
}
