export const metadata = {
  title: "King Scoreboard",
  description: "Teste do projeto King",
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
