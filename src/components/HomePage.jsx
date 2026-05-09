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
    description: "Góc bán hoa phủ khắp khung gỗ, tạo cảm giác như bước vào một khu vườn nhỏ.",
  },
  {
    image: decorThumbTwo,
    title: "Miền Viễn Tây",
    description: "Mảng decor cưỡi ngựa, boots và gam màu đất tạo vibe ảnh thời trang mạnh hơn.",
  },
  {
    image: decorThumbThree,
    title: "Thác nước cổ tích",
    description: "Lối đi xanh và mảng hoa rực giúp ảnh chụp luôn có chiều sâu mềm mại.",
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
    description: "Một góc chụp cưới nhẹ nhàng với hoa, sương mờ và ánh sáng dịu như một studio ngoài trời.",
  },
  {
    image: storyCardTwoImage,
    title: "Ông Quan Farm – một nơi để “đổi gió” nhẹ nhàng",
    description: "Không gian xanh mát, thoáng đãng với nhiều loài thú như capybara, alpaca, ngựa, dê, cừu… Có thể lại gần, cho ăn, chụp ảnh và trải nghiệm cưỡi ngựa ngay tại farm.",
  },
  {
    image: storyCardThreeImage,
    title: "Combo hẹn hò lãng mạn với mức giá nhẹ cho các cặp đôi",
    description: "Không chỉ được setup decor miễn phí thật chỉn chu và tinh tế, bạn còn có thể tận hưởng view đẹp cùng những món ăn ngon đậm đà, mang đến một buổi hẹn vừa ấm cúng vừa đáng nhớ.",
  },
];

