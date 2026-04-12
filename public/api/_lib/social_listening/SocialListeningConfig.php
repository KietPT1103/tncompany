<?php

declare(strict_types=1);

final class SocialListeningConfig
{
    public const PLATFORM = 'tiktok';
    public const PROCESSING_VERSION = 'rule-v1';

    public static function brandLabels(): array
    {
        return [
            'cafe_ong_quan' => 'cà phê Ông Quan',
            'lau_ong_quan' => 'lẩu Ông Quan',
            'ong_quan_farm' => 'Ông Quan Farm',
            'general_ong_quan' => 'Ông Quan tổng quát',
            'unknown' => 'Chưa xác định',
        ];
    }

    public static function brandPriority(): array
    {
        return [
            'ong_quan_farm',
            'lau_ong_quan',
            'cafe_ong_quan',
            'general_ong_quan',
            'unknown',
        ];
    }

    public static function generalBrandTerms(): array
    {
        return [
            'ong quan',
            'ongquan',
            'ong quan',
            'chu quan',
            'quan ong quan',
        ];
    }

    public static function typoMap(): array
    {
        return [
            'cf' => 'ca phe',
            'coffee' => 'cafe',
            'cafee' => 'cafe',
            'capibara' => 'capybara',
            'capy' => 'capybara',
            'alpacca' => 'alpaca',
            'alpaka' => 'alpaca',
            'nong trai' => 'nong trai',
            'nong traj' => 'nong trai',
            've vao cong' => 've vao cong',
            'gio mo cua' => 'gio mo cua',
            'ongquan' => 'ong quan',
            'ong quann' => 'ong quan',
            'oq farm' => 'ong quan farm',
        ];
    }

    public static function brandRules(): array
    {
        return [
            'cafe_ong_quan' => [
                'aliases' => [
                    ['term' => 'ca phe ong quan', 'weight' => 7],
                    ['term' => 'cafe ong quan', 'weight' => 7],
                    ['term' => 'quan cafe ong quan', 'weight' => 7],
                    ['term' => 'quan ca phe ong quan', 'weight' => 7],
                    ['term' => 'ong quan cafe', 'weight' => 6],
                    ['term' => 'ong quan ca phe', 'weight' => 6],
                ],
                'context' => [
                    ['term' => 'cafe', 'weight' => 2],
                    ['term' => 'ca phe', 'weight' => 2],
                    ['term' => 'do uong', 'weight' => 2],
                    ['term' => 'nuoc', 'weight' => 1],
                    ['term' => 'quan cafe', 'weight' => 2],
                    ['term' => 'check in cafe', 'weight' => 2],
                ],
            ],
            'lau_ong_quan' => [
                'aliases' => [
                    ['term' => 'lau ong quan', 'weight' => 7],
                    ['term' => 'tiem lau ong quan', 'weight' => 7],
                    ['term' => 'ong quan lau', 'weight' => 6],
                    ['term' => 'quan lau ong quan', 'weight' => 7],
                ],
                'context' => [
                    ['term' => 'lau', 'weight' => 3],
                    ['term' => 'tiem lau', 'weight' => 3],
                    ['term' => 'nuoc lau', 'weight' => 2],
                    ['term' => 'dat ban', 'weight' => 1],
                    ['term' => 'an toi', 'weight' => 1],
                    ['term' => 'set lau', 'weight' => 2],
                ],
            ],
            'ong_quan_farm' => [
                'aliases' => [
                    ['term' => 'ong quan farm', 'weight' => 8],
                    ['term' => 'farm ong quan', 'weight' => 8],
                    ['term' => 'nong trai ong quan', 'weight' => 8],
                ],
                'context' => [
                    ['term' => 'farm', 'weight' => 3],
                    ['term' => 'nong trai', 'weight' => 3],
                    ['term' => 've vao cong', 'weight' => 3],
                    ['term' => 'cho thu an', 'weight' => 3],
                    ['term' => 'capybara', 'weight' => 4],
                    ['term' => 'alpaca', 'weight' => 4],
                    ['term' => 'dong vat', 'weight' => 2],
                    ['term' => 'vuon thu', 'weight' => 2],
                    ['term' => 'check in farm', 'weight' => 2],
                ],
            ],
        ];
    }

