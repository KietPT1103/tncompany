import heroImage from "../public/images/cf/nav_img.png";
import brandDrinkImage from "../public/images/cf/cf_product_1.png";
import styleImageOne from "../public/images/cf/cf_model_1.png";
import styleImageTwo from "../public/images/cf/cf_model_2.png";
import decorImage from "../public/images/cf/cf_view13.png";
import decorThumbOne from "../public/images/cf/cf_view14.png";
import decorThumbTwo from "../public/images/cf/cf_view15.png";
import decorThumbThree from "../public/images/cf/cf_view16.png";
import storyHeroImage from "../public/images/cf/cf_story.png";
import storyCardOneImage from "../public/images/cf/cf_view17.png";
import storyCardTwoImage from "../public/images/cf/cf_view18.png";
import storyCardThreeImage from "../public/images/cf/cf_view19.png";
import productOneImage from "../public/images/cf/cf_product_2.png";
import productTwoImage from "../public/images/cf/cf_product_3.png";
import productThreeImage from "../public/images/cf/cf_product_4.png";
import productFourImage from "../public/images/cf/cf_product_5.png";
import productFiveImage from "../public/images/cf/cf_product_6.png";
import productSixImage from "../public/images/cf/cf_product_7.png";
import brandLogo from "../public/images/cf/logo_cf_nav.png";
import facebookLogo from "../public/images/cf/fb_logo.png";
import facebookLogoWhite from "../public/images/cf/fb_logo_white.png";
import tiktokLogo from "../public/images/cf/fb_tiktok.png";
import tiktokLogoWhite from "../public/images/cf/fb_tiktok_white.png";
import { company, pagesById, venuesById } from "../data/siteData";

const decorHighlights = [
  {
    image: decorThumbOne,
    title: "Ngôi nhà hoa hồng",
    description:
      "Góc bán hoa phủ khắp khung gỗ, tạo cảm giác như bước vào một khu vườn nhỏ.",
  },
  {
    image: decorThumbTwo,
    title: "Miền Viễn Tây",
    description:
      "Mảng decor cưỡi ngựa, boots và gam màu đất tạo vibe ảnh thời trang mạnh hơn.",
  },
  {
    image: decorThumbThree,
    title: "Thác nước cổ tích",
    description:
      "Lối đi xanh và mảng hoa rực giúp ảnh chụp luôn có chiều sâu mềm mại.",
  },
];

const featuredDrinks = [
  { image: productOneImage, name: "Trà sunset hồng" },
  { image: productTwoImage, name: "Trà chanh dây chôm chôm" },
  { image: productThreeImage, name: "Trà dâu chùm" },
  { image: productFourImage, name: "Trà cúc lá" },
  { image: productFiveImage, name: "Matcha dâu dừa" },
  { image: productSixImage, name: "Trà bí mật lá" },
];

const storyCards = [
  {
    image: storyCardOneImage,
    title: "Slay giữa vườn hoa Ông Quan",
    description:
      "Một góc chụp cưới nhẹ nhàng với hoa, sương mờ và ánh sáng dịu như một studio ngoài trời.",
  },
  {
    image: storyCardTwoImage,
    title: "Ông Quan Farm – một nơi để “đổi gió” nhẹ nhàng",
    description:
      "Không gian xanh mát, thoáng đãng với nhiều loài thú như capybara, alpaca, ngựa, dê, cừu… Có thể lại gần, cho ăn, chụp ảnh và trải nghiệm cưỡi ngựa ngay tại farm.",
  },
  {
    image: storyCardThreeImage,
    title: "Combo hẹn hò lãng mạn với mức giá nhẹ cho các cặp đôi",
    description:
      "Không chỉ được setup decor miễn phí thật chỉn chu và tinh tế, bạn còn có thể tận hưởng view đẹp cùng những món ăn ngon đậm đà, mang đến một buổi hẹn vừa ấm cúng vừa đáng nhớ.",
  },
];

const socialChannels = [
  {
    title: "Tiệm cà phê",
    items: [
      {
        icon: facebookLogo,
        text: "Tiệm cà phê Ông Quan",
        href: "https://www.facebook.com/tiemcafeongquan/?locale=vi_VN",
        iconClassName: "is-facebook",
      },
      {
        icon: tiktokLogo,
        text: "@ongquan_251223",
        href: "https://www.tiktok.com/@ongquan_251223",
      },
    ],
  },
  {
    title: "Tiệm lẩu",
    items: [
      {
        icon: facebookLogo,
        text: "Tiệm lẩu Ông Quan",
        href: "https://www.facebook.com/p/Ti%E1%BB%87m-L%E1%BA%A9u-%C3%94ng-Quan-61583250449054/?locale=vi_VN",
        iconClassName: "is-facebook",
      },
      {
        icon: tiktokLogo,
        text: "@tiem.lau.ong.quan",
      },
    ],
  },
];

