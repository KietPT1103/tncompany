"use client";

import { SeoArticleBlock } from "@/services/seoArticleService";

type SeoArticlePreviewProps = {
  title: string;
  excerpt: string;
  coverImageUrl: string;
  blocks: SeoArticleBlock[];
};

export default function SeoArticlePreview({
  title,
  excerpt,
  coverImageUrl,
  blocks,
}: SeoArticlePreviewProps) {
  return (
    <div className="min-h-screen bg-[#fffdfa] px-4 py-8 text-slate-900 md:px-8">
      <style>{`
        .seo-preview-content {
          color: #0f172a;
          font-size: 1.15rem;
          line-height: 1.95;
        }
        .seo-preview-content > section {
          margin: 0 0 3rem;
        }
        .seo-preview-content h2 {
          margin: 0 0 1.25rem;
          color: #1428f0;
          font-size: clamp(2rem, 4vw, 2.75rem);
          line-height: 1.1;
          font-weight: 800;
        }
        .seo-preview-content h3 {
          margin: 0 0 1rem;
          color: #1428f0;
          font-size: 1.75rem;
          line-height: 1.2;
          font-weight: 800;
        }
        .seo-preview-content p,
        .seo-preview-content ul,
        .seo-preview-content ol,
        .seo-preview-content blockquote {
          margin: 0 0 1.25rem;
        }
        .seo-preview-content ul,
        .seo-preview-content ol {
          padding-left: 1.5rem;
          list-style-position: outside;
        }
        .seo-preview-content ul {
          list-style-type: disc;
        }
        .seo-preview-content ol {
          list-style-type: decimal;
        }
        .seo-preview-content li {
          margin-bottom: 0.5rem;
        }
        .seo-preview-content a {
          color: #2563eb;
          text-decoration: underline;
        }
        .seo-preview-content blockquote {
          border-left: 4px solid #2563eb;
          padding-left: 1rem;
          color: #334155;
          font-style: italic;
        }
        .seo-preview-content figure {
          margin: 2rem 0 0;
        }
        .seo-preview-content img {
          display: block;
          width: 100%;
          border-radius: 28px;
          object-fit: cover;
        }
        .seo-preview-content figcaption {
          margin-top: 0.9rem;
          font-size: 0.95rem;
          color: #64748b;
        }
      `}</style>

      <div className="mx-auto max-w-5xl">
        <div className="mb-8 border-b border-slate-200 pb-5 text-sm text-slate-500">
          <div>
            <div className="font-semibold text-slate-900">Bản xem trước bài viết</div>
            <div>Hiển thị gần giống trang public.</div>
          </div>
        </div>

        <article className="mx-auto max-w-4xl">
          <header className="pb-10">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-[#1428f0]">
              Bài viết SEO
            </div>
            <h1 className="mt-5 text-[clamp(2.7rem,5vw,4.6rem)] font-extrabold leading-[1.02] tracking-tight text-slate-950">
              {title || "Tiêu đề bài viết"}
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-600">
              {excerpt ||
                "Mô tả ngắn của bài viết sẽ hiển thị ở đây để người viết xem trước phần mở đầu và đoạn giới thiệu chính."}
            </p>
          </header>

          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={title || "Ảnh cover bài viết"}
              className="mb-12 w-full rounded-[32px] object-cover shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
            />
          ) : null}

          <div className="seo-preview-content">
            {blocks.map((block) => {
              const hasContent =
                block.heading.trim() || block.html.trim() || block.imageUrl.trim();

              if (!hasContent) return null;

              return (
                <section key={block.id}>
                  {block.heading ? <h2>{block.heading}</h2> : null}

                  {block.html ? (
                    <div dangerouslySetInnerHTML={{ __html: block.html }} />
                  ) : null}

                  {block.imageUrl ? (
                    <figure>
                      <img
                        src={block.imageUrl}
                        alt={block.imageAlt || block.heading || "Ảnh minh họa"}
                      />
                      {block.imageAlt ? <figcaption>{block.imageAlt}</figcaption> : null}
                    </figure>
                  ) : null}
                </section>
              );
            })}
          </div>
        </article>
      </div>
    </div>
  );
}
