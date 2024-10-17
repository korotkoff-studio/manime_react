'use client';

import React, { useState } from 'react';
import ReactPlayer from 'react-player';
import styles from '../../styles/VideoPlayer.module.css';

const VideoPlayer: React.FC = () => {
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [localVideo, setLocalVideo] = useState<string>('');

    // Обработчик изменения URL
    const handleURLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVideoUrl(e.target.value);
    };

    // Обработчик отправки формы URL
    const handleURLSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (ReactPlayer.canPlay(videoUrl)) {
            setLocalVideo('');
        } else {
            alert('Неподдерживаемый формат видео или неверный URL.');
        }
    };

    // Обработчик выбора локального файла
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            if (ReactPlayer.canPlay(url)) {
                setLocalVideo(url);
                setVideoUrl('');
            } else {
                alert('Неподдерживаемый формат видео.');
            }
        }
    };

    return (
        <div className={styles.container}>
            <h1>Аниме Видеоплеер</h1>

            {/* Форма для ввода URL */}
            <div className={styles.formGroup}>
                <form onSubmit={handleURLSubmit}>
                    <label htmlFor="video-url">Вставьте URL видео:</label>
                    <input
                        type="url"
                        id="video-url"
                        value={videoUrl}
                        onChange={handleURLChange}
                        placeholder="https://example.com/video.mp4"
                        required
                    />
                    <button type="submit">Загрузить через URL</button>
                </form>
            </div>

            {/* Выбор локального файла */}
            <div className={styles.formGroup}>
                <label htmlFor="video-file">Выберите видео с ПК:</label>
                <input
                    type="file"
                    id="video-file"
                    accept="video/*"
                    onChange={handleFileChange}
                />
            </div>

            {/* Видеоплеер */}
            <div className={styles.playerWrapper}>
                {videoUrl && (
                    <ReactPlayer
                        url={videoUrl}
                        controls
                        width="100%"
                        height="100%"
                    />
                )}
                {localVideo && (
                    <ReactPlayer
                        url={localVideo}
                        controls
                        width="100%"
                        height="100%"
                    />
                )}
            </div>
        </div>
    );
};

export default VideoPlayer;
