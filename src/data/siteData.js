export const company = {
  name: "Công ty TNHH Thương mại Dịch vụ Đầu tư Tổng hợp T-N",
  shortName: "T&N Company",
  enterpriseCode: "1801702806",
  foundedDate: "06/05/2021",
  latestUpdate: "Đăng ký thay đổi lần 2: 14/12/2025",
  capital: "1.000.000.000 đồng",
  headquarters: "Số 267, đường 30/4, phường Ninh Kiều, thành phố Cần Thơ",
  phone: "0337 336 138",
  legalRep: "Lê Đức Trọng",
};

export const companyHighlights = [
  { label: "Mã số doanh nghiệp", value: company.enterpriseCode },
  { label: "Vốn điều lệ", value: company.capital },
  { label: "Ngày đăng ký", value: company.foundedDate },
  { label: "Hồ sơ pháp lý", value: "Đang hoạt động" },
];

export const businessAreas = [
  { code: "6810", name: "Kinh doanh bất động sản", detail: "Quản lý và khai thác tài sản." },
  { code: "4101 - 4102", name: "Xây dựng công trình", detail: "Thi công dân dụng và hạ tầng kỹ thuật." },
  { code: "4321 - 4322", name: "Lắp đặt hệ thống tòa nhà", detail: "Điện, nước, điều hòa, PCCC, camera." },
  { code: "4673", name: "Bán buôn vật liệu xây dựng", detail: "Thiết bị và vật tư công trình." },
];

export const legalTimeline = [
  { title: "Đăng ký doanh nghiệp", content: `Đăng ký lần đầu ngày ${company.foundedDate}.` },
  { title: "Cập nhật pháp lý", content: "Đăng ký thay đổi nội dung doanh nghiệp lần 2 ngày 14/12/2025." },
  { title: "Người đại diện pháp luật", content: company.legalRep },
];

export const coreCapabilities = [
  "Đầu tư, thương mại và dịch vụ tổng hợp",
  "Kinh doanh bất động sản và quản lý tài sản",
  "Xây dựng, lắp đặt hệ thống kỹ thuật công trình",
  "Vận hành mô hình F&B theo hệ sinh thái Ông Quan",
];

const venueGalleryFiles = {
  cafe: Object.keys(import.meta.glob("../../public/uploads/cafe/*.{png,jpg,jpeg,webp,avif}")).map((path) =>
    path.replace("../../public", "")
  ),
  hotpot: Object.keys(import.meta.glob("../../public/uploads/lau/*.{png,jpg,jpeg,webp,avif}")).map((path) =>
    path.replace("../../public", "")
  ),
  farm: Object.keys(import.meta.glob("../../public/uploads/farm/*.{png,jpg,jpeg,webp,avif}")).map((path) =>
    path.replace("../../public", "")
  ),
};

function shuffleItems(items) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function createVenueSlides({ folderKey, tone, venueName }) {
  return shuffleItems(venueGalleryFiles[folderKey]).map((image, index) => ({
    image,
    alt: `${venueName} - ảnh ${index + 1}`,
    title: `Ảnh ${String(index + 1).padStart(2, "0")}`,
    description: `Hình ảnh thực tế tại ${venueName}.`,
    tone,
  }));
}

