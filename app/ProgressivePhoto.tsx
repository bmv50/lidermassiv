'use client';

import {useEffect, useRef, useState} from 'react';

type Props = {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  decoding?: 'async' | 'sync' | 'auto';
};

export default function ProgressivePhoto({src, alt, className, loading = 'lazy', decoding = 'async'}: Props) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {if (image.current?.complete) setState(image.current.naturalWidth > 0 ? 'ready' : 'error');}, [src]);

  return <>
    {state === 'loading' && <span className="shop-image-placeholder" aria-hidden="true"><span/></span>}
    {state === 'error'
      ? <span className="shop-image-unavailable" role="img" aria-label={alt + ': фотография временно недоступна'}>Фото временно недоступно</span>
      : <img ref={image} className={className} src={src} alt={alt} loading={loading} decoding={decoding} onLoad={() => setState('ready')} onError={() => setState('error')}/>}
  </>;
}
