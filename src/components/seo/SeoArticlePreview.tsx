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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6efe7_0%,#fffdf9_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[32px] border border-[#eadfce] bg-white/85 p-8 shadow-[0_20px_60px_rgba(66,38,15,0.08)] backdrop-blur">
          <div className="inline-flex rounded-full bg-[#fff3e8] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#9a3412]">
            Bài viết SEO
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-tight md:text-5xl">{title || "Tiêu đề bài viết"}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            {excerpt || "Mô tả ngắn của bài viết sẽ xuất hiện tại đây để người viết xem trước cách hiển thị ở phần mở đầu."}
          </p>

          {coverImageUrl ? (
            <img
              src={coverImageUrl}
              alt={title || "Ảnh cover bài viết"}
              className="mt-8 h-auto max-h-[460px] w-full rounded-[28px] border border-[#eadfce] object-cover"
            />
          ) : null}
        </div>

        <article className="mt-6 rounded-[32px] border border-[#eadfce] bg-white/90 px-6 py-8 shadow-[0_18px_50px_rgba(66,38,15,0.08)] md:px-10">
          <div className="space-y-10">
            {blocks.map((block) => {
              const hasContent =
                block.heading.trim() || block.html.trim() || block.imageUrl.trim();

              if (!hasContent) return null;

              return (
                <section key={block.id} className="space-y-5">
                  {block.heading ? (
                    <h2 className="text-2xl font-semibold leading-tight text-slate-900">
                      {block.heading}
                    </h2>
                  ) : null}

                  {block.html ? (
                    <div
                      className="prose prose-slate max-w-none prose-headings:font-semibold prose-p:leading-8 prose-a:text-emerald-700"
                      dangerouslySetInnerHTML={{ __html: block.html }}
                    />
                  ) : null}

                  {block.imageUrl ? (
                    <figure className="space-y-3">
                      <img
                        src={block.imageUrl}
                        alt={block.imageAlt || block.heading || "Ảnh minh họa"}
                        className="w-full rounded-[24px] border border-[#eadfce] object-cover"
                      />
                      {block.imageAlt ? (
                        <figcaption className="text-sm text-slate-500">{block.imageAlt}</figcaption>
                      ) : null}
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
