import type { Metadata } from "next";
import "./globals.css";
import NoiseOverlay from "@/components/layout/NoiseOverlay";
import { AuthProvider } from "@/hooks/useAuth";

export const metadata: Metadata = {
  title: "LABBED — Network Simulation Platform",
  description: "Cloud-native containerlab management with multitenancy",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <NoiseOverlay />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
