import express from 'express';

const router = express.Router();

const PLACE_IDS = {
    vandematram: 'ChIJT_SeKRiDXjkR9ujjQDt4rMs',
    southbopal:  'ChIJT8LlIX-bXjkRkb4LalKy0mE',
    malabar:     'ChIJD3x1OdWDXjkRecjalDEqhM0',
};

// In-memory cache: { [branch]: { data, expiresAt } }
const cache = {};
const TTL_MS = 60 * 60 * 1000; // 1 hour

router.get('/', async (req, res) => {
    const branch = req.query.branch;
    const placeId = PLACE_IDS[branch];

    if (!placeId) {
        return res.status(400).json({ error: 'Unknown branch' });
    }

    const now = Date.now();
    if (cache[branch] && cache[branch].expiresAt > now) {
        return res.json(cache[branch].data);
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews,url&key=${apiKey}&language=en`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Places API ${response.status}`);

        const json = await response.json();
        if (json.status !== 'OK') throw new Error(`Places API status: ${json.status}`);

        const place = json.result;
        const data = {
            rating: place.rating ?? null,
            userRatingsTotal: place.user_ratings_total ?? 0,
            url: place.url ?? null,
            reviews: (place.reviews ?? []).slice(0, 8).map(r => ({
                author_name: r.author_name,
                rating: r.rating,
                text: r.text,
            })),
        };

        cache[branch] = { data, expiresAt: now + TTL_MS };
        res.json(data);
    } catch (err) {
        console.error('Reviews fetch error:', err.message);
        res.status(502).json({ error: 'Failed to fetch reviews' });
    }
});

export default router;
