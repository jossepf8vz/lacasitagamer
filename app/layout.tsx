import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'La Casita Gamer',
  description: 'Tienda de juegos y tarjetas digitales.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}