const footerLinks = [
  { id: "cafe", label: "Cửa hàng" },
  { id: "about", label: "Về Ông Quan" },
  { id: "farm", label: "Hệ thống cửa hàng" },
];

function SectionBanner({ title, subtitle }) {
  return (
    <div className="homepage-banner">
      <span className="homepage-banner-line" aria-hidden="true" />
      <div className="homepage-banner-copy font-sans">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <span className="homepage-banner-line" aria-hidden="true" />
    </div>
  );
}

function openInternalPage(onOpenPage, pageId, event) {
  if (!onOpenPage) {
    return;
  }

  event.preventDefault();
  onOpenPage(pageId);
}

export default function HomePage({ onOpenPage }) {
  const cafeVenue = venuesById.cafe;

  return (
    <div className="homepage-shell">
      <section className="relative h-[190px] w-full overflow-hidden sm:h-auto sm:aspect-[1790/769]">
        <img
          className="absolute inset-0 h-full w-full object-cover object-[50%_center] sm:object-center"
          src={heroImage}
          alt="Thức uống nổi bật của Tiệm cà phê Ông Quan"
        />

        <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-black/20 via-transparent to-black/10" />

        <div className="absolute inset-0 z-10 mx-auto w-full max-w-[1380px] px-4 sm:px-6 lg:px-10">
          <p className="absolute left-5 top-10 m-0 whitespace-nowrap font-hurricane text-5xl font-normal leading-[0.9] text-[#fff8f0] [text-shadow:0_4px_12px_rgba(31,17,7,0.45)] sm:left-[clamp(1rem,4vw,3rem)] sm:top-[clamp(5rem,15vw,10rem)] sm:text-[clamp(2.2rem,4.4vw,4.4rem)] lg:left-40 lg:top-30 lg:text-[clamp(7rem,6vw,7rem)] lg:[text-shadow:0_8px_24px_rgba(31,17,7,0.45)]">
            Tiệm cà phê
          </p>

          <h1 className="absolute bottom-5 right-5 m-0 whitespace-nowrap font-hurricane text-6xl font-normal leading-[0.82] text-[#fff8f0] [text-shadow:0_6px_18px_rgba(31,17,7,0.5)] sm:bottom-[clamp(2rem,8vw,4.5rem)] sm:right-[clamp(0.5rem,8vw,5rem)] sm:text-[clamp(4rem,9vw,8rem)] sm:leading-[0.9] lg:bottom-40 lg:right-20 lg:text-[clamp(11rem,10vw,12rem)] lg:leading-[0.82] lg:[text-shadow:0_10px_30px_rgba(31,17,7,0.55)]">
            Ông Quan
          </h1>
        </div>
      </section>

      <div className="homepage-main">
        <section className="homepage-intro">
          <div className="homepage-intro-media">
            <img
              src={brandDrinkImage}
              alt="Thức uống chủ đạo của Tiệm cà phê Ông Quan"
            />
          </div>
          <div className="homepage-intro-copy">
            <p className="homepage-label">CÂU CHUYỆN THƯƠNG HIỆU</p>
            <h2>Không gian chính của hệ sinh thái Ông Quan</h2>
            <p>
              Tiệm cà phê Ông Quan là nơi mở đầu cho trải nghiệm Hội An, nhà bên
              suối, nhà gia tiên và nhiều khu mới đang chờ đón. Không gian được
              dựng để vừa chill, vừa đủ đẹp cho những buổi hẹn và các bộ ảnh cá
              nhân.
            </p>
          </div>
          <div className="homepage-intro-ornament" aria-hidden="true">
            <span />
            <span />
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-[1040px] grid-cols-1 items-stretch gap-[clamp(2rem,4vw,3.6rem)] md:grid-cols-2">
          <article className="homepage-style-card-highlight relative grid h-full grid-rows-[auto_1fr] justify-items-center">
            <div className="homepage-style-media">
              <img
                src={styleImageOne}
                alt="Góc check-in cưỡi ngựa tại Ông Quan"
                loading="lazy"
              />
            </div>

            <div className="font-nunito -mt-[2.35rem] flex h-full min-h-[170px] w-full max-w-[452px] items-start rounded-[18px] bg-[#dec3ac] px-[1.2rem] pb-4 pt-16 text-lg font-semibold leading-[1.15] tracking-[-0.01em] text-[#383533]">
              Tiệm Cà Phê Ông Quan có vô vàn góc check-in xinh xắn, được chăm
              chút để phù hợp với nhiều phong cách khác nhau, từ nhẹ nhàng,
              trong trẻo đến cá tính hay sang xịn.
            </div>
          </article>

          <article className="relative grid h-full grid-rows-[auto_1fr] justify-items-center">
            <div className="homepage-style-media">
              <img
                src={styleImageTwo}
                alt="Concept trang phục cổ điển tại Ông Quan"
                loading="lazy"
              />
            </div>

            <div className="font-nunito -mt-[2.35rem] flex h-full min-h-[170px] w-full max-w-[452px] items-start rounded-[18px] bg-[#dec3ac] px-[1.2rem] pb-4 pt-16 text-lg font-semibold leading-[1.15] tracking-[-0.01em] text-[#383533]">
              Dù bạn thích vibe Đà Lạt lãng mạn, nét mộc mạc Bắc - Trung - Nam,
              hay không gian cổ tích mở mang, nơi đây đều có thể mang đến cho
              bạn những khung hình thật đẹp và đầy cảm xúc.
            </div>
          </article>
        </section>

        <section className="homepage-decor">
          <SectionBanner
            title="THỎA SỨC CHECK-IN TẠI ÔNG QUAN"
            subtitle="Tiệm decor góc mới liên tục"
          />

          <div className="homepage-decor-grid">
            <div className="homepage-decor-media">
              <img
                src={decorImage}
                alt="Một góc decor ngập hoa tại Ông Quan"
                loading="lazy"
              />
            </div>

            <div className="homepage-decor-copy">
              <p>
                Ông Quan sở hữu nhiều góc sống ảo check-in cực xinh, mỗi góc đều
                được chăm chút để bạn dễ dàng có những bức ảnh thật ăn ý và
                trong trẻo.
              </p>
              <p>
                Dù là chụp nhẹ nhàng, cá tính hay ngọt ngào, nơi đây đều có
                background phù hợp để bạn thoải mái tạo dáng và lưu lại những
                khoảnh khắc đẹp.
              </p>

              <div className="homepage-decor-highlights">
                {decorHighlights.map((item) => (
                  <article className="homepage-decor-pill" key={item.title}>
                    <img src={item.image} alt={item.title} loading="lazy" />
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1040px]">
          <h2 className="m-0 text-center font-['Bricolage_Grotesque','Be_Vietnam_Pro',sans-serif] text-[clamp(1.35rem,2.2vw,1.7rem)] tracking-[0.04em] text-[#4e3425]">
            CÁC THỨC UỐNG NỔI BẬT TẠI ÔNG QUAN
          </h2>

          <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredDrinks.map((item) => (
              <article
                className="group cursor-pointer overflow-hidden rounded bg-white shadow-[0_18px_40px_rgba(63,40,22,0.10)] transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_24px_50px_rgba(63,40,22,0.18)]"
                key={item.name}
              >
                <div className="overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    loading="lazy"
                    className="aspect-square w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                </div>

                <p className="m-0 px-4 py-4 text-center text-[0.95rem] font-semibold text-[#655040] transition-colors duration-300 group-hover:text-[#9b6a33]">
                  {item.name}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="homepage-story font-['Bricolage_Grotesque','Be_Vietnam_Pro',sans-serif]">
          <h2>CÂU CHUYỆN ÔNG QUAN</h2>

          <div className="homepage-story-hero">
            <img
              src={storyHeroImage}
              alt="Không gian concept chụp ảnh tại Ông Quan"
              loading="lazy"
            />
          </div>

          <div className="homepage-story-lead">
            <h3>DUY NHẤT TẠI CẦN THƠ</h3>
            <p>
              Tiệm cà phê Ông Quan nổi lên với nhiều câu chuyện đi kèm từng khu
              decor, concept chụp ảnh và trải nghiệm nhỏ. Từ góc hoa, khu cổ
              tích đến vibe nhà gỗ, từng mảng một đều được giữ tinh thần riêng
              để khách ghé vào là có cảm giác đang ở trong một nơi khác.
            </p>
          </div>

          <div className="homepage-story-grid">
            {storyCards.map((item) => (
              <article className="homepage-story-card" key={item.title}>
                <img src={item.image} alt={item.title} loading="lazy" />
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="w-full py-12 md:py-16">
          <SectionBanner
            title="LIÊN LẠC VỚI CHÚNG TÔI QUA"
            subtitle="Các kênh truyền thông"
          />

          <div className="mx-auto mt-10 grid w-[min(1180px,calc(100%-2rem))] grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
            {socialChannels.map((channel) => (
              <article
                key={channel.title}
                className="rounded-[3px] border-2 border-[#795200] bg-[#fffaf2] p-6 shadow-[6px_7px_0_#4d3505] transition-transform duration-200 hover:-translate-y-1 md:p-8"
              >
                <h3 className="mb-5 text-center text-xl font-bold uppercase tracking-[0.04em] text-[#795200] md:text-2xl">
                  {channel.title}
                </h3>

                <div className="flex flex-col gap-3">
                  {channel.items.map((item) =>
                    item.href ? (
                      <a
                        key={item.text}
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Mở ${item.text}`}
                        className="group flex min-h-16 items-center gap-4 rounded-[3px] border border-[#795200]/30 bg-white px-4 py-3 text-[#4d3505] no-underline transition-all duration-200 hover:-translate-y-0.5 hover:border-[#795200] hover:bg-[#f5ead3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#795200] focus-visible:ring-offset-2"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                          <img
                            className={`object-contain transition-transform duration-200 group-hover:scale-110 ${item.iconClassName ?? "h-10 w-10"}`}
                            src={item.icon}
                            alt=""
                            aria-hidden="true"
                          />
                        </div>

                        <span className="min-w-0 break-words text-base font-semibold md:text-lg">
                          {item.text}
                        </span>
                      </a>
                    ) : (
                      <div
                        key={item.text}
                        className="flex min-h-16 items-center gap-4 rounded-[3px] border border-[#795200]/30 bg-white px-4 py-3 text-[#4d3505]"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                          <img
                            className={`object-contain ${item.iconClassName ?? "h-10 w-10"}`}
                            src={item.icon}
                            alt=""
                            aria-hidden="true"
                          />
                        </div>

                        <span className="min-w-0 break-words text-base font-semibold md:text-lg">
                          {item.text}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="homepage-footer">
        <div className="homepage-footer-inner">
          <a
            href="https://www.facebook.com/tiemcafeongquan/?locale=vi_VN"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Mở Facebook Tiệm cà phê Ông Quan"
            className="homepage-footer-brand group cursor-pointer"
          >
            <div className="homepage-footer-logo-shell">
              <img
                src={brandLogo}
                alt="Tiệm cà phê Ông Quan"
                className="transition-transform duration-200 group-hover:scale-105"
              />
            </div>

            <div>
              <h2 className="transition-colors duration-200 group-hover:text-white/80">
                Tiệm cà phê Ông Quan
              </h2>
            </div>
          </a>

          <div className="homepage-footer-column font-sans">
            <p className="homepage-footer-heading">VỀ CHÚNG TÔI</p>
            <div className="homepage-footer-links">
              {footerLinks.map((item) => (
                <a
                  key={item.id}
                  href={pagesById[item.id].hash}
                  onClick={(event) =>
                    openInternalPage(onOpenPage, item.id, event)
                  }
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div className="homepage-footer-column font-sans">
            <p className="homepage-footer-heading">ĐỊA CHỈ</p>
            <p>{company.headquarters}</p>
            <p>
              Giấy chứng nhận Đăng ký kinh doanh số {company.enterpriseCode} cấp
              ngày {company.foundedDate}
            </p>
            <p className="homepage-footer-subheading">
              ĐIỆN THOẠI HỖ TRỢ KHÁCH HÀNG:
            </p>
            <p>› {cafeVenue.contact}</p>
          </div>

          <div className="homepage-footer-column font-sans">
            <p className="homepage-footer-heading">
              NHẬN THÔNG TIN TỪ ÔNG QUAN
            </p>
            <div
              className="my-5 flex items-center gap-5"
              aria-label="Mạng xã hội Ông Quan"
            >
              <a
                href="https://www.facebook.com/tiemcafeongquan/?locale=vi_VN"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook Tiệm cà phê Ông Quan"
                className="group flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-[transform,filter] duration-200 hover:-translate-y-1 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <img
                  src={facebookLogoWhite}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                />
              </a>

              <a
                href="https://www.tiktok.com/@ongquan_251223"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-[transform,filter] duration-200 hover:-translate-y-1 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <img
                  src={tiktokLogoWhite}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                />
              </a>
            </div>
            <p>
              Xin vui lòng để lại địa chỉ email, chúng tôi sẽ cập nhật những tin
              tức mới nhất của Ông Quan
            </p>
            <div className="homepage-footer-form">
              <input type="email" placeholder="Nhập email của bạn..." />
              <button type="button">Gửi</button>
            </div>
          </div>
        </div>

        <p className="homepage-footer-bottom">©2026 Hệ sinh thái Ông Quan</p>
      </section>
    </div>
  );
}