const socialChannels = [
  {
    title: "Tiệm cà phê",
    items: [
      { icon: facebookLogo, text: "Tiệm cà phê Ông Quan", iconClassName: "is-facebook" },
      { icon: tiktokLogo, text: "@ongquan_251223" },
    ],
  },
  {
    title: "Tiệm lẩu",
    items: [
      { icon: facebookLogo, text: "Tiệm lẩu Ông Quan", iconClassName: "is-facebook" },
      { icon: tiktokLogo, text: "@tiem.lau.ong.quan" },
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
      <div className="homepage-banner-copy">
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
      <section className="homepage-hero">
        <img
          className="homepage-hero-image"
          src={heroImage}
          alt="Thức uống nổi bật của Tiệm cà phê Ông Quan"
        />
        <div className="homepage-hero-overlay">
          <p className="homepage-hero-tag">Tiệm cà phê</p>
          <h1 className="homepage-hero-title">Ông Quan</h1>
        </div>
      </section>

      <div className="homepage-main">
        <section className="homepage-intro">
          <div className="homepage-intro-media">
            <img src={brandDrinkImage} alt="Thức uống chủ đạo của Tiệm cà phê Ông Quan" />
          </div>
          <div className="homepage-intro-copy">
            <p className="homepage-label">CÂU CHUYỆN THƯƠNG HIỆU</p>
            <h2>Không gian chính của hệ sinh thái Ông Quan</h2>
            <p>
              Tiệm cà phê Ông Quan là nơi mở đầu cho trải nghiệm Hội An, nhà bên suối, nhà gia tiên
              và nhiều khu mới đang chờ đón. Không gian được dựng để vừa chill, vừa đủ đẹp cho những
              buổi hẹn và các bộ ảnh cá nhân.
            </p>
          </div>
          <div className="homepage-intro-ornament" aria-hidden="true">
            <span />
            <span />
          </div>
        </section>

        <section className="homepage-style-grid">
          <article className="homepage-style-card homepage-style-card-highlight">
            <div className="homepage-style-media">
              <img src={styleImageOne} alt="Góc check-in cưỡi ngựa tại Ông Quan" loading="lazy" />
            </div>
            <div className="homepage-style-note">
              Tiệm Cà Phê Ông Quan có vô vàn góc check-in xinh xắn, được chăm chút để phù hợp với
              nhiều phong cách khác nhau, từ nhẹ nhàng, trong trẻo đến cá tính hay sang xịn.
            </div>
          </article>

          <article className="homepage-style-card">
            <div className="homepage-style-media">
              <img src={styleImageTwo} alt="Concept trang phục cổ điển tại Ông Quan" loading="lazy" />
            </div>
            <div className="homepage-style-note">
              Dù bạn thích vibe Đà Lạt lãng mạn, nét mộc mạc Bắc - Trung - Nam, hay không gian cổ tích
              mở mang, nơi đây đều có thể mang đến cho bạn những khung hình thật đẹp và đầy cảm xúc.
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
              <img src={decorImage} alt="Một góc decor ngập hoa tại Ông Quan" loading="lazy" />
            </div>

            <div className="homepage-decor-copy">
              <p>
                Ông Quan sở hữu nhiều góc sống ảo check-in cực xinh, mỗi góc đều được chăm chút để
                bạn dễ dàng có những bức ảnh thật ăn ý và trong trẻo.
              </p>
              <p>
                Dù là chụp nhẹ nhàng, cá tính hay ngọt ngào, nơi đây đều có background phù hợp để bạn
                thoải mái tạo dáng và lưu lại những khoảnh khắc đẹp.
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

        <section className="homepage-drinks">
          <h2>CÁC THỨC UỐNG NỔI BẬT TẠI ÔNG QUAN</h2>

          <div className="homepage-drink-grid">
            {featuredDrinks.map((item) => (
              <article className="homepage-drink-card" key={item.name}>
                <img src={item.image} alt={item.name} loading="lazy" />
                <p>{item.name}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="homepage-story">
          <h2>CÂU CHUYỆN ÔNG QUAN</h2>

          <div className="homepage-story-hero">
            <img src={storyHeroImage} alt="Không gian concept chụp ảnh tại Ông Quan" loading="lazy" />
          </div>

          <div className="homepage-story-lead">
            <h3>DUY NHẤT TẠI CẦN THƠ</h3>
            <p>
              Tiệm cà phê Ông Quan nổi lên với nhiều câu chuyện đi kèm từng khu decor, concept chụp ảnh
              và trải nghiệm nhỏ. Từ góc hoa, khu cổ tích đến vibe nhà gỗ, từng mảng một đều được giữ
              tinh thần riêng để khách ghé vào là có cảm giác đang ở trong một nơi khác.
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

        <section className="homepage-social">
          <SectionBanner title="LIÊN LẠC VỚI TIỆM QUA" subtitle="Các kênh truyền thông" />

          <div className="homepage-social-grid">
            {socialChannels.map((channel) => (
              <article className="homepage-social-card" key={channel.title}>
                <h3>{channel.title}</h3>
                <div className="homepage-social-list">
                  {channel.items.map((item) => (
                    <div className="homepage-social-item" key={item.text}>
                      <img className={item.iconClassName} src={item.icon} alt="" aria-hidden="true" />
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="homepage-footer">
        <div className="homepage-footer-inner">
          <div className="homepage-footer-brand">
            <div className="homepage-footer-logo-shell">
              <img src={brandLogo} alt="Tiệm cà phê Ông Quan" />
            </div>
            <div>
              <h2>Tiệm cà phê Ông Quan</h2>
            </div>
          </div>

          <div className="homepage-footer-column">
            <p className="homepage-footer-heading">VỀ CHÚNG TÔI</p>
            <div className="homepage-footer-links">
              {footerLinks.map((item) => (
                <a
                  key={item.id}
                  href={pagesById[item.id].hash}
                  onClick={(event) => openInternalPage(onOpenPage, item.id, event)}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <div className="homepage-footer-column">
            <p className="homepage-footer-heading">ĐỊA CHỈ</p>
            <p>{company.headquarters}</p>
            <p>Giấy chứng nhận Đăng ký kinh doanh số {company.enterpriseCode} cấp ngày {company.foundedDate}</p>
            <p className="homepage-footer-subheading">ĐIỆN THOẠI HỖ TRỢ KHÁCH HÀNG:</p>
            <p>› {cafeVenue.contact}</p>
          </div>

          <div className="homepage-footer-column">
            <p className="homepage-footer-heading">NHẬN THÔNG TIN TỪ ÔNG QUAN</p>
            <div className="homepage-footer-socials" aria-label="Mạng xã hội Ông Quan">
              <a href="/" aria-label="Facebook Ông Quan">
                <img src={facebookLogoWhite} alt="" aria-hidden="true" />
              </a>
              <a href="/" aria-label="TikTok Ông Quan">
                <img src={tiktokLogoWhite} alt="" aria-hidden="true" />
              </a>
            </div>
            <p>
              Xin vui lòng để lại địa chỉ email, chúng tôi sẽ cập nhật những tin tức mới nhất của Ông
              Quan
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
