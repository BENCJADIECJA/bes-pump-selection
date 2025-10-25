BES Pumps Frontend

This is a small React + Vite frontend to visualize pump curves from the BES Flask API.

Quick start (dev)

1. From project root, change into the frontend folder:

   cd frontend

2. Install dependencies (you need Node.js >= 18):

   npm install

3. Start the dev server (it proxies /api to the Flask backend running on localhost:5000):

   npm run dev

4. Open http://localhost:5173 in your browser.

Notes
- The dev server proxies requests under /api to http://localhost:5000 so you should run the Flask backend concurrently.
- The frontend expects backend endpoints:
  - GET /api/pumps -> list of pump records (array of objects)
  - GET /api/pumps/<pump_id>/curves?freq=50&stages=300&points=101 -> JSON curves as provided by the Python backend

Plot library: Plotly (react-plotly.js + plotly.js-basic-dist)
