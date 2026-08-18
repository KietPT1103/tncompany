# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are TN Services administrators and store managers operating the cafe, kitchen, bakery, and farm areas. They need to monitor daily business activity and move quickly into operational workflows such as POS, bills, inventory, payroll, and reports.

## Product Purpose

The product centralizes TN Services operations. Success means an authorized user can understand current business performance, identify issues, and open the relevant workflow without reconciling several disconnected tools.

## Operating Context

The application is used as an authenticated management workspace alongside live POS and bar operations. Data is scoped to the currently selected business area and backed by the existing PHP/MySQL APIs.

## Capabilities and Constraints

- The admin experience is a React/Vite web application with responsive desktop and mobile layouts.
- Access is controlled by role and explicit permissions.
- Dashboard summaries must use real application data and must not present invented business figures as production data.
- Existing report-import and inventory-consumption workflows must remain available while overview reporting is expanded.

## Brand Commitments

Preserve the existing TN Services identity: deep emerald navigation, warm gold accents, the current TN Services logo, Vietnamese interface copy, and the established compact operational layout.

## Evidence on Hand

- Existing UI and navigation in `src/AdminSidebar.tsx` and `src/app/(dashboard)`.
- Current store, bill, report, product, payroll, and inventory APIs under `src/services` and `public/api`.
- User-provided KiotViet overview screenshot is a functional reference for dashboard information hierarchy, not a request to copy its branding.

## Product Principles

- Show operational truth before decorative presentation.
- Keep common management actions one navigation step away.
- Preserve store context across every dashboard metric.
- Make empty, loading, and error states explicit.
- Keep dense business information readable on both desktop and mobile.

## Accessibility & Inclusion

Interactive controls must be keyboard accessible, maintain visible focus, use Vietnamese labels, and meet WCAG 2.1 AA contrast expectations.
