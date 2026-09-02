import { useState } from 'react';
import type { VideoRef } from '../types';

const mmss = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/**
 * Odtwarzacz wchodzi dopiero po kliknięciu. Cztery osadzone ramki YouTube na stronę
 * ściągałyby megabajt skryptów i ustawiały ciasteczka, zanim ktokolwiek nacisnie play,
 * więc do tego czasu stoi tu sama miniatura. Adres `youtube-nocookie.com` odkłada
 * śledzenie do momentu odtworzenia, a link pod spodem działa nawet wtedy, gdy autor
 * zablokuje osadzanie albo film zniknie.
 */
export function VideoEmbed({ video }: { video: VideoRef }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="vid">
      <div className="vid-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button className="vid-play" onClick={() => setPlaying(true)} aria-label={`Odtwórz: ${video.title}`}>
            <img
              src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              width={480}
              height={360}
            />
            <span className="vid-btn" aria-hidden="true">
              ▶
            </span>
            {video.secs > 0 && (
              <span className="vid-len" aria-hidden="true">
                {mmss(video.secs)}
              </span>
            )}
          </button>
        )}
      </div>
      <div className="vid-meta">
        <div className="vid-title">{video.title}</div>
        <div className="vid-sub">
          <span className={`tag${video.lang === 'pl' ? ' pl' : ''}`}>
            {video.lang === 'pl' ? 'PL' : 'EN'}
          </span>
          <span>{video.channel}</span>
          <a href={watchUrl(video.id)} target="_blank" rel="noopener noreferrer">
            otwórz w YouTube
          </a>
        </div>
      </div>
    </div>
  );
}
