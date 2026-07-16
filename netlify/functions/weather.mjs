// Netlify Serverless Function — Atmos hava durumu proxy'si
// Bulut bilişim demosu: frontend bu fonksiyonu /.netlify/functions/weather
// adresinden çağırır. Fonksiyon Open-Meteo'ya gider, yanıtı zenginleştirir
// ve uygun cache header'ları ile döndürür. (Edge'de CDN tarafından cache'lenir.)

export default async (request, context) => {
  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");

  if (!lat || !lon) {
    return new Response(
      JSON.stringify({ error: "lat ve lon parametreleri gerekli" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "4"
  });

  try {
    const upstream = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const data = await upstream.json();

    // Sunucu tarafında küçük bir zenginleştirme: hangi bölgeden servis edildi?
    data.served_by = "netlify-function";
    data.edge_region = context?.geo?.city || context?.geo?.country?.name || "edge";

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Hava durumu alinamadi", detail: String(err) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = { path: "/.netlify/functions/weather" };
