import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Аниме Видеоплеер',
  description: 'Аниме видеоплеер на Next.js',
};

const RootLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
};

export default RootLayout;
