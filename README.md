# TwitterPlus Frontend (Regenerated)

Fresh React + Vite + Tailwind app wired to your routes from the message.

## Quick Start
```bash
npm i
cp .env.example .env
# Edit VITE_API_BASE_URL if needed (currently: http://localhost:5000/api/auth)
npm run dev
```

## Pages wired
- /, /signin, /signup
- /home, /explore, /notifications, /messages, /grok
- /bookmarks, /communities, /premium, /verifiedOrgs, /profile, /more

## API Endpoints used (adjust if needed)
- GET /tweets, POST /tweets, POST /tweets/:id/like, POST /tweets/:id/retweet
- POST /bookmarks/toggle/:tweetId
- GET /users/random?limit=3
- GET /profile
- Notifications: /notifications (+ read/clear routes)
- Grok: POST /grok

Set them in `src/services/*` or directly in pages.
