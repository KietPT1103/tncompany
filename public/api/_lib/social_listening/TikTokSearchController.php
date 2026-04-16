<?php

declare(strict_types=1);

final class TikTokSearchController
{
    /** @var TikTokSearchService */
    private $searchService;

    public function __construct(TikTokSearchService $searchService)
    {
        $this->searchService = $searchService;
    }

    public function store(array $body, ?string $requestedBy = null): array
    {
        return [
            'search' => $this->searchService->createSearch($body, $requestedBy),
        ];
    }

    public function show(string $searchId): array
    {
        $search = $this->searchService->getSearch($searchId);
        if ($search === null) {
            throw new RuntimeException('Không tìm thấy search TikTok.');
        }

        return [
            'search' => $search,
        ];
    }
}
