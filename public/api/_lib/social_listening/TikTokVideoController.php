<?php

declare(strict_types=1);

final class TikTokVideoController
{
    /** @var SocialListeningSearchRepository */
    private $searchRepository;

    /** @var TikTokSearchService */
    private $searchService;

    public function __construct(
        SocialListeningSearchRepository $searchRepository,
        TikTokSearchService $searchService
    ) {
        $this->searchRepository = $searchRepository;
        $this->searchService = $searchService;
    }

    public function index(string $searchId, int $page = 1, int $perPage = 20, string $query = ''): array
    {
        $search = $this->searchService->getSearch($searchId);
        if ($search === null) {
            throw new RuntimeException('Khong tim thay search TikTok.');
        }

        $videos = $this->searchRepository->listVideos($searchId, $page, $perPage, $query);

        return [
            'search' => $search,
            'items' => $videos['items'],
            'pagination' => $videos['pagination'],
        ];
    }
}
