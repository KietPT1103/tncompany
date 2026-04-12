<?php

declare(strict_types=1);

final class SocialListeningMockFactory
{
    public function makeMonthSeed(string $month, int $count = 24): array
    {
        $baseDate = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $month . '-01 09:00:00');
        if (!$baseDate) {
            throw new InvalidArgumentException('Month must be in YYYY-MM format.');
        }

        $templates = [
            ['text' => 'Cf Ong Quan view dep qua, do uong on ap nha', 'author' => 'linh.cf', 'likes' => 12],
            ['text' => 'Cafe ong quan menu gia sao vay ad', 'author' => 'gia.hoi', 'likes' => 5],
            ['text' => 'Lau ong quan cho lau qua, phuc vu cham nha', 'author' => 'review.lau', 'likes' => 8],
            ['text' => 'Lau ong quan dat ban truoc dc khong?', 'author' => 'ban.toi', 'likes' => 4],
            ['text' => 'Ong Quan Farm co capybara khong, ve vao cong bao nhieu?', 'author' => 'farm.me', 'likes' => 14],
            ['text' => 'Farm ong quan cho thu an vui, alpaca de thuong', 'author' => 'be.na', 'likes' => 9],
            ['text' => 'Ong Quan Farm dong qua, hoi on ao', 'author' => 'khach.le', 'likes' => 3],
            ['text' => 'Ong Quan nay mo cua may gio vay?', 'author' => 'time.ask', 'likes' => 2],
            ['text' => 'Quan ong quan check in dep, se quay lai', 'author' => 'photo.team', 'likes' => 7],
            ['text' => 'Gia ve vao cong farm ong quan dat qua', 'author' => 'ticket.ask', 'likes' => 6],
            ['text' => 'Do an lau ong quan ngon nha', 'author' => 'foodie.88', 'likes' => 11],
            ['text' => 'Khong thay ai tra loi comment dat ban', 'author' => 'complain.now', 'likes' => 10],
        ];

        $items = [];
        for ($index = 0; $index < $count; $index++) {
            $template = $templates[$index % count($templates)];
            $createdAt = $baseDate
                ->modify('+' . ($index % 26) . ' day')
                ->modify('+' . (($index * 3) % 8) . ' hour');

            $items[] = [
                'commentId' => sprintf('seed-%s-%03d', str_replace('-', '', $month), $index + 1),
                'videoId' => 'video-' . str_pad((string) (($index % 6) + 1), 3, '0', STR_PAD_LEFT),
                'authorName' => $template['author'],
                'authorId' => 'author-' . str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT),
                'commentText' => $template['text'],
                'createdAt' => $createdAt->format(DateTimeInterface::ATOM),
                'likeCount' => $template['likes'] + ($index % 5),
                'metadata' => [
                    'source' => 'mock-seed',
                    'batchMonth' => $month,
                    'index' => $index + 1,
                ],
            ];
        }

        return $items;
    }
}
