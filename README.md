# Print Ecommerce 

Production-ready -wide custom printing e-commerce platform.

## Architecture

The project consists of exactly two main applications:

```
D:\print_ecommerce
│
├── frontend/    # Next.js 14+ application (Customer store + Admin operations portal)
└── backend/     # Laravel 11 API-only backend (REST API /api/v1/..., Sanctum, MySQL, R2 storage)
```

## Quick Start

### 1. Frontend Setup & Run
```bash
cd D:\print_ecommerce\frontend
npm run dev
```
- **Customer Website**: [http://localhost:3000](http://localhost:3000)
- **Admin Portal**: [http://localhost:3000/admin](http://localhost:3000/admin)
- **Admin Login**: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

### 2. Backend Setup & Run
```bash
cd D:\print_ecommerce\backend
php artisan serve
```
- **Base API URL**: `http://127.0.0.1:8000`
- **REST API V1**: `http://127.0.0.1:8000/api/v1`
- **Health Check**: `http://127.0.0.1:8000/api/v1/health`
- **Products Catalog**: `http://127.0.0.1:8000/api/v1/products`
- **Categories**: `http://127.0.0.1:8000/api/v1/categories`

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS, TanStack Query, Axios, Zustand, Zod
- **Backend**: Laravel 11, PHP 8.3, MySQL, Redis, Laravel Sanctum, Cloudflare R2 / S3
- **Localization**: Native n AUD ($), 10% GST calculation, AU States & Postcodes