    public static function sentimentRules(): array
    {
        return [
            'positive' => [
                ['term' => 'rat thich', 'weight' => 3],
                ['term' => 'yeu thich', 'weight' => 3],
                ['term' => 'ngon', 'weight' => 2],
                ['term' => 'dep', 'weight' => 2],
                ['term' => 'xinh', 'weight' => 2],
                ['term' => 'de thuong', 'weight' => 2],
                ['term' => 'ok', 'weight' => 1],
                ['term' => 'on ap', 'weight' => 1],
                ['term' => 'dang thu', 'weight' => 2],
                ['term' => 'se quay lai', 'weight' => 3],
                ['term' => 'nhan vien de thuong', 'weight' => 3],
                ['term' => 'phuc vu tot', 'weight' => 3],
            ],
            'negative' => [
                ['term' => 'khong ngon', 'weight' => 4],
                ['term' => 'qua dat', 'weight' => 4],
                ['term' => 'dat qua', 'weight' => 4],
                ['term' => 'cho lau', 'weight' => 4],
                ['term' => 'khong ok', 'weight' => 3],
                ['term' => 'that vong', 'weight' => 4],
                ['term' => 'te', 'weight' => 2],
                ['term' => 'do', 'weight' => 2],
                ['term' => 'hoi', 'weight' => 2],
                ['term' => 'bi lua', 'weight' => 4],
                ['term' => 'phuc vu cham', 'weight' => 4],
                ['term' => 'khong ai tra loi', 'weight' => 4],
                ['term' => 'khieu nai', 'weight' => 4],
                ['term' => 'khong quay lai', 'weight' => 5],
            ],
        ];
    }

    public static function topicRules(): array
    {
        return [
            'gia_ca' => [
                'label' => 'Giá cả',
                'terms' => ['gia', 'qua dat', 'dat qua', 'bao nhieu', 've vao cong', 'chi phi', 'combo'],
            ],
            'do_an_thuc_uong' => [
                'label' => 'Đồ ăn / thức uống',
                'terms' => ['mon', 'do an', 'thuc uong', 'nuoc', 'lau', 'ca phe', 'cafe', 'ngon', 'menu'],
            ],
            'khong_gian' => [
                'label' => 'Không gian',
                'terms' => ['khong gian', 'view', 'rong', 'mat', 'dep', 'cho ngoi', 'dong', 'on ao'],
            ],
            'phuc_vu' => [
                'label' => 'Phục vụ',
                'terms' => ['phuc vu', 'nhan vien', 'ho tro', 'tu van', 'cho lau', 'thai do'],
            ],
            'check_in' => [
                'label' => 'Check-in / chụp ảnh',
                'terms' => ['check in', 'chup anh', 'song ao', 'goc chup', 'len hinh'],
            ],
            'dong_vat_farm' => [
                'label' => 'Động vật / trải nghiệm farm',
                'terms' => ['capybara', 'alpaca', 'cho thu an', 'dong vat', 'vuon thu', 'farm'],
            ],
            'dat_ban' => [
                'label' => 'Đặt bàn',
                'terms' => ['dat ban', 'book ban', 'giu cho', 'reservation'],
            ],
            'gio_mo_cua' => [
                'label' => 'Thời gian mở cửa',
                'terms' => ['mo cua', 'dong cua', 'gio mo cua', 'gio nao', 'may gio'],
            ],
            'khuyen_mai' => [
                'label' => 'Khuyến mãi',
                'terms' => ['khuyen mai', 'uu dai', 'giam gia', 'voucher', 'combo'],
            ],
            'khieu_nai' => [
                'label' => 'Phản hồi khiếu nại',
                'terms' => ['khieu nai', 'that vong', 'khong hai long', 'phan nan', 'giai quyet'],
            ],
        ];
    }

    public static function recommendationTemplates(): array
    {
        return [
            'gia_ca' => 'Nhiều bình luận hỏi về giá/vé. Nên làm FAQ hoặc video ghim giải thích giá, combo và quyền lợi đi kèm.',
            'dat_ban' => 'Có nhu cầu đặt bàn lặp lại. Nên chuẩn hóa CTA đặt bàn và ghim hướng dẫn liên hệ/đặt chỗ.',
            'gio_mo_cua' => 'Nhiều người hỏi giờ mở cửa. Nên thêm nội dung cố định về khung giờ hoạt động trong bio/video ghim.',
            'dong_vat_farm' => 'Chủ đề trải nghiệm farm nổi bật. Nên đẩy thêm content hướng dẫn tương tác động vật và lưu ý tham quan.',
            'khuyen_mai' => 'Người xem quan tâm khuyến mãi/combo. Nên có lịch nội dung định kỳ cho ưu đãi và chương trình theo mùa.',
            'khieu_nai' => 'Xuất hiện nhiều tín hiệu khiếu nại. Cần playbook phản hồi công khai và quy trình chuyển xử lý nội bộ.',
        ];
    }

    public static function keywordStopList(): array
    {
        return [
            'ong quan',
            'ong',
            'quan',
            'video',
            'tiktok',
            'farm',
            'cafe',
            'ca phe',
            'lau',
        ];
    }
}
