import React from 'react';
import Head from 'next/head';
import CustomVideoPlayer from './components/CustomVideoPlayer';

const HomePage: React.FC = () => {
  return (
    <div>
      <Head>
        <title>Аниме Видеоплеер</title>
        <meta name="description" content="Кастомный аниме видеоплеер на Next.js с WebGPU" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <CustomVideoPlayer />
      </main>
    </div>
  );
};

export default HomePage;
