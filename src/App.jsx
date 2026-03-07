import React, { useEffect, useMemo, useState } from "react";

const company = {
  name: "Công ty TNHH Thương mại Dịch vụ Đầu tư Tổng hợp T-N",
  shortName: "T&N Company",
  enterpriseCode: "1801702806",
  foundedDate: "06/05/2021",
  latestUpdate: "Đăng ký thay đổi lần 2: 14/12/2025",
  capital: "1.000.000.000 đồng",
  headquarters: "Số 267, đường 30/4, phường Ninh Kiều, thành phố Cần Thơ",
  phone: "0337 336 138",
  legalRep: "Lê Đức Trọng",
  fiscalYear: "01/01 - 31/12",
  vatMethod: "Khấu trừ",
  accountingMethod: "Hạch toán độc lập",
};

const companyHighlights = [
  { label: "Mã số doanh nghiệp", value: company.enterpriseCode },
  { label: "Vốn điều lệ", value: company.capital },
  { label: "Ngày đăng ký", value: company.foundedDate },
  { label: "Hồ sơ pháp lý", value: "Đang hoạt động" },
];

const businessAreas = [
  {
    code: "6810 (Chính)",
    name: "Kinh doanh bất động sản, quyền sử dụng đất",
    detail: "Mua bán, cho thuê, quản lý tài sản và thực hiện dịch vụ trung gian liên quan.",
  },
  {
    code: "4101 - 4102",
    name: "Xây dựng nhà ở và công trình không để ở",
    detail: "Thi công công trình dân dụng và hạ tầng theo kế hoạch đầu tư của doanh nghiệp.",
  },
  {
    code: "4321 - 4322",
    name: "Lắp đặt hệ thống kỹ thuật tòa nhà",
    detail: "Điện, cấp thoát nước, điều hòa không khí, camera, chiếu sáng, hệ PCCC.",
  },
  {
    code: "4659",
    name: "Bán buôn máy móc, thiết bị, phụ tùng",
    detail: "Phân phối thiết bị công nghiệp, điện năng lượng mặt trời và thiết bị công trình.",
  },
  {
    code: "4673",
    name: "Bán buôn vật liệu xây dựng",
    detail: "Kinh doanh vật liệu xây dựng, thiết bị lắp đặt và thiết bị vệ sinh công trình.",
  },
  {
    code: "8299",
    name: "Dịch vụ hỗ trợ kinh doanh",
    detail: "Cung cấp các dịch vụ hỗ trợ vận hành, tổ chức và thương mại tổng hợp.",
  },
];

const legalTimeline = [
  {
    title: "Đăng ký doanh nghiệp",
    content: `Đăng ký lần đầu ngày ${company.foundedDate}.`,
  },
  {
    title: "Cập nhật hồ sơ pháp lý",
    content: "Đăng ký thay đổi nội dung doanh nghiệp lần 2 ngày 14/12/2025.",
  },
  {
    title: "Thông tin thuế - kế toán",
    content: `Phương pháp thuế GTGT ${company.vatMethod.toLowerCase()}, hình thức ${company.accountingMethod.toLowerCase()}.`,
  },
  {
    title: "Người đại diện pháp luật",
    content: company.legalRep,
  },
];

