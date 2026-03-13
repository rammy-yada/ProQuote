# ProQuote — Professional Quotation & Invoice Maker

ProQuote is a premium, feature-rich web application designed for freelancers and small businesses to create, manage, and share professional quotations and invoices effortlessly.

![ProQuote Logo](logo.svg)

## ✨ Key Features

- **🚀 Professional Generators**: Dedicated modules for both Quotations and Invoices with a modern, responsive 35/65 split layout.
- **📱 PWA & Offline Support**: Install ProQuote on your mobile or desktop. Works fully offline, ensuring you can draft quotes anywhere.
- **🖼️ WhatsApp Sharing**: Generate high-quality JPG images of your documents and share them directly via WhatsApp.
- **🏵️ Stamp & Signature**: Upload your company stamp and authorized signature once; toggle them on/off for any document.
- **🎨 Premium Customization**:
    - Multiple document themes (Classic, Modern, Bold, Minimal).
    - Custom brand colors.
    - Dynamic logo resizing and background options.
- **🛡️ Data Safety**:
    - Automatic local drafts via IndexedDB.
    - Confirmation prompts for clearing data.
    - Field validations to prevent incomplete exports.
- **🗂️ Management Tools**:
    - Save and reuse Company profiles and Client data.
    - Product library for quick item insertion.
    - Template categories (Design, Web, Photo, IT, etc.).

## 🛠️ Tech Stack

- **Core**: Vanilla HTML5, CSS3, and JavaScript (ES6+).
- **Storage**: IndexedDB (via local wrapper) for persistent data and drafts.
- **Exports**: `html2canvas` for high-fidelity JPG and PDF rendering.
- **Design**: Modern SaaS aesthetic with glassmorphism, dynamic animations, and full Dark Mode support.

## 🚀 Getting Started

1. **Open**: Simply open `index.html` in any modern web browser.
2. **Install**: Click the "Install" button in the top bar to add it to your home screen/desktop for offline use.
3. **Draft**: Fill in your company details in Step 1, add a client in Step 2, set your pricing in Step 3, and add items in Step 4.
4. **Export**: Review your document in Step 5 and download as PDF, JPG, or share via WhatsApp.

## 📂 Project Structure

- `index.html`: Home screen with 3D interactive logo.
- `quotation-maker.html`: Core quotation generator interface.
- `invoice-maker.html`: Core invoice generator interface.
- `css/styles.css`: Centralized premium styling system.
- `js/app.js`: Application logic, state management, and export functions.
- `logo.svg`: Application branding.

---
*Created with ❤️ for professional efficiency.*
