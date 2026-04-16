<?php

declare(strict_types=1);

interface TikTokCollectorInterface
{
    public function providerName(): string;

    /**
     * @return array<int, array<string, mixed>>
     */
    public function searchVideos(string $keyword, string $dateFrom, string $dateTo): array;

    /**
     * @param array<string, mixed> $video
     * @return array<int, array<string, mixed>>
     */
    public function fetchComments(array $video, string $keyword, string $dateFrom, string $dateTo): array;
}