const venues = [
  {
    id: "cafe",
    hash: "#/ca-phe-ong-quan",
    navLabel: "Tiệm cà phê Ông Quan",
    shortLabel: "Cà phê",
    tag: "Quán chính",
    name: "Tiệm cà phê Ông Quan",
    headline: "Không gian chính của hệ sinh thái Ông Quan",
    description:
      "Tiệm cà phê Ông Quan có rất nhiều khu trải nghiệm khác nhau. Nổi bật hiện tại là khu Hội An, Nhà bên suối, Nhà gia Tiên và còn nhiều khu mới đang chờ đón khách ghé thăm.",
    address: "267 Đường 30/4, Ninh Kiều, Cần Thơ",
    time: "07:00 - 22:00",
    contact: "077 277 0789",
    stats: [
      { label: "Diện tích phục vụ", value: "1km+" },
      { label: "Món signature", value: "Trà sữa Ông Quan" },
      { label: "Không gian nổi bật", value: "Hội An - Bên suối - Gia Tiên" },
    ],
    zones: [
      {
        title: "Khu Hội An",
        detail: "Khu mang màu sắc đèn lồng ấm, hợp chụp ảnh và ngồi trò chuyện buổi tối.",
      },
      {
        title: "Nhà bên suối",
        detail: "Không gian thư giãn gần mảng xanh và tiếng nước, phù hợp nhóm bạn hoặc gia đình.",
      },
      {
        title: "Nhà gia Tiên",
        detail: "Khu mang cảm giác cổ điển, riêng tư hơn cho gặp gỡ thân mật và tiếp khách.",
      },
    ],
    signature: ["Trà sữa Ông Quan", "Tiệm bánh", "Tiệm lẩu"],
    discoveryTitle: "Nhiều khu khác đang chờ đón",
    discoveryItems: [
      "Ngoài 3 khu nổi bật, quán còn nhiều không gian khác theo từng concept riêng.",
      "Bố cục quán được chia thành nhiều khu để khách dễ chọn đúng trải nghiệm mong muốn.",
      "Mỗi khu có phong cách decor và ánh sáng khác nhau, phù hợp cả làm việc lẫn thư giãn.",
    ],
    discoveryNote:
      "Bạn có thể cập nhật thêm ảnh cho từng khu mới, website sẽ tiếp tục được mở rộng theo đúng hệ sinh thái.",
    heroImage: "/uploads/cafe/cafe-hero.png",
    heroAlt: "Không gian Tiệm cà phê Ông Quan",
    slides: [
      {
        image: "/uploads/cafe/cafe-1.png",
        alt: "Không gian khu Hội An tại Tiệm cà phê Ông Quan",
        title: "Khu Hội An",
        description: "Không gian mang chất phố cổ, ánh sáng ấm và nhiều góc chụp ảnh.",
        tone: "tone-cafe",
      },
      {
        image: "/uploads/cafe/cafe-2.png",
        alt: "Không gian Nhà bên suối tại Tiệm cà phê Ông Quan",
        title: "Nhà bên suối",
        description: "Khu thư giãn gần thiên nhiên, phù hợp gặp gỡ và nghỉ ngơi cuối ngày.",
        tone: "tone-cafe",
      },
      {
        image: "/uploads/cafe/cafe-3.png",
        alt: "Không gian Nhà gia Tiên tại Tiệm cà phê Ông Quan",
        title: "Nhà gia Tiên",
        description: "Không gian riêng và ấm cúng cho nhóm khách cần sự yên tĩnh hơn.",
        tone: "tone-cafe",
      },
      {
        image: "/uploads/cafe/cafe-4.png",
        alt: "Các khu mở rộng tại Tiệm cà phê Ông Quan",
        title: "Còn nhiều khu đang chờ đón",
        description: "Hệ không gian liên tục mở rộng để mang lại trải nghiệm mới cho khách quay lại.",
        tone: "tone-cafe",
      },
    ],
  },
  {
    id: "hotpot",
    hash: "#/tiem-lau-ong-quan",
    navLabel: "Tiệm lẩu Ông Quan",
    shortLabel: "Tiệm lẩu",
    tag: "Nhà hàng lẩu",
    name: "Tiệm lẩu Ông Quan",
    headline: "Lẩu tươi mỗi ngày, phục vụ nhóm và gia đình",
    description:
      "Không gian ấm, menu lẩu theo set, nguyên liệu sạch từ chuỗi cung ứng nội bộ. Tiệm lẩu Ông Quan tối ưu cho tiệc nhóm, sinh nhật và gặp mặt gia đình.",
    address: "267 Đường 30/4, Ninh Kiều, Cần Thơ",
    time: "7:00 - 22:00",
    contact: "093 997 65 65",
    stats: [
      { label: "Sức chứa", value: "220 khách" },
      { label: "Phòng riêng", value: "6 phòng" },
      { label: "Món bán chạy", value: "Lẩu nấm bò Wagyu" },
      { label: "Tỉ lệ khách quay lại", value: "78%" },
    ],
    zones: [
      {
        title: "Khu Đại Sảnh",
        detail: "Không gian mở cho nhóm bạn và công ty, tối ưu cho phục vụ nhanh giờ cao điểm.",
      },
      {
        title: "Khu VIP Gia Đình",
        detail: "Phòng riêng cách âm, điều hòa độc lập, setup linh hoạt theo số lượng khách.",
      },
      {
        title: "Khu Bếp Nước Dùng",
        detail: "Bếp trung tâm kiểm soát nhiệt và vị nước dùng, đồng nhất chất lượng mỗi bàn.",
      },
    ],
    signature: [
      "Lẩu nấm bò Wagyu",
      "Lẩu hải sản sa tế Ông Quan",
      "Tháp viên topping tự chọn",
      "Set combo 4-6-8 người",
    ],
    discoveryTitle: "Điểm mạnh vận hành",
    discoveryItems: [
      "Phân luồng phục vụ theo ca và khu vực giúp rút ngắn thời gian chờ.",
      "Set menu được đóng gói theo quy mô khách để dễ chốt đơn nhanh.",
      "Chuỗi nguyên liệu đồng bộ với Farm để đảm bảo độ tươi mỗi ngày.",
    ],
    discoveryNote: "Tiệm lẩu có thể mở rộng thêm khu VIP mới khi cần tăng sức chứa theo mùa.",
    heroImage: "/uploads/lau/lau-hero.jpg",
    heroAlt: "Không gian Tiệm lẩu Ông Quan",
    slides: [
      {
        image: "/uploads/lau/lau-1.jpg",
        alt: "Đại sảnh Tiệm lẩu Ông Quan",
        title: "Đại sảnh phục vụ cao điểm",
        description: "Bố cục rộng, lối đi thoáng, luồng phục vụ tối ưu cho giờ tối và cuối tuần.",
        tone: "tone-hotpot",
      },
      {
        image: "/uploads/lau/lau-2.jpg",
        alt: "Bàn tiệc nhóm tại Tiệm lẩu Ông Quan",
        title: "Setup bàn nhóm chuyên nghiệp",
        description: "Bàn set đồng bộ, nhân sự hỗ trợ tại bàn, chuẩn cho tiệc sinh nhật và họp nhóm.",
        tone: "tone-hotpot",
      },
      {
        image: "/uploads/lau/lau-3.jpg",
        alt: "Các set lẩu tại Tiệm lẩu Ông Quan",
        title: "Set menu theo quy mô",
        description: "Thực đơn thiết kế theo số khách và ngân sách, đảm bảo dễ chọn và dễ chốt đơn.",
        tone: "tone-hotpot",
      },
      {
        image: "/uploads/lau/lau-4.jpg",
        alt: "Khu phòng riêng tại Tiệm lẩu Ông Quan",
        title: "Phòng riêng cho gia đình",
        description: "Không gian riêng tư, phù hợp gặp mặt đối tác, gia đình và dịp kỷ niệm.",
        tone: "tone-hotpot",
      },
    ],
  },
  {
    id: "farm",
    hash: "#/ong-quan-farm",
    navLabel: "Ông Quan Farm",
    shortLabel: "Farm",
    tag: "Nông trại",
    name: "Ông Quan Farm",
    headline: "Nguồn nguyên liệu sạch cho toàn hệ sinh thái",
    description:
      "Ông Quan Farm là trung tâm sản xuất rau, thảo mộc và một phần nguyên liệu tươi. Mô hình farm-to-table giúp kiểm soát chất lượng, truy xuất rõ nguồn gốc.",
    address: "267 Đường 30/4, Ninh Kiều, Cần Thơ",
    time: "07:00 - 17:30",
    contact: "0917 808 226",
    stats: [
      { label: "Quy mô canh tác", value: "4.2 ha" },
      { label: "Sản lượng tuần", value: "1.8 tấn" },
      { label: "Loại rau - thảo mộc", value: "35+" },
      { label: "Lô truy xuất QR", value: "100%" },
    ],
    zones: [
      {
        title: "Khu Trồng Hữu Cơ",
        detail: "Rau ăn lá và thảo mộc theo lịch gieo trồng quay vòng, giảm phụ thuộc thị trường.",
      },
      {
        title: "Khu Sơ Chế - Đóng Gói",
        detail: "Tiền xử lý, phân loại, đóng gói theo tiêu chuẩn vận chuyển về quán trong ngày.",
      },
      {
        title: "Khu Trải Nghiệm",
        detail: "Tour giáo dục nông nghiệp, hoạt động cuối tuần cho gia đình và học sinh.",
      },
    ],
    signature: [
      "Rau ăn kèm cho set lẩu",
      "Thảo mộc pha trà mùa vụ",
      "Chanh - tắc - lá thơm giao trong ngày",
      "Combo tour nông trại cuối tuần",
    ],
    discoveryTitle: "Chuỗi cung ứng farm-to-table",
    discoveryItems: [
      "Dữ liệu sản lượng cập nhật theo tuần để điều phối về quán cà phê và tiệm lẩu.",
      "Quy trình sơ chế giúp giữ độ tươi và rút ngắn thời gian chuẩn bị tại bếp.",
      "Tour trải nghiệm hỗ trợ tăng nhận diện thương hiệu và doanh thu cuối tuần.",
    ],
    discoveryNote: "Farm là nền tảng nguyên liệu giúp toàn hệ sinh thái vận hành ổn định và minh bạch.",
    heroImage: "/uploads/farm/farm-hero.jpg",
    heroAlt: "Ông Quan Farm",
    slides: [
      {
        image: "/uploads/farm/farm-1.jpg",
        alt: "Khu trồng rau tại Ông Quan Farm",
        title: "Luống trồng theo lịch mùa vụ",
        description: "Kế hoạch trồng bám sát nhu cầu tiêu thụ tại quán, giúp nguyên liệu luôn tươi mới.",
        tone: "tone-farm",
      },
      {
        image: "/uploads/farm/farm-2.jpg",
        alt: "Sơ chế và đóng gói tại Ông Quan Farm",
        title: "Chuỗi sơ chế khép kín",
        description: "Kiểm soát chất lượng trước khi giao về quán, giữ độ tươi và an toàn thực phẩm.",
        tone: "tone-farm",
      },
      {
        image: "/uploads/farm/farm-3.jpg",
        alt: "Khách trải nghiệm tại Ông Quan Farm",
        title: "Tour trải nghiệm cuối tuần",
        description: "Mô hình tham quan nông trại kết hợp hoạt động giáo dục và workshop nông nghiệp.",
        tone: "tone-farm",
      },
      {
        image: "/uploads/farm/farm-4.jpg",
        alt: "Thu hoạch nguyên liệu tại Ông Quan Farm",
        title: "Thu hoạch và vận chuyển trong ngày",
        description: "Tối ưu tuyến giao về tiệm cà phê và tiệm lẩu để nguyên liệu đạt độ tươi tối đa.",
        tone: "tone-farm",
      },
    ],
  },
];

