Margin Delver Angular
=====================

Frontend Angular untuk PoC Margin Delver.
UI mengikuti desain acuan dari prototype static:
C:\Apache24\htdocs\margin-delver-example

Lokasi Project
--------------

C:\GO\margin-delver-angular

Stack
-----

- Angular 19
- Standalone components
- npm
- Dev server port 4500

Cara Menjalankan
----------------

cd C:\GO\margin-delver-angular
npm install
npm start

Dev server:
http://localhost:4500

Script
------

npm start      = ng serve --port 4500
npm run build  = build production
npm test       = unit test Angular

Route
-----

/              Dashboard
/menu          Menu & Margin
/sales-upload  Sales Analysis

Status Saat Ini
---------------

Frontend masih menggunakan local/mock state untuk review UI.
Data menu disimpan di browser localStorage dengan key:
md_angular_menu_v1

Flow yang masih mock/local:
- sample menu upload
- manual menu input
- margin estimation
- ingredient recalculation
- sample sales upload
- profitability analysis
- AI-style suggestions

Asset
-----

Asset prototype sudah disalin ke:

public/assets/margin-delver-icon.png
public/ds/icons/*.svg
public/ds/fonts/*.ttf
public/ds/colors_and_type.css

Integrasi Backend Nanti
-----------------------

Backend target:
/internal/v1

Service API awal tersedia di:
src/app/core/services

Endpoint utama mengikuti dokumen backend:
C:\GO\margin-delver\doc\backend-tech-spec.md

Catatan Git
-----------

File/folder yang tidak perlu dipush sudah diatur di .gitignore:
- node_modules/
- .angular/
- dist/
- coverage/
- logs/cache/temp files
- env lokal

Jangan commit secret seperti API key, database password, atau file .env lokal.
