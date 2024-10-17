'use client';

import React, { useRef, useEffect, useState } from 'react';
import { initWebGPU } from '../utils/initWebGPU';
import styles from '../../styles/CustomVideoPlayer.module.css';

type Settings = {
    requestFrame: string;
    effect: string;
    deblurCoef: number;
    denoiseCoef: number;
    denoiseCoef2: number;
    compareOn: boolean;
    splitRatio: number;
};

const CustomVideoPlayer: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [videoURL, setVideoURL] = useState<string>('');
    const [localVideo, setLocalVideo] = useState<Blob | null>(null);
    const [settings, setSettings] = useState<Settings>({
        requestFrame: 'requestVideoFrameCallback',
        effect: 'Original',
        deblurCoef: 2,
        denoiseCoef: 0.2,
        denoiseCoef2: 2,
        compareOn: false,
        splitRatio: 50,
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isCancelled = false;
        let cleanupFunction: () => void = () => { };

        async function initializeWebGPU() {
            if (canvasRef.current) {
                try {
                    const destroy = await initWebGPU(canvasRef.current, videoURL, localVideo, settings);
                    if (!isCancelled) {
                        cleanupFunction = destroy;
                    } else {
                        // Если эффект был отменен до завершения инициализации
                        destroy();
                    }
                } catch (err: any) {
                    console.error(err);
                    setError(err.message || 'Ошибка инициализации WebGPU');
                }
            }
        }

        initializeWebGPU();

        return () => {
            isCancelled = true;
            cleanupFunction();
        };
    }, [videoURL, localVideo, settings]);

    const handleURLSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const url = (e.currentTarget.elements.namedItem('video-url') as HTMLInputElement).value;
        setVideoURL(url);
        setLocalVideo(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLocalVideo(file);
            setVideoURL('');
        }
    };

    const handleEffectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSettings((prev) => ({
            ...prev,
            effect: e.target.value,
        }));
    };

    const handleCompareToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings((prev) => ({
            ...prev,
            compareOn: e.target.checked,
        }));
    };

    const handleSplitRatioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSettings((prev) => ({
            ...prev,
            splitRatio: parseFloat(e.target.value),
        }));
    };

    return (
        <div className={styles.container}>
            <h1>Кастомный Аниме Видеоплеер</h1>

            {/* Отображение ошибок */}
            {error && <div className={styles.error}>{error}</div>}

            {/* Форма для ввода URL */}
            <div className={styles.formGroup}>
                <form onSubmit={handleURLSubmit}>
                    <label htmlFor="video-url">Вставьте URL видео:</label>
                    <input
                        type="url"
                        id="video-url"
                        name="video-url"
                        className={styles.input}
                        placeholder="https://example.com/video.mp4"
                        required
                    />
                    <button type="submit" className={styles.button}>
                        Загрузить через URL
                    </button>
                </form>
            </div>

            {/* Выбор локального файла */}
            <div className={styles.formGroup}>
                <label htmlFor="video-file">Выберите видео с ПК:</label>
                <input
                    type="file"
                    id="video-file"
                    name="video-file"
                    accept="video/*"
                    className={styles.input}
                    onChange={handleFileChange}
                />
            </div>

            {/* Настройки плеера */}
            <div className={styles.formGroup}>
                <label htmlFor="effect">Эффект:</label>
                <select id="effect" value={settings.effect} onChange={handleEffectChange} className={styles.input}>
                    <option value="Original">Original</option>
                    <option value="Deblur-DoG">Deblur-DoG</option>
                    <option value="Denoise-BilateralMean">Denoise-BilateralMean</option>
                    <option value="Upscale-CNNx2M">Upscale-CNNx2M</option>
                    <option value="Upscale-CNNx2UL">Upscale-CNNx2UL</option>
                    <option value="Restore-CNNM">Restore-CNNM</option>
                    <option value="Restore-CNNL">Restore-CNNL</option>
                    <option value="Mode A">Mode A</option>
                    <option value="Mode B">Mode B</option>
                    <option value="Mode C">Mode C</option>
                    <option value="Mode A+A">Mode A+A</option>
                    <option value="Mode B+B">Mode B+B</option>
                    <option value="Mode C+A">Mode C+A</option>
                </select>
            </div>

            <div className={styles.formGroup}>
                <label htmlFor="compareOn">Сравнение:</label>
                <input
                    type="checkbox"
                    id="compareOn"
                    checked={settings.compareOn}
                    onChange={handleCompareToggle}
                    className={styles.checkbox}
                />
            </div>

            {settings.compareOn && (
                <div className={styles.formGroup}>
                    <label htmlFor="splitRatio">Линия разделения (%): {settings.splitRatio}</label>
                    <input
                        type="range"
                        id="splitRatio"
                        min="0"
                        max="100"
                        step="0.1"
                        value={settings.splitRatio}
                        onChange={handleSplitRatioChange}
                        className={styles.slider}
                    />
                </div>
            )}

            {/* Канвас для рендеринга видео */}
            <canvas ref={canvasRef} className={styles.canvas}></canvas>
        </div>
    );
};

export default CustomVideoPlayer;
