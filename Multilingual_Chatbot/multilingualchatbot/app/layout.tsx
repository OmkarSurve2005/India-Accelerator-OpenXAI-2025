import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Multilingual Chatbot",
  description: "Chat with an AI that replies in your selected language.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}