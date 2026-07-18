const axios = require('axios');

const GIPHY_API_KEY = 'sXpGFDGZs0Dv1mmNFvYaGUvYwKX0PWIh';

async function main() {
  try {
    const res = await axios.get(
      `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=5&rating=g`
    );
    console.log("Giphy API Response Status:", res.status);
    console.log("Data count returned:", res.data?.data?.length);
    if (res.data?.data?.length > 0) {
      console.log("First GIF Image URL:", res.data.data[0].images.fixed_height.url);
      console.log("Downsampled exists:", !!res.data.data[0].images.fixed_height_downsampled);
    }
  } catch (err) {
    console.error("Giphy API request failed:", err.message);
    if (err.response) {
      console.error("Status:", err.response.status);
      console.error("Data:", err.response.data);
    }
  }
}

main();
