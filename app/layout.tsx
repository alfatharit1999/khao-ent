import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { BottomNav } from "./components/BottomNav";
import { BackupLink } from "./components/BackupLink";

const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ข้าว ENT — สั่งข้าว & เครดิต",
  description: "ระบบสั่งข้าวกลางวันและจัดการเครดิตของ resident ENT",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ea7a3b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className={notoThai.className}>
        <div className="app-shell">
          {children}
          <BackupLink />
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