const pages = [
  { id: "home", hash: "#/home", label: "Trang chủ", shortLabel: "Trang chủ" },
  ...venues.map((venue) => ({
    id: venue.id,
    hash: venue.hash,
    label: venue.navLabel,
    shortLabel: venue.shortLabel,
  })),
];

const pagesById = pages.reduce((accumulator, page) => {
  accumulator[page.id] = page;
  return accumulator;
}, {});

const venuesById = venues.reduce((accumulator, venue) => {
  accumulator[venue.id] = venue;
  return accumulator;
}, {});

const routeByHash = pages.reduce((accumulator, page) => {
  accumulator[page.hash] = page.id;
  return accumulator;
}, {});

function normalizeRoute(hashValue) {
  if (!hashValue || !routeByHash[hashValue]) {
    return "home";
  }
  return routeByHash[hashValue];
}

function ImageCarousel({ slides }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState({});

  useEffect(() => {
    setActiveIndex(0);
    setFailedImages({});
  }, [slides]);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4800);

    return () => window.clearInterval(timer);
  }, [slides]);

  const moveTo = (nextIndex) => {
    if (!slides.length) {
      return;
    }
    const normalized = (nextIndex + slides.length) % slides.length;
    setActiveIndex(normalized);
  };

  const onImageError = (index) => {
    setFailedImages((previous) => {
      if (previous[index]) {
        return previous;
      }
      return { ...previous, [index]: true };
    });
  };

  return (
    <div className="carousel-card">
      <div className="carousel-window">
        <div className="carousel-track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
          {slides.map((slide, index) => (
            <article className="carousel-slide" key={slide.image}>
              <div className={`slide-media ${slide.tone}`}>
                {!failedImages[index] ? (
                  <img src={slide.image} alt={slide.alt} loading="lazy" onError={() => onImageError(index)} />
                ) : null}
              </div>
              <h3 className="slide-heading">{slide.title}</h3>
              <p className="slide-description">{slide.description}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="carousel-controls">
        <button type="button" className="arrow-btn" onClick={() => moveTo(activeIndex - 1)} aria-label="Ảnh trước">
          ←
        </button>
        <div className="dot-list" role="tablist" aria-label="Chọn ảnh">
          {slides.map((slide, index) => (
            <button
              key={slide.image}
              type="button"
              role="tab"
              aria-label={`Xem ảnh ${index + 1}`}
              aria-selected={index === activeIndex}
              className={`dot ${index === activeIndex ? "is-active" : ""}`}
              onClick={() => moveTo(index)}
            />
          ))}
        </div>
        <button
          type="button"
          className="arrow-btn"
          onClick={() => moveTo(activeIndex + 1)}
          aria-label="Ảnh tiếp theo"
        >
          →
        </button>
      </div>
    </div>
  );
}

function CompanyHome({ onOpenPage }) {
  return (
    <div className="home-stack">
      <section className="home-hero">
        <article className="home-copy-card">
          <p className="eyebrow">Giới thiệu doanh nghiệp</p>
          <h1>{company.name}</h1>
          <p className="home-copy">
            T&N hoạt động trong các mảng đầu tư, thương mại, dịch vụ và vận hành hệ sinh thái kinh doanh tại Cần
            Thơ. Doanh nghiệp định hướng phát triển bền vững, minh bạch pháp lý và tối ưu vận hành theo từng lĩnh vực.
          </p>
          <div className="home-actions">
            <button type="button" className="home-btn" onClick={() => onOpenPage("cafe")}>
              Xem Tiệm cà phê Ông Quan
            </button>
          </div>
        </article>

        <aside className="home-legal-card">
          <h2>Thông tin pháp lý nổi bật</h2>
          <ul>
            <li>
              <span>Tên viết tắt</span>
              <strong>{company.shortName}</strong>
            </li>
            <li>
              <span>Mã số doanh nghiệp</span>
              <strong>{company.enterpriseCode}</strong>
            </li>
            <li>
              <span>Ngày đăng ký</span>
              <strong>{company.foundedDate}</strong>
            </li>
            <li>
              <span>Cập nhật gần nhất</span>
              <strong>{company.latestUpdate}</strong>
            </li>
          </ul>
        </aside>
      </section>

      <section className="home-kpi-grid" aria-label="Thông tin tổng quan">
        {companyHighlights.map((item) => (
          <article className="home-kpi-card" key={item.label}>
            <p>{item.label}</p>
            <h3>{item.value}</h3>
          </article>
        ))}
      </section>

      <section className="home-dual">
        <article className="home-info-card">
          <h2>Thông tin doanh nghiệp</h2>
          <div className="home-info-list">
            <p>
              <span>Trụ sở chính</span>
              {company.headquarters}
            </p>
            <p>
              <span>Điện thoại</span>
              {company.phone}
            </p>
            <p>
              <span>Người đại diện pháp luật</span>
              {company.legalRep}
            </p>
            <p>
              <span>Năm tài chính</span>
              {company.fiscalYear}
            </p>
          </div>
        </article>

        <article className="home-info-card home-focus-card">
          <h2>Năng lực cốt lõi</h2>
          <ul className="home-focus-list">
            <li>Đầu tư, thương mại và dịch vụ tổng hợp</li>
            <li>Kinh doanh bất động sản và quản lý tài sản</li>
            <li>Xây dựng, lắp đặt hệ thống kỹ thuật công trình</li>
            <li>Vận hành mô hình F&B theo hệ sinh thái Ông Quan</li>
          </ul>
        </article>
      </section>

      <section className="home-section">
        <div className="section-head">
          <p className="eyebrow">Danh mục đăng ký</p>
          <h2>Ngành nghề kinh doanh tiêu biểu</h2>
        </div>
        <div className="home-business-grid">
          {businessAreas.map((item) => (
            <article className="home-business-card" key={item.code}>
              <p className="home-business-code">{item.code}</p>
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <p className="eyebrow">Nền tảng quản trị</p>
          <h2>Pháp lý và thuế</h2>
        </div>
        <div className="home-legal-grid">
          {legalTimeline.map((item) => (
            <article className="home-legal-item" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.content}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="section-head">
          <p className="eyebrow">Hệ sinh thái Ông Quan</p>
          <h2>3 trang giới thiệu 3 khu vực quán</h2>
        </div>
        <div className="home-ecosystem-grid">
          {venues.map((venue) => (
            <article className="home-ecosystem-card" key={venue.id}>
              <p>{venue.tag}</p>
              <h3>{venue.name}</h3>
              <span>{venue.address}</span>
              <button type="button" onClick={() => onOpenPage(venue.id)}>
                Mở trang này
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function VenuePage({ activeVenue, heroImageFailed, setHeroImageFailed, onOpenPage }) {
  return (
    <>
      <section className="hero-block">
        <article className="hero-copy">
          <p className="eyebrow">{activeVenue.tag}</p>
          <h1>{activeVenue.name}</h1>
          <p className="hero-headline">{activeVenue.headline}</p>
          <p className="hero-description">{activeVenue.description}</p>

          <div className="meta-grid">
            <p>
              <span>Địa chỉ</span>
              {activeVenue.address}
            </p>
            <p>
              <span>Khung giờ</span>
              {activeVenue.time}
            </p>
            <p>
              <span>Liên hệ</span>
              {activeVenue.contact}
            </p>
          </div>
        </article>

        <article className="hero-media">
          <div className="hero-image-shell">
            {!heroImageFailed ? (
              <img
                src={activeVenue.heroImage}
                alt={activeVenue.heroAlt}
                loading="eager"
                onError={() => setHeroImageFailed(true)}
              />
            ) : null}
            <div className="hero-image-overlay" />
            <div className="hero-image-copy">
              <p>Điểm nhấn</p>
              <h2>{activeVenue.headline}</h2>
            </div>
          </div>
        </article>
      </section>

      <section className="stats-grid" aria-label="Thống kê địa điểm">
        {activeVenue.stats.map((item, index) => (
          <article className="stat-card" key={item.label} style={{ "--delay": `${index * 0.08}s` }}>
            <p>{item.label}</p>
            <h3>{item.value}</h3>
          </article>
        ))}
      </section>

      <section className="section-stack">
        <div className="section-head">
          <p className="eyebrow">Không gian nổi bật</p>
          <h2>Một phần khu trải nghiệm tại {activeVenue.name}</h2>
        </div>

        <div className="zone-grid">
          {activeVenue.zones.map((zone, index) => (
            <article className="zone-card" key={zone.title} style={{ "--delay": `${index * 0.1}s` }}>
              <p className="zone-order">Khu nổi bật {index + 1}</p>
              <h3>{zone.title}</h3>
              <p>{zone.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-stack" id="thu-vien-anh">
        <div className="section-head">
          <p className="eyebrow">Hình ảnh</p>
          <h2>Thư viện không gian thực tế</h2>
        </div>
        <ImageCarousel slides={activeVenue.slides} />
      </section>

      <section className="split-panel">
        <article className="menu-card">
          <div className="section-head compact">
            <p className="eyebrow">Điểm nổi bật</p>
            <h2>Menu / dịch vụ signature</h2>
          </div>
          <ul>
            {activeVenue.signature.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="discovery-card">
          <div className="section-head compact">
            <p className="eyebrow">Trải nghiệm mở rộng</p>
            <h2>{activeVenue.discoveryTitle}</h2>
          </div>
          <ul>
            {activeVenue.discoveryItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="discovery-tip">{activeVenue.discoveryNote}</p>
        </article>
      </section>

      <section className="section-stack" id="he-sinh-thai">
        <div className="section-head">
          <p className="eyebrow">Toàn hệ sinh thái</p>
          <h2>3 trang độc lập trong cùng một thương hiệu Ông Quan</h2>
        </div>

        <div className="ecosystem-grid">
          {venues.map((venue) => (
            <article key={venue.id} className={`ecosystem-card ${venue.id === activeVenue.id ? "is-current" : ""}`}>
              <p className="card-tag">{venue.tag}</p>
              <h3>{venue.name}</h3>
              <p>{venue.description}</p>
              <button type="button" onClick={() => onOpenPage(venue.id)}>
                {venue.id === activeVenue.id ? "Đang hiển thị" : "Mở trang này"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export default function App() {
  const [activePageId, setActivePageId] = useState(() => normalizeRoute(window.location.hash));
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  useEffect(() => {
    const syncFromHash = () => {
      setActivePageId(normalizeRoute(window.location.hash));
    };

    if (!routeByHash[window.location.hash]) {
      window.history.replaceState({}, "", "#/home");
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const activeVenue = useMemo(() => venuesById[activePageId] || null, [activePageId]);
  const activePage = useMemo(() => pagesById[activePageId] || pagesById.home, [activePageId]);
  const isHome = activePage.id === "home";

  useEffect(() => {
    if (activeVenue) {
      setHeroImageFailed(false);
    }
  }, [activeVenue]);

  const jumpToPage = (pageId) => {
    const targetPage = pagesById[pageId];
    if (!targetPage) {
      return;
    }

    if (window.location.hash !== targetPage.hash) {
      window.location.hash = targetPage.hash;
    }
  };

  return (
    <div className={`app-shell ${isHome ? "theme-home" : `theme-${activeVenue.id}`}`}>
      <div className="ambient ambient-1" aria-hidden="true" />
      <div className="ambient ambient-2" aria-hidden="true" />
      <div className="ambient ambient-3" aria-hidden="true" />

      <header className="site-header">
        <div className="brand">
          <span className="brand-mark">T&N</span>
          <div>
            <p className="brand-title">T&N Company</p>
            <p className="brand-sub">Trang chủ doanh nghiệp & hệ sinh thái Ông Quan</p>
          </div>
        </div>

        <nav className="page-nav" aria-label="Điều hướng trang">
          {pages.map((page) => (
            <a
              key={page.id}
              href={page.hash}
              className={activePage.id === page.id ? "is-active" : ""}
              onClick={() => jumpToPage(page.id)}
              title={page.label}
            >
              {page.shortLabel}
            </a>
          ))}
        </nav>
      </header>

      <main className="page-content">
        {isHome ? (
          <CompanyHome onOpenPage={jumpToPage} />
        ) : (
          <VenuePage
            activeVenue={activeVenue}
            heroImageFailed={heroImageFailed}
            setHeroImageFailed={setHeroImageFailed}
            onOpenPage={jumpToPage}
          />
        )}
      </main>

      <footer className="site-footer">
        <p>
          {isHome
            ? "© 2026 T&N Company. Trang chủ giới thiệu doanh nghiệp và năng lực vận hành."
            : "© 2026 Hệ sinh thái Ông Quan. Thiết kế theo mô hình 3 trang: Cà phê - Lẩu - Farm."}
        </p>
      </footer>
    </div>
  );
}