export const venues = [
  {
    id: "cafe",
    hash: "#/ca-phe-ong-quan",
    navLabel: "Tiệm cà phê Ông Quan",
    shortLabel: "Cà phê",
    tag: "Quán chính",
    name: "Tiệm cà phê Ông Quan",
    headline: "Không gian chính của hệ sinh thái Ông Quan",
    description:
      "Tiệm cà phê Ông Quan có nhiều khu trải nghiệm: Hội An, Nhà bên suối, Nhà gia Tiên và nhiều khu mới đang chờ đón.",
    address: "267 Đường 30/4, Ninh Kiều, Cần Thơ",
    time: "07:00 - 22:00",
    contact: "077 277 0789",
    stats: [
      { label: "Diện tích phục vụ", value: "1km+" },
      { label: "Món signature", value: "Trà sữa Ông Quan" },
      { label: "Không gian nổi bật", value: "Hội An - Bên suối - Gia Tiên" },
    ],
    zones: [
      { title: "Khu Hội An", detail: "Không gian đèn lồng ấm, hợp chụp ảnh và trò chuyện tối." },
      { title: "Nhà bên suối", detail: "Không gian thư giãn gần thiên nhiên, phù hợp nhóm bạn/gia đình." },
      { title: "Nhà gia Tiên", detail: "Không gian cổ điển và riêng tư hơn cho gặp gỡ thân mật." },
    ],
    signature: ["Trà sữa Ông Quan", "Tiệm bánh", "Tiệm lẩu"],
    discoveryTitle: "Nhiều khu khác đang chờ đón",
    discoveryItems: [
      "Quán chia nhiều khu theo từng concept riêng.",
      "Mỗi khu có decor và ánh sáng khác nhau.",
      "Không gian mở rộng liên tục theo từng giai đoạn.",
    ],
    discoveryNote: "Bạn có thể tiếp tục cập nhật thêm ảnh cho các khu mới.",
    heroImage: "/uploads/cafe/cafe-hero.png",
    heroAlt: "Không gian Tiệm cà phê Ông Quan",
    slides: createVenueSlides({
      folderKey: "cafe",
      tone: "tone-cafe",
      venueName: "Tiệm cà phê Ông Quan",
    }),
  },
  {
    id: "hotpot",
    hash: "#/tiem-lau-ong-quan",
    navLabel: "Tiệm lẩu Ông Quan",
    shortLabel: "Tiệm lẩu",
    tag: "Nhà hàng lẩu",
    name: "Tiệm lẩu Ông Quan",
    headline: "Lẩu, đồ ăn sáng và đồ nướng đa dạng cho nhiều khung giờ",
    description:
      "Tiệm lẩu phục vụ nhiều nhóm món đa dạng, từ các món lẩu đặc trưng, đồ ăn sáng đến đồ nướng và món ăn kèm cho nhóm bạn, gia đình.",
    address: "267 Đường 30/4, Ninh Kiều, Cần Thơ",
    time: "07:00 - 22:00",
    contact: "093 997 65 65",
    stats: [
      { label: "Sức chứa", value: "220 khách" },
      { label: "Nhóm món chính", value: "3 nhóm" },
      { label: "Món nổi bật", value: "Lẩu tiềm sa chùy" },
      { label: "Khung giờ phục vụ", value: "Sáng đến tối" },
    ],
    zonesEyebrow: "Nhóm món nổi bật",
    zonesTitle: "Các nhóm món chính tại Tiệm lẩu Ông Quan",
    zoneItemLabel: "Nhóm món",
    zones: [
      {
        title: "Các món lẩu",
        detail: "Lẩu tiềm sa chùy, lẩu bò nhúng giấm, lẩu Thái, và nhiều lựa chọn phù hợp khách đi nhóm.",
      },
      {
        title: "Đồ ăn sáng",
        detail: "Các món sáng lên nhanh, gọn và phù hợp khách ghé quán trước giờ làm việc.",
      },
      {
        title: "Đồ nướng và món ăn kèm",
        detail: "Bổ sung thêm món nướng, món nhắm và các phần ăn kèm để bữa ăn đa dạng hơn.",
      },
    ],
    signature: ["Lẩu tiềm sa chùy", "Lẩu Thái đặc trưng", "Combo ăn sáng", "Đồ nướng gọi thêm"],
    discoveryTitle: "Menu đa dạng cho nhiều thời điểm trong ngày",
    discoveryItems: [
      "Khách có thể chọn món theo nhu cầu: ăn sáng, ăn chính hoặc gọi thêm món nướng.",
      "Menu đủ rộng để phục vụ khách cá nhân lẫn nhóm đông.",
      "Các món lẩu và món ăn kèm dễ kết hợp thành nhiều set khác nhau.",
    ],
    discoveryNote: "Tiệm lẩu tập trung vào sự đa dạng món để phục vụ tốt nhiều nhu cầu trong ngày.",
    heroImage: "/uploads/lau/lau1.jpg",
    heroAlt: "Không gian Tiệm lẩu Ông Quan",
    introEyebrow: "Ảnh theo nhóm món",
    introTitle: "Một vài hình ảnh món nổi bật tại Tiệm lẩu Ông Quan",
    introSections: [
      {
        title: "Nhóm món lẩu",
        description: "Các món lẩu chủ lực của tiệm, phù hợp khách đi nhóm.",
        image: "/uploads/lau/lautiemsachuy.jpg",
        alt: "Lẩu tiềm sa chùy tại Tiệm lẩu Ông Quan",
        tone: "tone-hotpot",
      },
      {
        title: "Nhóm món ăn sáng",
        description: "Các món sáng phục vụ nhanh, tiện cho khách ghé quán sớm.",
        image: "/uploads/lau/ansang1.jpg",
        alt: "Khu ăn sáng tại Tiệm lẩu Ông Quan",
        tone: "tone-hotpot",
      },
      {
        title: "Nhóm món nướng và ăn kèm",
        description: "Các món bổ sung giúp bữa ăn đa dạng và phong phú hơn.",
        image: "/uploads/lau/comchien.jpg",
        alt: "Đồ nướng và món ăn kèm tại Tiệm lẩu Ông Quan",
        tone: "tone-hotpot",
      },
    ],
    slides: createVenueSlides({
      folderKey: "hotpot",
      tone: "tone-hotpot",
      venueName: "Tiệm lẩu Ông Quan",
    }),
  },
  {
    id: "farm",
    hash: "#/ong-quan-farm",
    navLabel: "Ông Quan Farm",
    shortLabel: "Farm",
    tag: "Nông trại",
    name: "Ông Quan Farm",
    headline: "Điểm tham quan với nhiều loài thú và không gian trải nghiệm ngoài trời",
    description:
      "Ông Quan Farm là điểm tham quan dành cho gia đình, nhóm bạn và khách chụp ảnh, nổi bật với nhiều loài thú, các góc check-in và trải nghiệm ngoài trời gần gũi thiên nhiên.",
    address: "267 Đường 30/4, Ninh Kiều, Cần Thơ",
    time: "07:00 - 17:30",
    contact: "0917 808 226 77777",
    stats: [
      { label: "Loài thú nổi bật", value: "10+" },
      { label: "Điểm check-in", value: "Nhiều khu" },
      { label: "Khung giờ phù hợp", value: "Sáng - chiều" },
    ],
    zonesEyebrow: "Khu trải nghiệm nổi bật",
    zonesTitle: "Một vài điểm tham quan tại Ông Quan Farm",
    zoneItemLabel: "Điểm tham quan",
    zones: [
      {
        title: "Khu thú tham quan",
        detail: "Nơi du khách có thể ngắm nhiều loài thú, chụp ảnh và trải nghiệm không gian gần gũi thiên nhiên.",
      },
      {
        title: "Khu check-in ngoài trời",
        detail: "Các tiểu cảnh, lối đi và góc dựng cảnh phù hợp chụp ảnh cá nhân, nhóm bạn và gia đình.",
      },
      {
        title: "Khu vui chơi trải nghiệm",
        detail: "Không gian đi dạo, thư giãn và tổ chức các hoạt động tham quan cuối tuần.",
      },
    ],
    signature: [
      "Tham quan nhiều loài thú",
      "Check-in tiểu cảnh ngoài trời",
      "Không gian phù hợp gia đình có trẻ nhỏ",
      "Tour tham quan cuối tuần",
    ],
    discoveryTitle: "Điểm đến phù hợp cho tham quan và chụp ảnh",
    discoveryItems: [
      "Phù hợp cho khách đi gia đình, nhóm bạn hoặc ghé chụp ảnh dịp cuối tuần.",
      "Không gian ngoài trời rộng giúp trải nghiệm thoáng và gần gũi.",
      "Các khu thú và góc check-in tạo điểm khác biệt cho toàn hệ sinh thái Ông Quan.",
    ],
    discoveryNote: "Ông Quan Farm được định vị là điểm tham quan trải nghiệm hơn là khu canh tác.",
    heroImage: "/uploads/farm/farm1.jpg",
    heroAlt: "Ông Quan Farm",
    introEyebrow: "Ảnh theo điểm tham quan",
    introTitle: "Một vài góc trải nghiệm tại Ông Quan Farm",
    introSections: [
      {
        title: "Không gian tham quan chính",
        description: "Khu nổi bật dành cho khách dạo chơi và chụp ảnh.",
        image: "/uploads/farm/farm6.jpg",
        alt: "Không gian tham quan chính tại Ông Quan Farm",
        tone: "tone-farm",
      },
      {
        title: "Khu thú và trải nghiệm",
        description: "Gần gũi hơn với các loài thú và hoạt động ngoài trời.",
        image: "/uploads/farm/farm7.jpg",
        alt: "Khu thú và trải nghiệm tại Ông Quan Farm",
        tone: "tone-farm",
      },
      {
        title: "Góc check-in ngoài trời",
        description: "Phù hợp chụp ảnh, thư giãn và tham quan cuối tuần.",
        image: "/uploads/farm/farm8.jpg",
        alt: "Góc check-in ngoài trời tại Ông Quan Farm",
        tone: "tone-farm",
      },
    ],
    slides: createVenueSlides({
      folderKey: "farm",
      tone: "tone-farm",
      venueName: "Ông Quan Farm",
    }),
  },
];

export const pages = [
  { id: "home", hash: "#/home", label: "Trang chủ", shortLabel: "Trang chủ" },
  ...venues.map((venue) => ({
    id: venue.id,
    hash: venue.hash,
    label: venue.navLabel,
    shortLabel: venue.shortLabel,
  })),
];

export const pagesById = pages.reduce((accumulator, page) => {
  accumulator[page.id] = page;
  return accumulator;
}, {});

export const venuesById = venues.reduce((accumulator, venue) => {
  accumulator[venue.id] = venue;
  return accumulator;
}, {});

export const routeByHash = pages.reduce((accumulator, page) => {
  accumulator[page.hash] = page.id;
  return accumulator;
}, {}); 
