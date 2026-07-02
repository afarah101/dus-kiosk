export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    projectId: 'dus-app-7b3a0',
  });
}
