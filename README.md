# 📄 **Puppeteer PDF Service**  
A production‑ready microservice for generating PDFs from **URLs** or **raw HTML**, powered by **Puppeteer + Chromium**.  
Includes advanced features such as **custom PDF options**, **presets**, **language override**, **one‑page mode**, and a **cookie‑banner detector**.

## 🚀 Features

### **Core**
- Convert **URL → PDF**
- Convert **HTML → PDF**
- JSON API with clean, deterministic payloads
- Fast startup with a persistent Chromium instance

### **Advanced PDF Options**
- Format (A4, A5, Letter, Legal…)
- Orientation (portrait/landscape)
- Margins
- Print background
- One‑long‑page mode (infinite scroll → single tall PDF)
- Language override
- Auto‑hide cookie banners (duckduckgo autoconsent)

### **Presets**
- Minimal
- Full Bleed
- Invoice
- Booklet
- Debug
- Letter
- Legal

### **Operational**
- Dockerfile with Chromium dependencies
- `/health` endpoint + Docker `HEALTHCHECK`

## **Running Locally**

Install dependencies:

```
npm install
```

Start the server (without authentication):

```
HOST=127.0.0.1 PORT=3000 node server.js
```

With basic authentication:

```
HOST=127.0.0.1 PORT=3000 BASIC_AUTH='user:password' node server.js
```

---

## **Running in Docker**

Pull latest image:

```
docker pull sharevb/puppeteer-htmltopdf:latest
```

Run it with access to the host Docker daemon:

```
docker run \
  -p 3000:3000 \
  sharevb/puppeteer-htmltopdf:latest
```

## **Environment Variables**

| Variable | Default | Description |
|---------|---------|-------------|
| `HOST`  | `0.0.0.0` | Interface to bind the HTTP server |
| `PORT`  | `3000` | Port to listen on |
| `CORS`  | `*` | CORS Allowed Origins |
| `BASIC_AUTH`  | unset | Optional HTTP Basic Auth credentials in the form `username:password` |
| `UPLOAD_LIMIT_MB` | 50 | Max upload size |


## 🔌 API Endpoints

### **POST `/pdf/url`**

Generate a PDF from a remote URL.

#### Request Body

```json
{
  "url": "https://example.com",
  "options": {
    "format": "A4",
    "landscape": false,
    "printBackground": true,
    "onePage": false,
    "language": "en-US",
    "autoHideCookies": true,
    "margin": {
      "top": "20mm",
      "bottom": "20mm",
      "left": "15mm",
      "right": "15mm"
    }
  }
}
```

#### Response
`application/pdf` binary stream.

---

### **POST `/pdf/html`**

Generate a PDF from raw HTML.

#### Request Body

```json
{
  "html": "<h1>Hello PDF</h1>",
  "options": { ... }
}
```

---

### **GET `/health`**

Simple healthcheck endpoint.

---

## 🧠 PDF Options

### **Orientation**
```json
{ "landscape": true }
```

### **One Long Page**
```json
{ "onePage": true }
```

Automatically disables `format` and sets dynamic height.

### **Language Override**
```json
{ "language": "fr-FR" }
```

Applies to:
- `Accept-Language` header  
- `navigator.language`  
- `navigator.languages`

### **Auto‑Hide Cookie Banners**
```json
{ "autoHideCookies": true }
```

## 🧩 Presets

Use a preset:

```json
{ "profile": "invoice" }
```

Available presets:
- `minimal`
- `fullbleed`
- `invoice`
- `booklet`
- `letter`
- `legal`

Presets merge deterministically with user overrides.

## 🛡️ Security Notes

- HTML input is not sanitized — sanitize upstream if needed.
- Cookie banner removal use @ghostery/adblocker-puppeteer
- Chromium runs with `--no-sandbox` for container compatibility; use sandboxing in trusted environments.

## License

MIT
