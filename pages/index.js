import { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

// Import the BounceScene component with no SSR
const BounceScene = dynamic(() => import('@/components/BounceScene'), {
  ssr: false
});

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return (
    <>
      <Head>
        <title>Bounce - Interactive Ball Physics</title>
        <meta name="description" content="A 3D bouncing ball physics generator with optional VR support" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main>
        {isClient && (
          <>
            <BounceScene />
          </>
        )}
      </main>
    </>
  );
} 