<?php

declare(strict_types=1);

final class SocialListeningMockFactory
{
    public function makeMonthSeed(string $month, int $count = 24): array
    {
        throw new RuntimeException('TikTok mock seeding has been disabled. Use a real TikTok provider instead.');
    }
}
