<?php

declare(strict_types=1);

final class SocialListeningTextNormalizer
{
    public function normalize(string $text): array
    {
        $lowered = $this->toLower($text);
        $ascii = $this->stripVietnameseAccents($lowered);
        $ascii = str_replace(['đ', 'Đ'], 'd', $ascii);

        foreach (SocialListeningConfig::typoMap() as $from => $to) {
            $pattern = '/(?<![a-z0-9])' . preg_quote($from, '/') . '(?![a-z0-9])/';
            $ascii = preg_replace($pattern, $to, $ascii) ?? $ascii;
        }

        $ascii = preg_replace('/[^a-z0-9\s]/', ' ', $ascii) ?? $ascii;
        $ascii = preg_replace('/\s+/', ' ', trim($ascii)) ?? trim($ascii);

        return [
            'original' => $text,
            'normalized' => $ascii,
            'tokens' => $ascii === '' ? [] : explode(' ', $ascii),
        ];
    }

    private function toLower(string $text): string
    {
        return function_exists('mb_strtolower')
            ? mb_strtolower($text, 'UTF-8')
            : strtolower($text);
    }

    private function stripVietnameseAccents(string $text): string
    {
        return strtr($text, [
            'á' => 'a', 'à' => 'a', 'ả' => 'a', 'ã' => 'a', 'ạ' => 'a',
            'ă' => 'a', 'ắ' => 'a', 'ằ' => 'a', 'ẳ' => 'a', 'ẵ' => 'a', 'ặ' => 'a',
            'â' => 'a', 'ấ' => 'a', 'ầ' => 'a', 'ẩ' => 'a', 'ẫ' => 'a', 'ậ' => 'a',
            'é' => 'e', 'è' => 'e', 'ẻ' => 'e', 'ẽ' => 'e', 'ẹ' => 'e',
            'ê' => 'e', 'ế' => 'e', 'ề' => 'e', 'ể' => 'e', 'ễ' => 'e', 'ệ' => 'e',
            'í' => 'i', 'ì' => 'i', 'ỉ' => 'i', 'ĩ' => 'i', 'ị' => 'i',
            'ó' => 'o', 'ò' => 'o', 'ỏ' => 'o', 'õ' => 'o', 'ọ' => 'o',
            'ô' => 'o', 'ố' => 'o', 'ồ' => 'o', 'ổ' => 'o', 'ỗ' => 'o', 'ộ' => 'o',
            'ơ' => 'o', 'ớ' => 'o', 'ờ' => 'o', 'ở' => 'o', 'ỡ' => 'o', 'ợ' => 'o',
            'ú' => 'u', 'ù' => 'u', 'ủ' => 'u', 'ũ' => 'u', 'ụ' => 'u',
            'ư' => 'u', 'ứ' => 'u', 'ừ' => 'u', 'ử' => 'u', 'ữ' => 'u', 'ự' => 'u',
            'ý' => 'y', 'ỳ' => 'y', 'ỷ' => 'y', 'ỹ' => 'y', 'ỵ' => 'y',
        ]);
    }
}
