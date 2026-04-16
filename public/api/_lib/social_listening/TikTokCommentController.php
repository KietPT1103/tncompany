<?php

declare(strict_types=1);

final class TikTokCommentController
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

    public function index(string $searchId, int $page = 1, int $perPage = 20): array
    {
        $search = $this->searchService->getSearch($searchId);
        if ($search === null) {
            throw new RuntimeException('Không tìm thấy search TikTok.');
        }

        $comments = $this->searchRepository->listComments($searchId, $page, $perPage);

        return [
            'search' => $search,
            'items' => $comments['items'],
            'pagination' => $comments['pagination'],
        ];
    }
}
