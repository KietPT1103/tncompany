import React from "react";
import {
  businessAreas,
  company,
  companyHighlights,
  coreCapabilities,
  legalTimeline,
} from "../data/siteData";

export default function CompanyHome({ onOpenPage }) {
  return (
    <div className="home-stack">
      <section className="home-hero">
        <article className="home-copy-card">
          <p className="eyebrow">Giới thiệu doanh nghiệp</p>
          <h1>
            {company.name.replace(/ T-N$/, "")} <span className="keep-together">T-N</span>
          </h1>
          <p className="home-copy">
            T&N hoạt động trong các mảng đầu tư, thương mại, dịch vụ và vận hành hệ sinh thái kinh doanh tại Cần Thơ.
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
          </div>
        </article>

        <article className="home-info-card home-focus-card">
          <h2>Năng lực cốt lõi</h2>
          <ul className="home-focus-list">
            {coreCapabilities.map((item) => (
              <li key={item}>{item}</li>
            ))}
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
    </div>
  );
}
