# 📊 B-Bud Software

**B-Bud** is a streamlined and modern **Barangay Management Information System**, designed for simplicity, speed, and ease of use — built using cutting-edge web technologies.

> ⚡ Powered by **Vue 3 + Nuxt 3 + Vuetify** on the frontend  
> 🔧 Backed by **ExpressJS + MongoDB** on the backend

---

## ✨ Features

- 🔄 CRUD operations for residents, officials, blotters, permits, certificates, and reports
- 🎨 Clean, intuitive, and responsive UI with Vuetify 3
- ⚡ Fast and scalable ExpressJS API
- 💾 MongoDB for flexible, cloud-ready database storage
- 🛠 Minimalist and scalable architecture for quick deployment and easy maintenance

---

## 📁 Project Structure

```
b-bud/
├── backend/           # ExpressJS + MongoDB backend
├── public/
├── assets/
├── components/
├── pages/
├── plugins/
├── nuxt.config.ts
└── ...
```

---

## 🚀 Getting Started

### 🔧 Requirements

- Node.js `>= 18`
- npm `>= 9`
- MongoDB database (local or cloud e.g., MongoDB Atlas)

---

### 📥 Clone the Repository

```bash
git clone https://github.com/developer/b-bud.git
cd b-bud
```

---

### 🖥️ Run the Frontend (Nuxt 3)

```bash
# Install frontend dependencies
npm install

# Start the frontend server
npm run dev
```

Frontend will run at: [http://localhost:3000](http://localhost:3000)

---

### 🔙 Run the Backend (ExpressJS + MongoDB)

```bash
cd backend

# Install backend dependencies
npm install

# Set up your environment variables (MongoDB URI, etc.)

# Start the backend server
npm run dev
```

Backend API will run at: [http://localhost:3001](http://localhost:3001)

> **Note:** Make sure you have MongoDB running locally or configure your `.env` file to connect to a MongoDB cloud instance.

---

## 🧪 Tech Stack

| Layer     | Technology             |
|-----------|-------------------------|
| Frontend  | Vue 3, Nuxt 3, Vuetify    |
| Backend   | ExpressJS, Node.js        |
| Database  | MongoDB                  |
| Styling   | Vuetify (Material UI)     |
