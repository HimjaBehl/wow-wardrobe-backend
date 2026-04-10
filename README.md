# ⚙️ W.O.W. — What. Outfit. When. (Backend)

The backend API for W.O.W., an AI-powered personal styling app.

## 🛠️ Tech Stack

- **Runtime:** Node.js + Express
- **Auth:** Firebase Admin SDK
- **AI:** OpenAI API (GPT-4o for outfit generation)
- **Fashion Tagging:** Ximilar API (auto-categorizes uploaded clothing items)
- **Deployment:** Render

## 🔗 Links

- **Live API:** [wow-wardrobe-backend.onrender.com](https://wow-wardrobe-backend.onrender.com)
- **Frontend Repo:** [wow-wardrobe-frontend](https://github.com/HimjaBehl/wow-wardrobe-frontend)

## 📡 Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Firebase token verification |
| GET | `/wardrobe` | Fetch user's wardrobe items |
| POST | `/style-piece` | Generate outfit looks for an uploaded item |
| POST | `/upload` | Upload clothing item with auto-tagging |

## 🚀 Getting Started

```bash
git clone https://github.com/HimjaBehl/wow-wardrobe-backend.git
cd wow-wardrobe-backend
npm install
npm start
```

Set up your `.env`:
OPENAI_API_KEY=
XIMILAR_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

## 💡 Architecture Note

The styling engine uses a two-step pipeline: Ximilar auto-tags the uploaded item (color, category, fabric type), then passes enriched metadata to GPT-4o to generate contextually accurate outfit combinations.
