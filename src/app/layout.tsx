import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Realtime API Agents",
  description: "A demo app from OpenAI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no" />
        <meta name="disable-autofill" content="true" />
        <meta name="dashlane-autofill-off" content="true" />
      </head>
      <body className={`antialiased`}>{children}</body>
    </html>
  );
}
